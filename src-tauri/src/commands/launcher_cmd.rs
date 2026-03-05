// src-tauri/src/commands/launcher_cmd.rs
use crate::error::AppResult;
use crate::services::launcher::LauncherService;
use crate::domain::launcher::AccountPayload; // ✅ 引入刚刚定义的账号模型
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn launch_game<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    account: AccountPayload, // ✅ 核心修改：接收前端传来的完整账号数据对象
) -> AppResult<()> {
    // 异步交由 Service 调度
    LauncherService::launch_instance(&app, &instance_id, account).await
}