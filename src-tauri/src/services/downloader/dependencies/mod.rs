use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;

mod assets;
mod game_core;
mod libraries;
mod mirror;
mod progress;
pub mod scheduler;

pub use assets::download_assets;
pub use assets::download_assets_force_hash;
pub use game_core::load_version_manifest;
pub use libraries::download_libraries;
pub use libraries::download_libraries_force_hash;
pub use progress::DownloadStage;
pub use scheduler::{run_downloads, sha1_file, DownloadTask};

fn build_download_client(dl_settings: &DownloadSettings) -> AppResult<Client> {
    let mut builder = Client::builder()
        .user_agent("PiLauncher/1.0 (Minecraft Launcher)")
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)));

    if dl_settings.proxy_type != "none" {
        let host = dl_settings.proxy_host.trim();
        let port = dl_settings.proxy_port.trim();
        if !host.is_empty() && !port.is_empty() {
            let scheme = match dl_settings.proxy_type.as_str() {
                "http" => "http",
                "https" => "https",
                "socks5" => "socks5h",
                _ => "http",
            };
            let proxy_url = format!("{}://{}:{}", scheme, host, port);
            builder = builder.proxy(reqwest::Proxy::all(&proxy_url)?);
        }
    }

    Ok(builder.build()?)
}

async fn download_dependencies_inner<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
    force_verify_hash: bool,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let client = build_download_client(&dl_settings)?;

    let manifest = game_core::load_version_manifest(global_mc_root, version_id).await?;

    if force_verify_hash {
        libraries::download_libraries_force_hash(
            app,
            instance_id,
            &client,
            &manifest,
            global_mc_root,
            cancel,
        )
        .await?;
    } else {
        libraries::download_libraries(app, instance_id, &client, &manifest, global_mc_root, cancel)
            .await?;
    }

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    if force_verify_hash {
        assets::download_assets_force_hash(
            app,
            instance_id,
            &client,
            &manifest,
            global_mc_root,
            cancel,
        )
        .await?;
    } else {
        assets::download_assets(app, instance_id, &client, &manifest, global_mc_root, cancel)
            .await?;
    }

    Ok(())
}

pub async fn download_dependencies<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    download_dependencies_inner(app, instance_id, version_id, global_mc_root, cancel, false).await
}

pub async fn download_dependencies_force_hash<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    download_dependencies_inner(app, instance_id, version_id, global_mc_root, cancel, true).await
}
