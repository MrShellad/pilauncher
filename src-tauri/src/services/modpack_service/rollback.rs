use crate::domain::instance::InstanceConfig;
use crate::services::modpack_service::ops::resolve_base_dir;
use crate::services::modpack_service::orchestrator::persist_instance;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub async fn rollback_modpack_upgrade<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_dir = base_dir.join("instances").join(instance_id);
    let index_path = instance_dir.join("backup_index.json");
    let contents = fs::read_to_string(&index_path)
        .map_err(|_| "No upgrade snapshot found for this instance".to_string())?;
    let index: serde_json::Value =
        serde_json::from_str(&contents).map_err(|error| error.to_string())?;
    let snapshot_path = index["snapshotPath"]
        .as_str()
        .ok_or_else(|| "Invalid upgrade snapshot path".to_string())?;
    let snapshot_root = PathBuf::from(snapshot_path);
    let backup_root = base_dir.join("backups").join("modpack");
    if !snapshot_root.starts_with(&backup_root) || !snapshot_root.join("instance.json").exists() {
        return Err(
            "Upgrade snapshot is missing or outside the managed backup directory".to_string(),
        );
    }

    let current_root = base_dir
        .join("temp")
        .join("modpack")
        .join("rollback-current")
        .join(uuid::Uuid::new_v4().to_string());
    fs::create_dir_all(
        current_root
            .parent()
            .ok_or_else(|| "Failed to resolve rollback staging directory".to_string())?,
    )
    .map_err(|error| error.to_string())?;

    fs::rename(&instance_dir, &current_root)
        .map_err(|error| format!("Failed to stage current instance for rollback: {}", error))?;
    if let Err(error) = fs::rename(&snapshot_root, &instance_dir) {
        let _ = fs::rename(&current_root, &instance_dir);
        return Err(format!("Failed to restore upgrade snapshot: {}", error));
    }

    let restore_result = async {
        let config: InstanceConfig = serde_json::from_str(
            &fs::read_to_string(instance_dir.join("instance.json"))
                .map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        let mut config = config;
        persist_instance(app, instance_id, &instance_dir, &mut config).await
    }
    .await;

    if let Err(error) = restore_result {
        let failed_root = base_dir
            .join("temp")
            .join("modpack")
            .join("rollback-failed")
            .join(uuid::Uuid::new_v4().to_string());
        if let Some(parent) = failed_root.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::rename(&instance_dir, &failed_root);
        let _ = fs::rename(&current_root, &instance_dir);
        let _ = fs::remove_dir_all(failed_root);
        return Err(format!(
            "Failed to restore instance database state: {}",
            error
        ));
    }

    let _ = fs::remove_dir_all(&current_root);
    Ok(())
}
