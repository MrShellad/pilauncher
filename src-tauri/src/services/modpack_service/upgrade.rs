use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::ModpackUpgradeInfo;
use crate::services::deployment_cancel;
use crate::services::modpack_service::logging::ModpackImportLogger;
use crate::services::modpack_service::ops::{
    parse_modpack, resolve_base_dir, write_instance_config,
};
use crate::services::modpack_service::orchestrator::{deploy_archive_to_staging, persist_instance};
use chrono::Local;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Runtime};

pub async fn check_modpack_update<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    new_pack_path: Option<String>,
) -> Result<ModpackUpgradeInfo, String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let config_path = instance_dir.join("instance.json");
    if !config_path.exists() {
        return Err(format!("Instance {} not found", instance_id));
    }

    let config: InstanceConfig =
        serde_json::from_str(&fs::read_to_string(&config_path).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;
    let (backup_version, backup_mc_version, backup_loader_type, backup_loader_version) =
        read_backup_metadata(&instance_dir);

    let zip_path = new_pack_path.ok_or_else(|| {
        "Online modpack update metadata is unavailable; select a local modpack archive first"
            .to_string()
    })?;
    let metadata = parse_modpack(&zip_path)?;
    let has_update = match (&config.modpack_version, &metadata.pack_version) {
        (Some(current), Some(next)) => current != next,
        _ => true,
    };

    Ok(ModpackUpgradeInfo {
        has_update,
        current_version: config.modpack_version.clone(),
        latest_version: metadata
            .pack_version
            .unwrap_or_else(|| "unknown".to_string()),
        changelog: Some(format!(
            "{}: Minecraft {}, {} {}",
            metadata.name, metadata.version, metadata.loader, metadata.loader_version
        )),
        new_mc_version: metadata.version,
        new_loader_type: metadata.loader,
        new_loader_version: metadata.loader_version,
        current_mc_version: config.mc_version,
        backup_original_version: backup_version,
        backup_original_mc_version: backup_mc_version,
        backup_original_loader_type: backup_loader_type,
        backup_original_loader_version: backup_loader_version,
    })
}

pub async fn execute_modpack_upgrade<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    new_pack_path: &str,
    skip_backup: Option<bool>,
) -> Result<(), String> {
    if new_pack_path.is_empty() || !Path::new(new_pack_path).is_file() {
        return Err("A valid local modpack archive is required for upgrade".to_string());
    }
    parse_modpack(new_pack_path)?;

    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let config_path = instance_dir.join("instance.json");
    if !config_path.exists() {
        return Err(format!("Instance {} not found", instance_id));
    }
    let old_config: InstanceConfig =
        serde_json::from_str(&fs::read_to_string(&config_path).map_err(|error| error.to_string())?)
            .map_err(|error| error.to_string())?;

    let cancel = deployment_cancel::try_register(instance_id)?;
    let staging_root = base_dir
        .join("temp")
        .join("modpack")
        .join("upgrade-staging")
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(
        staging_root
            .parent()
            .ok_or_else(|| "Failed to resolve upgrade staging directory".to_string())?,
    )
    .map_err(|error| error.to_string())?;

    let logger = ModpackImportLogger::new(&base_dir, instance_id);
    let deployment = deploy_archive_to_staging(
        app,
        new_pack_path,
        instance_id,
        &old_config.name,
        &base_dir,
        &staging_root,
        &cancel,
        old_config.server_binding.clone(),
        &logger,
    )
    .await;
    deployment_cancel::unregister(instance_id);

    let mut new_config = match deployment {
        Ok(config) => config,
        Err(error) => {
            let _ = fs::remove_dir_all(&staging_root);
            return Err(error);
        }
    };
    copy_user_data(&instance_dir, &staging_root)?;
    preserve_instance_preferences(&old_config, &mut new_config);
    write_instance_config(&staging_root, &new_config)?;

    let keep_snapshot = !skip_backup.unwrap_or(false);
    let timestamp = Local::now().format("%Y%m%d%H%M%S").to_string();
    let snapshot_root = if keep_snapshot {
        base_dir
            .join("backups")
            .join("modpack")
            .join(instance_id)
            .join(format!("upgrade-{}", timestamp))
    } else {
        base_dir
            .join("temp")
            .join("modpack")
            .join("upgrade-previous")
            .join(uuid::Uuid::new_v4().to_string())
    };
    fs::create_dir_all(
        snapshot_root
            .parent()
            .ok_or_else(|| "Failed to resolve upgrade snapshot directory".to_string())?,
    )
    .map_err(|error| error.to_string())?;

    if keep_snapshot {
        write_upgrade_index(&staging_root, &snapshot_root, &old_config)?;
    }

    fs::rename(&instance_dir, &snapshot_root)
        .map_err(|error| format!("Failed to snapshot current instance: {}", error))?;
    if let Err(error) = fs::rename(&staging_root, &instance_dir) {
        let _ = fs::rename(&snapshot_root, &instance_dir);
        return Err(format!("Failed to activate upgraded instance: {}", error));
    }

    if let Err(error) = persist_instance(app, instance_id, &instance_dir, &mut new_config).await {
        restore_failed_upgrade(
            app,
            instance_id,
            &instance_dir,
            &snapshot_root,
            old_config,
            &base_dir,
        )
        .await;
        return Err(format!("Failed to persist upgraded instance: {}", error));
    }

    if !keep_snapshot {
        let _ = fs::remove_dir_all(&snapshot_root);
    }
    Ok(())
}

pub(super) fn read_backup_metadata(
    instance_dir: &Path,
) -> (
    Option<String>,
    Option<String>,
    Option<String>,
    Option<String>,
) {
    let path = instance_dir.join("backup_index.json");
    let Ok(contents) = fs::read_to_string(path) else {
        return (None, None, None, None);
    };
    let index: serde_json::Value = serde_json::from_str(&contents).unwrap_or_default();
    (
        index["originalVersion"].as_str().map(str::to_string),
        index["originalMcVersion"].as_str().map(str::to_string),
        index["originalLoaderType"].as_str().map(str::to_string),
        index["originalLoaderVersion"].as_str().map(str::to_string),
    )
}

fn write_upgrade_index(
    staging_root: &Path,
    snapshot_root: &Path,
    old_config: &InstanceConfig,
) -> Result<(), String> {
    let index = serde_json::json!({
        "snapshotPath": snapshot_root,
        "originalVersion": old_config.modpack_version.clone().unwrap_or_else(|| "unknown".to_string()),
        "originalMcVersion": old_config.mc_version,
        "originalLoaderType": old_config.loader.r#type,
        "originalLoaderVersion": old_config.loader.version,
        "timestamp": Local::now().timestamp(),
    });
    fs::write(
        staging_root.join("backup_index.json"),
        serde_json::to_string_pretty(&index).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

fn preserve_instance_preferences(old: &InstanceConfig, new: &mut InstanceConfig) {
    new.name = old.name.clone();
    new.java.path = old.java.path.clone();
    new.java.version = old.java.version.clone();
    new.memory.min = old.memory.min;
    new.memory.max = old.memory.max;
    new.resolution.width = old.resolution.width;
    new.resolution.height = old.resolution.height;
    new.cover_image = old.cover_image.clone();
    new.hero_logo = old.hero_logo.clone();
    new.gamepad = old.gamepad.clone();
    new.custom_buttons = old.custom_buttons.clone();
    new.jvm_args = old.jvm_args.clone();
    new.is_favorite = old.is_favorite;
    new.global_metadata_settings = old.global_metadata_settings.clone();
}

fn copy_user_data(source: &Path, target: &Path) -> Result<(), String> {
    for name in [
        "saves",
        "screenshots",
        "options.txt",
        "servers.dat",
        "optionsof.txt",
        "piconfig",
    ] {
        let from = source.join(name);
        let to = target.join(name);
        if !from.exists() {
            continue;
        }
        if from.is_dir() {
            copy_directory(&from, &to)?;
        } else {
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::copy(from, to).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn copy_directory(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| error.to_string())?;
    for entry in fs::read_dir(source).map_err(|error| error.to_string())? {
        let entry = entry.map_err(|error| error.to_string())?;
        let from = entry.path();
        let to = target.join(entry.file_name());
        let kind = entry.file_type().map_err(|error| error.to_string())?;
        if kind.is_symlink() {
            continue;
        }
        if kind.is_dir() {
            copy_directory(&from, &to)?;
        } else if kind.is_file() {
            fs::copy(from, to).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

async fn restore_failed_upgrade<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    instance_dir: &Path,
    snapshot_root: &Path,
    old_config: InstanceConfig,
    base_dir: &Path,
) {
    let failed_root = base_dir
        .join("temp")
        .join("modpack")
        .join("failed-upgrades")
        .join(uuid::Uuid::new_v4().to_string());
    if let Some(parent) = failed_root.parent() {
        let _ = fs::create_dir_all(parent);
    }
    let _ = fs::rename(instance_dir, &failed_root);
    let _ = fs::rename(snapshot_root, instance_dir);
    let mut restored = old_config;
    let _ = persist_instance(app, instance_id, instance_dir, &mut restored).await;
    let _ = fs::remove_dir_all(failed_root);
}
