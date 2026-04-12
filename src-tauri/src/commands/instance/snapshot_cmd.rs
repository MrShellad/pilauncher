use crate::services::instance::mod_snapshot_manager::{
    InstanceSnapshot, ModSnapshotManager, SnapshotDiff,
};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn take_snapshot<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    trigger: String,
    message: String,
) -> Result<InstanceSnapshot, String> {
    ModSnapshotManager::take_snapshot(app, instance_id, trigger, message).await
}

#[tauri::command]
pub async fn get_snapshot_history<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<Vec<InstanceSnapshot>, String> {
    ModSnapshotManager::get_snapshot_history(&app, &instance_id)
}

#[tauri::command]
pub async fn calculate_snapshot_diff<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    old_id: String,
    new_id: String,
) -> Result<SnapshotDiff, String> {
    ModSnapshotManager::calculate_snapshot_diff(&app, &instance_id, &old_id, &new_id)
}

#[tauri::command]
pub async fn rollback_instance<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    snapshot_id: String,
) -> Result<(), String> {
    ModSnapshotManager::rollback_instance(&app, &instance_id, &snapshot_id)
}
