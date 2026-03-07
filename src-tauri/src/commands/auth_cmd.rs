// src-tauri/src/commands/auth_cmd.rs
use crate::domain::auth::{DeviceCodeResponse, Account};
use crate::services::auth_service;

// 核心修复 1：引入 tauri 的 AppHandle 和 Runtime
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn request_microsoft_device_code() -> Result<DeviceCodeResponse, String> {
    auth_service::request_device_code().await
}

// 核心修复 2：统一使用 <R: Runtime> 泛型，并接收 app: AppHandle<R>
#[tauri::command]
pub async fn poll_and_exchange_microsoft_token<R: Runtime>(
    app: AppHandle<R>, 
    device_code: String, 
    interval: u64
) -> Result<Account, String> {
    auth_service::poll_and_exchange_token(&app, &device_code, interval).await
}

#[tauri::command]
pub fn generate_offline_uuid(name: String) -> Result<String, String> {
    Ok(auth_service::generate_offline_uuid(&name))
}

#[tauri::command]
pub async fn upload_offline_skin<R: Runtime>(
    app: AppHandle<R>, 
    uuid: String, 
    source_path: String
) -> Result<String, String> {
    auth_service::upload_offline_skin(&app, &uuid, &source_path)
}

#[tauri::command]
pub async fn fetch_offline_skin_from_mojang<R: Runtime>(
    app: AppHandle<R>,
    username: String,
    offline_uuid: String
) -> Result<String, String> {
    auth_service::fetch_and_save_mojang_skin(&app, &username, &offline_uuid).await
}

#[tauri::command]
pub async fn delete_offline_account_dir<R: Runtime>(
    app: AppHandle<R>,
    uuid: String
) -> Result<(), String> {
    auth_service::delete_offline_account_dir(&app, &uuid)
}

// 新增：为前端提供刷新 Token 的命令
#[tauri::command]
pub async fn refresh_microsoft_token<R: Runtime>(
    app: AppHandle<R>, 
    refresh_token: String
) -> Result<Account, String> {
    auth_service::refresh_microsoft_token(&app, &refresh_token).await
}

// 新增：供前端调用，返回本地头像的物理绝对路径
#[tauri::command]
pub async fn get_or_fetch_account_avatar<R: Runtime>(
    app: AppHandle<R>, 
    uuid: String
) -> Result<String, String> {
    auth_service::get_or_fetch_account_avatar(&app, &uuid).await
}