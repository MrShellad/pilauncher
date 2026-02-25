// src-tauri/src/commands/config_cmd.rs
use tauri::{AppHandle, Runtime};
use crate::services::config_service::ConfigService;

#[tauri::command]
pub async fn get_base_directory<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    ConfigService::get_base_path(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_base_directory<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    ConfigService::set_base_path(&app, &path)
}