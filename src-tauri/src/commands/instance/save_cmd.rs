// src-tauri/src/commands/instance/save_cmd.rs
use crate::services::instance::save_manager::{SaveBackupMetadata, SaveItem, SaveManagerService};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn get_saves<R: Runtime>(app: AppHandle<R>, id: String) -> Result<Vec<SaveItem>, String> {
    SaveManagerService::get_saves(&app, &id)
}

#[tauri::command]
pub async fn backup_save<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    folder_name: String,
) -> Result<SaveBackupMetadata, String> {
    SaveManagerService::backup_save(&app, &id, &folder_name)
}

#[tauri::command]
pub async fn delete_save<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    folder_name: String,
    direct_delete: bool,
) -> Result<(), String> {
    SaveManagerService::delete_save(&app, &id, &folder_name, direct_delete)
}

#[tauri::command]
pub async fn verify_save_restore<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    backup_uuid: String,
) -> Result<Vec<String>, String> {
    SaveManagerService::verify_restore(&app, &id, &backup_uuid)
}

#[tauri::command]
pub async fn get_save_backups<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Vec<SaveBackupMetadata>, String> {
    crate::services::instance::save_manager::SaveManagerService::get_backups(&app, &id)
}

#[tauri::command]
pub async fn open_saves_folder<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    SaveManagerService::open_saves_folder(&app, &id)
}