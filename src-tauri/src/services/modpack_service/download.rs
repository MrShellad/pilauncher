use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::ServerBinding;
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel;
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use reqwest::Client;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

use super::logic::sanitize_instance_id;
use super::orchestrator::execute_import;

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

pub fn start_import<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) {
    tauri::async_runtime::spawn(async move {
        let instance_id = sanitize_instance_id(&instance_name);
        let cancel = deployment_cancel::register(&instance_id);
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
}

pub fn download_and_import_modpack<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) {
    tauri::async_runtime::spawn(async move {
        let instance_id = sanitize_instance_id(&instance_name);

        let dl_settings = ConfigService::get_download_settings(&app);
        let client = match build_modpack_download_client(&dl_settings) {
            Ok(client) => client,
            Err(error) => {
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
                return;
            }
        };

        let normalized_url = normalize_modpack_download_url(&url);
        let file_name = file_name_from_url(&normalized_url);
        let max_attempts = dl_settings.retry_count.max(1);

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

        let temp_path = std::env::temp_dir().join(&file_name);
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
        let no_cancel = Arc::new(AtomicBool::new(false));
        let mut download_result = None;
        let mut last_error: Option<String> = None;

        for attempt in 1..=max_attempts {
            match download_file(
                &client,
                &candidate_urls,
                &temp_path,
                tuning,
                Duration::from_secs(dl_settings.timeout.max(1)),
                &no_cancel,
                rate_limiter.clone(),
                None,
            )
            .await
            {
                Ok(result) => {
                    download_result = Some(result);
                    break;
                }
                Err(error) => {
                    last_error = Some(error.to_string());
                    if attempt < max_attempts {
                        tokio::time::sleep(Duration::from_millis(800 * attempt as u64)).await;
                    }
                }
            }
        }

        let Some(download_result) = download_result else {
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

        let cancel = deployment_cancel::register(&instance_id);
        let result = execute_import(
            &app,
            &temp_path.to_string_lossy(),
            &instance_name,
            &cancel,
            server_binding,
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

        let _ = std::fs::remove_file(temp_path);
    });
}
