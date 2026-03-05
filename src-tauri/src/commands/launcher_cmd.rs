// src-tauri/src/commands/launcher_cmd.rs
use crate::error::AppResult;
use crate::services::launcher::LauncherService;
// ✅ 核心修改 1：引入新的统一账号模型
use crate::domain::launcher::Account; 
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn launch_game<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    account: Account, // ✅ 核心修改 2：将 AccountPayload 替换为 Account
) -> AppResult<()> {
    // 异步交由 Service 调度
    LauncherService::launch_instance(&app, &instance_id, account).await
}