// src-tauri/src/commands/auth_cmd.rs
use crate::domain::auth::{DeviceCodeResponse, MinecraftAccount};
use crate::services::auth_service;

#[tauri::command]
pub async fn request_microsoft_device_code() -> Result<DeviceCodeResponse, String> {
    auth_service::request_device_code().await
}

#[tauri::command]
pub async fn poll_and_exchange_microsoft_token(
    device_code: String, 
    interval: u64
) -> Result<MinecraftAccount, String> {
    auth_service::poll_and_exchange_token(&device_code, interval).await
}

#[tauri::command]
pub fn generate_offline_uuid(name: String) -> Result<String, String> {
    Ok(crate::services::auth_service::generate_offline_uuid(&name))
}

#[tauri::command]
pub async fn upload_offline_skin<R: tauri::Runtime>(
    app: tauri::AppHandle<R>, 
    uuid: String, 
    source_path: String
) -> Result<String, String> {
    crate::services::auth_service::upload_offline_skin(&app, &uuid, &source_path)
}

#[tauri::command]
pub async fn fetch_offline_skin_from_mojang<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    username: String,
    offline_uuid: String
) -> Result<String, String> {
    crate::services::auth_service::fetch_and_save_mojang_skin(&app, &username, &offline_uuid).await
}

#[tauri::command]
pub async fn delete_offline_account_dir<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    uuid: String
) -> Result<(), String> {
    crate::services::auth_service::delete_offline_account_dir(&app, &uuid)
}