// src-tauri/src/commands/instance/creation_cmd.rs
use crate::domain::instance::CreateInstancePayload;
use crate::error::AppResult;
use crate::services::instance::creation::InstanceCreationService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
// ✅ 修复：添加 <R: Runtime> 泛型，告诉 Tauri 这是一个系统级的 AppHandle
pub async fn create_instance<R: Runtime>(
    app: AppHandle<R>,
    payload: CreateInstancePayload,
) -> AppResult<()> {
    // ✅ 修复：传递引用 &app 并使用 .await 等待异步任务完成
    InstanceCreationService::create(&app, payload).await
}
