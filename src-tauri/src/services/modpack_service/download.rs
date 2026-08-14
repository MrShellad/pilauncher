use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::ServerBinding;
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel;
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use reqwest::Client;
use serde::Serialize;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

use super::logging::ModpackImportLogger;
use super::logic::validate_instance_id_from_name;
use super::ops::resolve_base_dir;
use super::orchestrator::{execute_import, execute_import_with_logger};

fn build_modpack_download_client(dl_settings: &DownloadSettings) -> Result<Client, String> {
    let mut builder = Client::builder()
        .user_agent("PiLauncher/1.0 (Modpack)")
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
            builder =
                builder.proxy(reqwest::Proxy::all(&proxy_url).map_err(|error| error.to_string())?);
        }
    }

    builder.build().map_err(|error| error.to_string())
}

fn normalize_modpack_download_url(url: &str) -> String {
    url.trim().replace(' ', "%20")
}

fn file_name_from_url(url: &str) -> String {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|parsed| {
            parsed
                .path_segments()
                .and_then(|segments| segments.last())
                .map(|name| name.to_string())
        })
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "modpack.zip".to_string())
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModpackDeploymentAccepted {
    pub task_id: String,
    pub instance_id: String,
    pub instance_name: String,
}

pub fn start_import<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) -> Result<ModpackDeploymentAccepted, String> {
    let instance_id = validate_instance_id_from_name(&instance_name)?;
    let cancel = deployment_cancel::try_register(&instance_id)?;
    let accepted = ModpackDeploymentAccepted {
        task_id: instance_id.clone(),
        instance_id: instance_id.clone(),
        instance_name: instance_name.clone(),
    };

    tauri::async_runtime::spawn(async move {
        let result = execute_import(&app, &zip_path, &instance_name, &cancel, server_binding).await;
        deployment_cancel::unregister(&instance_id);

        if let Err(error) = result {
            eprintln!("Modpack import failed: {}", error);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id,
                    stage: "ERROR".to_string(),
                    file_name: String::new(),
                    current: 0,
                    total: 100,
                    message: format!("Import interrupted: {}", error),
                },
            );
        }
    });

    Ok(accepted)
}

pub fn download_and_import_modpack<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) -> Result<ModpackDeploymentAccepted, String> {
    let instance_id = validate_instance_id_from_name(&instance_name)?;
    let base_dir = resolve_base_dir(&app)?;
    let cancel = deployment_cancel::try_register(&instance_id)?;
    let accepted = ModpackDeploymentAccepted {
        task_id: instance_id.clone(),
        instance_id: instance_id.clone(),
        instance_name: instance_name.clone(),
    };

    tauri::async_runtime::spawn(async move {
        let logger = ModpackImportLogger::new(&base_dir, &instance_id);
        logger
            .info(
                "DOWNLOAD_MODPACK",
                format!(
                    "Starting remote modpack import: instance_id={} instance_name={} url={}",
                    instance_id, instance_name, url
                ),
            )
            .await;

        let dl_settings = ConfigService::get_download_settings(&app);
        let client = match build_modpack_download_client(&dl_settings) {
            Ok(client) => client,
            Err(error) => {
                logger
                    .error(
                        "DOWNLOAD_MODPACK",
                        format!("Download client init failed: {}", error),
                    )
                    .await;
                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: instance_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: String::new(),
                        current: 0,
                        total: 100,
                        message: format!("Modpack download client init failed: {}", error),
                    },
                );
                deployment_cancel::unregister(&instance_id);
                return;
            }
        };

        let normalized_url = normalize_modpack_download_url(&url);
        let file_name = file_name_from_url(&normalized_url);
        let max_attempts = dl_settings.retry_count.max(1);
        logger
            .info(
                "DOWNLOAD_MODPACK",
                format!(
                    "Download prepared: normalized_url={} file_name={} attempts={} timeout={}s",
                    normalized_url, file_name, max_attempts, dl_settings.timeout
                ),
            )
            .await;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.clone(),
                stage: "DOWNLOADING_MODPACK".to_string(),
                file_name: "modpack.zip".to_string(),
                current: 0,
                total: 100,
                message: "Downloading modpack archive...".to_string(),
            },
        );

        let archive_dir = base_dir
            .join("temp")
            .join("modpack")
            .join("archives")
            .join(uuid::Uuid::new_v4().to_string());
        if let Err(error) = std::fs::create_dir_all(&archive_dir) {
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.clone(),
                    stage: "ERROR".to_string(),
                    file_name: String::new(),
                    current: 0,
                    total: 100,
                    message: format!("Failed to create temporary archive directory: {}", error),
                },
            );
            deployment_cancel::unregister(&instance_id);
            return;
        }
        let temp_path = archive_dir.join("archive.zip");
        let candidate_urls = vec![normalized_url.clone()];
        let speed_limit_bytes_per_sec =
            ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);
        let rate_limiter = if speed_limit_bytes_per_sec > 0 {
            Some(Arc::new(DownloadRateLimiter::new(
                speed_limit_bytes_per_sec,
            )))
        } else {
            None
        };
        let tuning = DownloadTuning {
            chunked_enabled: dl_settings.chunked_download_enabled,
            chunked_threads: dl_settings.chunked_download_threads.max(1),
            chunked_threshold_bytes: ConfigService::chunked_download_min_size_bytes(&dl_settings),
        };
        let mut download_result = None;
        let mut last_error: Option<String> = None;

        for attempt in 1..=max_attempts {
            if deployment_cancel::is_cancelled(&cancel) {
                last_error = Some("Cancelled".to_string());
                break;
            }
            logger
                .info(
                    "DOWNLOAD_MODPACK",
                    format!("Downloading archive attempt {}/{}", attempt, max_attempts),
                )
                .await;
            match download_file(
                &client,
                &candidate_urls,
                &temp_path,
                tuning,
                Duration::from_secs(dl_settings.timeout.max(1)),
                &cancel,
                rate_limiter.clone(),
                None,
                Some(&app),
                Some(&instance_id),
                Some("DOWNLOADING_MODPACK"),
            )
            .await
            {
                Ok(result) => {
                    logger
                        .info(
                            "DOWNLOAD_MODPACK",
                            format!(
                                "Archive download completed: bytes={} temp_path={}",
                                result.downloaded_bytes,
                                temp_path.display()
                            ),
                        )
                        .await;
                    download_result = Some(result);
                    break;
                }
                Err(error) => {
                    last_error = Some(error.to_string());
                    logger
                        .warn(
                            "DOWNLOAD_MODPACK",
                            format!(
                                "Archive download attempt {}/{} failed: {}",
                                attempt, max_attempts, error
                            ),
                        )
                        .await;
                    if attempt < max_attempts {
                        tokio::time::sleep(Duration::from_millis(800 * attempt as u64)).await;
                    }
                }
            }
        }

        let Some(download_result) = download_result else {
            logger
                .error(
                    "DOWNLOAD_MODPACK",
                    format!(
                        "Archive download failed: {}",
                        last_error
                            .clone()
                            .unwrap_or_else(|| "unknown error".to_string())
                    ),
                )
                .await;
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.clone(),
                    stage: "ERROR".to_string(),
                    file_name: String::new(),
                    current: 0,
                    total: 100,
                    message: format!(
                        "Modpack download request failed: {}",
                        last_error.unwrap_or_else(|| "unknown error".to_string())
                    ),
                },
            );
            let _ = std::fs::remove_dir_all(&archive_dir);
            deployment_cancel::unregister(&instance_id);
            return;
        };

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.clone(),
                stage: "DOWNLOADING_MODPACK".to_string(),
                file_name: file_name.clone(),
                current: download_result.total_bytes.max(1),
                total: download_result.total_bytes.max(1),
                message: "Modpack archive downloaded, preparing installation...".to_string(),
            },
        );

        let temp_path_string = temp_path.to_string_lossy().to_string();
        let result = execute_import_with_logger(
            &app,
            &temp_path_string,
            &instance_name,
            &cancel,
            server_binding,
            logger.clone(),
        )
        .await;
        deployment_cancel::unregister(&instance_id);

        if let Err(error) = result {
            eprintln!("Modpack deployment failed: {}", error);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id,
                    stage: "ERROR".to_string(),
                    file_name: String::new(),
                    current: 0,
                    total: 100,
                    message: format!("Deployment interrupted: {}", error),
                },
            );
        }

        match std::fs::remove_file(&temp_path) {
            Ok(()) => {
                logger
                    .info(
                        "DOWNLOAD_MODPACK",
                        format!("Removed temporary archive {}", temp_path.display()),
                    )
                    .await;
            }
            Err(error) => {
                logger
                    .warn(
                        "DOWNLOAD_MODPACK",
                        format!(
                            "Failed to remove temporary archive {}: {}",
                            temp_path.display(),
                            error
                        ),
                    )
                    .await;
            }
        }
        let _ = std::fs::remove_dir_all(&archive_dir);
    });

    Ok(accepted)
}
