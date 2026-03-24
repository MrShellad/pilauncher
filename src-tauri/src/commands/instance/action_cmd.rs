// src-tauri/src/commands/instance/action_cmd.rs
use crate::domain::instance::CustomButtonConfig;
use crate::services::instance::action::InstanceActionService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn rename_instance<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    // 将提取到的前端参数，传递给底层 Service
    InstanceActionService::rename(&app, &id, &new_name)
}

#[tauri::command]
pub async fn change_instance_cover<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    image_path: String,
) -> Result<String, String> {
    InstanceActionService::change_cover(&app, &id, &image_path)
}

#[tauri::command]
pub async fn change_instance_herologo<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    image_path: String,
) -> Result<String, String> {
    InstanceActionService::change_herologo(&app, &id, &image_path)
}

#[tauri::command]
pub async fn delete_instance<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    InstanceActionService::delete(&app, &id)
}

#[tauri::command]
pub async fn get_instance_detail<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<serde_json::Value, String> {
    InstanceActionService::get_detail(&app, &id)
}

#[tauri::command]
pub async fn update_instance_custom_buttons<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    custom_buttons: Vec<CustomButtonConfig>,
) -> Result<(), String> {
    InstanceActionService::update_custom_buttons(&app, &id, custom_buttons)
}

#[tauri::command]
pub async fn check_instance_gamepad<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<bool, String> {
    crate::services::instance::mod_manager::ModManagerService::check_and_update_gamepad(&app, &id)
}

#[tauri::command]
pub async fn check_gamepad_mod_status<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    mc_version: String,
    loader_type: String,
) -> Result<crate::services::instance::mod_manager::GamepadModStatus, String> {
    crate::services::instance::mod_manager::ModManagerService::check_gamepad_mod_status(
        &app,
        &instance_id,
        &mc_version,
        &loader_type,
    )
    .await
}

#[tauri::command]
pub async fn install_remote_mod<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    download_url: String,
    file_name: String,
    mc_version: String,
    loader_type: String,
) -> Result<(), String> {
    crate::services::instance::mod_manager::ModManagerService::install_remote_mod(
        &app,
        &instance_id,
        &download_url,
        &file_name,
        &mc_version,
        &loader_type,
    )
    .await
}
