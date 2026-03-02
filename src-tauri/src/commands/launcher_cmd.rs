use crate::error::AppResult;
use crate::services::launcher::LauncherService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn launch_game<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    offline_name: String,
) -> AppResult<()> {
    // 异步交由 Service 调度
    LauncherService::launch_instance(&app, &instance_id, &offline_name).await
}
