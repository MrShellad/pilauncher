// src-tauri/src/commands/auth_cmd.rs
use crate::domain::auth::{Account, DeviceCodeResponse, McProfile, WardrobeSkinLibrary};
use crate::services::auth as auth_service;

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
    interval: u64,
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
    source_path: String,
) -> Result<String, String> {
    auth_service::upload_offline_skin(&app, &uuid, &source_path)
}

#[tauri::command]
pub async fn fetch_offline_skin_from_mojang<R: Runtime>(
    app: AppHandle<R>,
    username: String,
    offline_uuid: String,
) -> Result<String, String> {
    auth_service::fetch_and_save_mojang_skin(&app, &username, &offline_uuid).await
}

#[tauri::command]
pub async fn delete_offline_account_dir<R: Runtime>(
    app: AppHandle<R>,
    uuid: String,
) -> Result<(), String> {
    auth_service::delete_offline_account_dir(&app, &uuid)
}

// 新增：为前端提供刷新 Token 的命令
#[tauri::command]
pub async fn refresh_microsoft_token<R: Runtime>(
    app: AppHandle<R>,
    refresh_token: String,
) -> Result<Account, String> {
    auth_service::refresh_microsoft_token(&app, &refresh_token).await
}

// =======================================================
// ✅ 修复拼写错误：Strin -> String
// =======================================================
#[tauri::command]
pub async fn get_or_fetch_account_avatar<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    uuid: String,
    username: String,
) -> Result<String, String> {
    crate::services::auth::get_or_fetch_account_avatar(&app, &uuid, &username)
        .await
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn ensure_account_skin<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    uuid: String,
    skin_url: Option<String>,
) -> Result<String, String> {
    crate::services::auth::ensure_account_skin(&app, &uuid, skin_url.as_deref())
        .await
        .map(|p| p.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_wardrobe_profile<R: Runtime>(
    app: AppHandle<R>,
    access_token: String,
    account_uuid: String,
) -> Result<McProfile, String> {
    auth_service::get_wardrobe_profile(&app, &access_token, &account_uuid).await
}

#[tauri::command]
pub async fn apply_wardrobe_skin<R: Runtime>(
    app: AppHandle<R>,
    access_token: String,
    account_uuid: String,
    source_path: String,
    variant: String,
) -> Result<McProfile, String> {
    auth_service::apply_wardrobe_skin(&app, &access_token, &account_uuid, &source_path, &variant)
        .await
}

#[tauri::command]
pub async fn set_active_cape<R: Runtime>(
    app: AppHandle<R>,
    access_token: String,
    account_uuid: String,
    cape_id: String,
) -> Result<McProfile, String> {
    auth_service::set_active_cape(&app, &access_token, &account_uuid, &cape_id).await
}

#[tauri::command]
pub async fn clear_active_cape<R: Runtime>(
    app: AppHandle<R>,
    access_token: String,
    account_uuid: String,
) -> Result<McProfile, String> {
    auth_service::clear_active_cape(&app, &access_token, &account_uuid).await
}

#[tauri::command]
pub async fn get_wardrobe_skin_library<R: Runtime>(
    app: AppHandle<R>,
    account_uuid: String,
) -> Result<WardrobeSkinLibrary, String> {
    auth_service::get_wardrobe_skin_library(&app, &account_uuid)
}

#[tauri::command]
pub async fn save_wardrobe_skin_asset<R: Runtime>(
    app: AppHandle<R>,
    account_uuid: String,
    source_path: String,
    variant: String,
) -> Result<WardrobeSkinLibrary, String> {
    auth_service::save_wardrobe_skin_asset(&app, &account_uuid, &source_path, &variant)
}

#[tauri::command]
pub async fn delete_wardrobe_skin_asset<R: Runtime>(
    app: AppHandle<R>,
    account_uuid: String,
    asset_id: String,
) -> Result<WardrobeSkinLibrary, String> {
    auth_service::delete_wardrobe_skin_asset(&app, &account_uuid, &asset_id)
}

#[tauri::command]
pub async fn set_wardrobe_skin_asset_variant<R: Runtime>(
    app: AppHandle<R>,
    account_uuid: String,
    asset_id: String,
    variant: String,
) -> Result<WardrobeSkinLibrary, String> {
    auth_service::set_wardrobe_skin_asset_variant(&app, &account_uuid, &asset_id, &variant)
}

#[tauri::command]
pub async fn set_active_wardrobe_skin_offline<R: Runtime>(
    app: AppHandle<R>,
    account_uuid: String,
    asset_id: String,
) -> Result<WardrobeSkinLibrary, String> {
    auth_service::set_active_wardrobe_skin_offline(&app, &account_uuid, &asset_id)
}

#[tauri::command]
pub async fn update_active_wardrobe_skin_variant<R: Runtime>(
    app: AppHandle<R>,
    access_token: String,
    account_uuid: String,
    variant: String,
) -> Result<McProfile, String> {
    auth_service::update_active_wardrobe_skin_variant(&app, &access_token, &account_uuid, &variant)
        .await
}
