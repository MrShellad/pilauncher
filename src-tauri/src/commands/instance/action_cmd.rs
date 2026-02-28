// src-tauri/src/commands/instance/action_cmd.rs
use tauri::{AppHandle, Runtime};
use crate::services::instance::action::InstanceActionService;

#[tauri::command]
pub async fn rename_instance<R: Runtime>(app: AppHandle<R>, id: String, new_name: String) -> Result<(), String> {
    // 将提取到的前端参数，传递给底层 Service
    InstanceActionService::rename(&app, &id, &new_name)
}

#[tauri::command]
pub async fn change_instance_cover<R: Runtime>(app: AppHandle<R>, id: String, image_path: String) -> Result<String, String> {
    InstanceActionService::change_cover(&app, &id, &image_path)
}

#[tauri::command]
pub async fn delete_instance<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), String> {
    InstanceActionService::delete(&app, &id)
}

#[tauri::command]
pub async fn get_instance_detail<R: Runtime>(app: AppHandle<R>, id: String) -> Result<serde_json::Value, String> {
    InstanceActionService::get_detail(&app, &id)
}