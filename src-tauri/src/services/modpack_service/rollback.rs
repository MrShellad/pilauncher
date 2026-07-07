// src-tauri/src/services/modpack_service/rollback.rs
use crate::domain::instance::InstanceConfig;
use crate::services::instance::backup_service::restore_backup_data;
use crate::services::instance::mod_manifest_service::ModManifestService;
use crate::services::modpack_service::ops::resolve_base_dir;

use std::fs;
use tauri::{AppHandle, Runtime};

pub async fn rollback_modpack_upgrade<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let instance_json_path = instance_dir.join("instance.json");
    let backup_index_path = instance_dir.join("backup_index.json");

    if !backup_index_path.exists() {
        return Err("No upgrade backup index found for this instance. Cannot rollback.".to_string());
    }

    // Read backup index
    let index_content = fs::read_to_string(&backup_index_path)
        .map_err(|e| format!("Failed to read backup index: {}", e))?;
    let index_json: serde_json::Value = serde_json::from_str(&index_content)
        .map_err(|e| format!("Failed to parse backup index: {}", e))?;

    let backup_rel_path = index_json["backupPath"].as_str()
        .ok_or_else(|| "Invalid backup path in index".to_string())?;
    let original_version = index_json["originalVersion"].as_str()
        .ok_or_else(|| "Invalid original version in index".to_string())?;
    let original_mc_version = index_json["originalMcVersion"].as_str()
        .ok_or_else(|| "Invalid original MC version in index".to_string())?;
    let original_loader_type = index_json["originalLoaderType"].as_str()
        .ok_or_else(|| "Invalid original Loader Type in index".to_string())?;
    let original_loader_version = index_json["originalLoaderVersion"].as_str()
        .ok_or_else(|| "Invalid original Loader Version in index".to_string())?;

    let backup_zip_path = instance_dir.join(backup_rel_path);
    if !backup_zip_path.exists() {
        return Err(format!("Backup zip file not found: {}", backup_zip_path.display()));
    }

    // Step 1: Clean current configurations to prevent merge issues
    let current_config_dir = instance_dir.join("config");
    if current_config_dir.exists() {
        let _ = fs::remove_dir_all(&current_config_dir);
    }

    // Step 2: Restore options.txt, servers.dat, saves, config, and mod_manifest.json from backup ZIP
    restore_backup_data(&instance_dir, &backup_zip_path)?;

    // Step 3: Delete mods that are not in the restored manifest
    let manifest_path = instance_dir.join("mod_manifest.json");
    if manifest_path.exists() {
        let restored_manifest = ModManifestService::read_manifest_robust(&manifest_path);
        let mods_dir = instance_dir.join("mods");
        if mods_dir.exists() {
            if let Ok(read_dir) = fs::read_dir(&mods_dir) {
                for entry in read_dir.flatten() {
                    let path = entry.path();
                    if !path.is_file() {
                        continue;
                    }
                    let fname = entry.file_name().to_string_lossy().to_string();
                    let key = crate::domain::mod_manifest::mod_manifest_key(&fname);
                    
                    // If this mod is not in the restored manifest, delete it
                    if !restored_manifest.contains_key(&key) {
                        let _ = fs::remove_file(path);
                    }
                }
            }
        }

        // Re-sync mod directory with the restored manifest
        let _ = ModManifestService::sync_from_mods_dir(&mods_dir, &manifest_path);
    }

    // Step 4: Reset metadata in instance.json
    if instance_json_path.exists() {
        let config_content = fs::read_to_string(&instance_json_path)
            .map_err(|e| format!("Failed to read instance.json: {}", e))?;
        let mut config: InstanceConfig = serde_json::from_str(&config_content)
            .map_err(|e| format!("Failed to parse instance.json: {}", e))?;

        config.modpack_version = Some(original_version.to_string());
        config.mc_version = original_mc_version.to_string();
        config.loader.r#type = original_loader_type.to_string();
        config.loader.version = original_loader_version.to_string();

        fs::write(
            &instance_json_path,
            serde_json::to_string_pretty(&config).unwrap(),
        )
        .map_err(|e| format!("Failed to restore instance.json config: {}", e))?;
    }

    // Step 5: Clean up backup index and backup zip
    let _ = fs::remove_file(&backup_index_path);
    let _ = fs::remove_file(&backup_zip_path);

    Ok(())
}
