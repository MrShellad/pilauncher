// src-tauri/src/commands/instance/creation_cmd.rs
use tauri::AppHandle;
use crate::domain::instance::CreateInstancePayload;
use crate::services::instance::creation::InstanceCreationService;
use crate::error::AppResult;

#[tauri::command]
pub async fn create_instance(app: AppHandle, payload: CreateInstancePayload) -> AppResult<()> {
    // 传入 app 句柄，并改为 await 异步调用
    InstanceCreationService::create(&app, payload).await
}