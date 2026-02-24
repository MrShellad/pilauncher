// src-tauri/src/commands/animation_cmd.rs
use tauri::{AppHandle, Runtime}; // 引入 Runtime
use crate::error::{AppError, AppResult};
use crate::domain::animation::AnimationRequest;
use crate::services::animation_service::AnimationService;

#[tauri::command]
// 【关键修复】：加上 <R: Runtime>，并将 AppHandle 改为 AppHandle<R>
pub async fn load_custom_animation<R: Runtime>(
    app: AppHandle<R>,
    request: AnimationRequest,
) -> AppResult<Option<String>> {
    let blocking_result = tokio::task::spawn_blocking(move || {
        AnimationService::resolve_and_load(&app, request)
    })
    .await;

    match blocking_result {
        Ok(inner_result) => inner_result,
        Err(join_err) => Err(AppError::Io(std::io::Error::new(
            std::io::ErrorKind::Other,
            join_err.to_string(),
        ))),
    }
}