use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use reqwest::Client;
use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use crate::services::deployment_cancel::is_cancelled;

mod game_core;
mod libraries;
mod assets;
mod mirror;
mod scheduler;
mod progress;

pub use game_core::load_version_manifest;
pub use libraries::download_libraries;
pub use assets::download_assets;

/// 对外暴露的统一入口：负责流程编排
pub async fn download_dependencies<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (Minecraft Launcher)")
        .build()?;

    // 游戏核心：加载版本清单
    let manifest = game_core::load_version_manifest(global_mc_root, version_id).await?;

    // 依赖库下载（并发 + 进度上报）
    libraries::download_libraries(
        app,
        instance_id,
        &client,
        &manifest,
        global_mc_root,
        cancel,
    )
    .await?;

    // 流程控制：中途取消
    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    // 资源文件下载（并发 + 进度上报）
    assets::download_assets(
        app,
        instance_id,
        &client,
        &manifest,
        global_mc_root,
        cancel,
    )
    .await?;

    Ok(())
}

