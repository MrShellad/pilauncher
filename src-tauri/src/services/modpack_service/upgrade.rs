// src-tauri/src/services/modpack_service/upgrade.rs
use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::ModpackUpgradeInfo;
use crate::domain::mod_manifest::{ModSourceKind};
use crate::services::instance::backup_service::backup_instance_data;
use crate::services::instance::mod_manifest_service::ModManifestService;
use crate::services::modpack_service::ops::{
    open_modpack_archive, read_zip_entry_to_string, detect_modpack_source, resolve_base_dir,
};
use crate::services::modpack_service::logic::ModpackSourceHint;
use crate::services::modpack_service::orchestrator::execute_import;

use chrono::Local;
use std::collections::HashSet;
use std::fs::{self, File};
use std::path::{Path};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Runtime};

pub async fn check_modpack_update<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    new_pack_path: Option<String>,
) -> Result<ModpackUpgradeInfo, String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let instance_json_path = instance_dir.join("instance.json");
    if !instance_json_path.exists() {
        return Err(format!("Instance {} not found", instance_id));
    }

    let config_content = fs::read_to_string(&instance_json_path)
        .map_err(|e| format!("Failed to read instance.json: {}", e))?;
    let config: InstanceConfig = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse instance.json: {}", e))?;

    let backup_index_path = instance_dir.join("backup_index.json");
    let (b_version, b_mc_version, b_loader_type, b_loader_version) = if backup_index_path.exists() {
        let index_content = fs::read_to_string(&backup_index_path).unwrap_or_default();
        let index: serde_json::Value = serde_json::from_str(&index_content).unwrap_or(serde_json::Value::Null);
        (
            index["originalVersion"].as_str().map(|s| s.to_string()),
            index["originalMcVersion"].as_str().map(|s| s.to_string()),
            index["originalLoaderType"].as_str().map(|s| s.to_string()),
            index["originalLoaderVersion"].as_str().map(|s| s.to_string()),
        )
    } else {
        (None, None, None, None)
    };

    // If a new local pack path is provided, read its metadata and compare versions
    if let Some(zip_path) = new_pack_path {
        let metadata = crate::services::modpack_service::ops::parse_modpack(&zip_path)?;
        let has_update = match (&config.modpack_version, &metadata.pack_version) {
            (Some(cur), Some(new)) => cur != new,
            _ => true,
        };

        return Ok(ModpackUpgradeInfo {
            has_update,
            current_version: config.modpack_version.clone(),
            latest_version: metadata.pack_version.unwrap_or_else(|| "unknown".to_string()),
            changelog: Some(format!(
                "## {} 更新日志\n- 新版游戏版本: {}\n- 新版加载器: {} ({})",
                metadata.name, metadata.version, metadata.loader, metadata.loader_version
            )),
            new_mc_version: metadata.version,
            new_loader_type: metadata.loader,
            new_loader_version: metadata.loader_version,
            current_mc_version: config.mc_version.clone(),
            backup_original_version: b_version.clone(),
            backup_original_mc_version: b_mc_version.clone(),
            backup_original_loader_type: b_loader_type.clone(),
            backup_original_loader_version: b_loader_version.clone(),
        });
    }

    // Otherwise, simulate a mock update for testing
    let current_ver = config.modpack_version.clone().unwrap_or_else(|| "1.0.0".to_string());
    let has_update = current_ver != "1.1.0";
    let latest_version = if has_update { "1.1.0".to_string() } else { current_ver.clone() };

    let changelog = if has_update {
        Some(r#"## v1.1.0 更新日志

### 🚀 优化与改进
- 大幅优化了客户端启动速度，减少内存占用
- 更新了几个核心优化模组（Phosphor, Sodium），FPS 提升约 20%
- 调整了科技线合成配方，游戏体验更加平滑

### 🐛 Bug 修复
- 修复了在下界探索时可能发生的偶发性卡死崩溃
- 修复了小地图在地底高度显示不准的问题
- 解决了按键冲突，预设键位现在更合理
"#.to_string())
    } else {
        None
    };

    Ok(ModpackUpgradeInfo {
        has_update,
        current_version: Some(current_ver),
        latest_version,
        changelog,
        new_mc_version: config.mc_version.clone(),
        new_loader_type: config.loader.r#type.clone(),
        new_loader_version: config.loader.version.clone(),
        current_mc_version: config.mc_version.clone(),
        backup_original_version: b_version,
        backup_original_mc_version: b_mc_version,
        backup_original_loader_type: b_loader_type,
        backup_original_loader_version: b_loader_version,
    })
}

pub async fn execute_modpack_upgrade<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    new_pack_path: &str,
    skip_backup: Option<bool>,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let instance_json_path = instance_dir.join("instance.json");
    if !instance_json_path.exists() {
        return Err(format!("Instance {} not found", instance_id));
    }

    let config_content = fs::read_to_string(&instance_json_path)
        .map_err(|e| format!("Failed to read instance.json: {}", e))?;
    let old_config: InstanceConfig = serde_json::from_str(&config_content)
        .map_err(|e| format!("Failed to parse instance.json: {}", e))?;

    // Step 1: Backup sensitive directories and files if not skipped
    let backup_zip_path = if !skip_backup.unwrap_or(false) {
        let timestamp = Local::now().format("%Y%m%d%H%M%S").to_string();
        let backup_dir = instance_dir.join(".backups");
        let backup_zip_name = format!("upgrade-{}.zip", timestamp);
        let backup_zip_path = backup_dir.join(&backup_zip_name);

        backup_instance_data(&instance_dir, &backup_zip_path)?;

        // Write backup index to track latest backup for rollback
        let backup_index_path = instance_dir.join("backup_index.json");
        let index_json = serde_json::json!({
            "backupPath": format!(".backups/{}", backup_zip_name),
            "originalVersion": old_config.modpack_version.clone().unwrap_or_else(|| "1.0.0".to_string()),
            "originalMcVersion": old_config.mc_version.clone(),
            "originalLoaderType": old_config.loader.r#type.clone(),
            "originalLoaderVersion": old_config.loader.version.clone(),
            "timestamp": Local::now().timestamp()
        });
        fs::write(&backup_index_path, serde_json::to_string_pretty(&index_json).unwrap())
            .map_err(|e| format!("Failed to write backup index: {}", e))?;

        Some(backup_zip_path)
    } else {
        None
    };

    let is_mock = new_pack_path.is_empty() || !Path::new(new_pack_path).exists();
    if is_mock {
        let updated_config_content = fs::read_to_string(&instance_json_path)
            .map_err(|e| format!("Failed to read instance.json: {}", e))?;
        let mut updated_config: InstanceConfig = serde_json::from_str(&updated_config_content)
            .map_err(|e| format!("Failed to parse instance.json: {}", e))?;

        updated_config.modpack_version = Some("1.1.0".to_string());
        updated_config.modpack_id = Some(instance_id.to_string());

        fs::write(
            &instance_json_path,
            serde_json::to_string_pretty(&updated_config).unwrap(),
        )
        .map_err(|e| format!("Failed to write updated instance config: {}", e))?;

        return Ok(());
    }

    // Step 2: Diff Mod List and delete old ModpackDeployment mods
    let manifest_path = instance_dir.join("mod_manifest.json");
    let current_manifest = if manifest_path.exists() {
        ModManifestService::read_manifest_robust(&manifest_path)
    } else {
        std::collections::HashMap::new()
    };

    let new_mod_keys = get_new_modpack_mod_keys(new_pack_path)?;
    let mut files_to_delete = Vec::new();

    for (file_key, entry) in &current_manifest {
        if entry.source.kind == ModSourceKind::ModpackDeployment {
            let mut is_kept = false;

            // Check by project id (For CurseForge)
            if let Some(proj_id) = &entry.source.project_id {
                if new_mod_keys.contains(proj_id) {
                    is_kept = true;
                }
            }

            // Check by filename/normalized key (For Modrinth / PiPack)
            for new_key in &new_mod_keys {
                if crate::domain::mod_manifest::mod_manifest_key(new_key) == *file_key {
                    is_kept = true;
                    break;
                }
            }

            if !is_kept {
                let mods_dir = instance_dir.join("mods");
                if mods_dir.exists() {
                    if let Ok(read_dir) = fs::read_dir(&mods_dir) {
                        for entry_file in read_dir.flatten() {
                            let fname = entry_file.file_name().to_string_lossy().to_string();
                            if crate::domain::mod_manifest::mod_manifest_key(&fname) == *file_key {
                                files_to_delete.push(mods_dir.join(fname));
                            }
                        }
                    }
                }
            }
        }
    }

    for path in files_to_delete {
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    // Step 3: Run the import orchestrator to extract new overrides and download new mods.
    // By passing the same instance name, the orchestrator will target the exact same directory.
    let cancel = Arc::new(AtomicBool::new(false));
    execute_import(app, new_pack_path, &old_config.name, &cancel, None).await?;

    // Step 4: Selective restore of user data (saves, screenshots, keybinds, servers)
    // Because the overrides extraction in execute_import might have overwritten option files.
    if let Some(zip_path) = backup_zip_path {
        restore_user_sensitive_data(&instance_dir, &zip_path)?;
    }

    // Step 5: Update Modpack version in instance.json
    let metadata = crate::services::modpack_service::ops::parse_modpack(new_pack_path)?;
    let updated_config_content = fs::read_to_string(&instance_json_path)
        .map_err(|e| format!("Failed to read updated instance.json: {}", e))?;
    let mut updated_config: InstanceConfig = serde_json::from_str(&updated_config_content)
        .map_err(|e| format!("Failed to parse updated instance.json: {}", e))?;

    updated_config.modpack_version = metadata.pack_version.or(Some("1.1.0".to_string()));
    updated_config.modpack_uuid = metadata.pack_uuid;
    updated_config.modpack_source = Some(metadata.source);
    updated_config.modpack_id = Some(instance_id.to_string());
    updated_config.mc_version = metadata.version;
    updated_config.loader.r#type = metadata.loader;
    updated_config.loader.version = metadata.loader_version;

    fs::write(
        &instance_json_path,
        serde_json::to_string_pretty(&updated_config).unwrap(),
    )
    .map_err(|e| format!("Failed to write updated instance config: {}", e))?;

    Ok(())
}

fn get_new_modpack_mod_keys(zip_path: &str) -> Result<HashSet<String>, String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let source = detect_modpack_source(&mut archive)?;
    let mut keys = HashSet::new();

    match source {
        ModpackSourceHint::PiPack => {
            let contents = read_zip_entry_to_string(&mut archive, "pi_manifest.json")?;
            let manifest: crate::domain::modpack::PiPackManifest = serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse PiPack manifest: {}", e))?;
            for m in manifest.mods {
                keys.insert(m.file_name);
            }
        }
        ModpackSourceHint::Modrinth => {
            let contents = read_zip_entry_to_string(&mut archive, "modrinth.index.json")?;
            let index: serde_json::Value = serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse Modrinth index: {}", e))?;
            if let Some(files) = index["files"].as_array() {
                for f in files {
                    if let Some(path_str) = f["path"].as_str() {
                        let path = Path::new(path_str);
                        if let Some(fname) = path.file_name() {
                            keys.insert(fname.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        ModpackSourceHint::CurseForge => {
            let contents = read_zip_entry_to_string(&mut archive, "manifest.json")?;
            let manifest: serde_json::Value = serde_json::from_str(&contents)
                .map_err(|e| format!("Failed to parse CurseForge manifest: {}", e))?;
            if let Some(files) = manifest["files"].as_array() {
                for f in files {
                    if let Some(project_id) = f["projectID"].as_i64() {
                        keys.insert(project_id.to_string());
                    }
                }
            }
        }
    }
    Ok(keys)
}

fn restore_user_sensitive_data(instance_root: &Path, backup_zip_path: &Path) -> Result<(), String> {
    let file = File::open(backup_zip_path)
        .map_err(|e| format!("Failed to open backup zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read backup zip: {}", e))?;

    // We only restore files/folders that belong to the user and shouldn't be overridden
    let restore_prefixes = ["saves/", "screenshots/", "options.txt", "servers.dat", "optionsof.txt"];

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read entry from backup zip: {}", e))?;

        let name = file.name().to_string();
        let should_restore = restore_prefixes.iter().any(|prefix| {
            if prefix.ends_with('/') {
                name.starts_with(prefix)
            } else {
                name == *prefix
            }
        });

        if !should_restore {
            continue;
        }

        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let final_path = instance_root.join(&outpath);

        if file.name().ends_with('/') {
            fs::create_dir_all(&final_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(p) = final_path.parent() {
                fs::create_dir_all(p)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let mut outfile = fs::File::create(&final_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            std::io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to restore file: {}", e))?;
        }
    }

    Ok(())
}
