use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::dependencies::scheduler::sha1_file;
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

const RETRY_DELAY_MS: u64 = 1200;

fn build_download_client(dl_settings: &DownloadSettings) -> AppResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
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

fn read_cached_manifest(manifest_path: &Path) -> Option<serde_json::Value> {
    let content = fs::read_to_string(manifest_path).ok()?;
    serde_json::from_str(&content).ok()
}

async fn fetch_manifest_with_retry(
    client: &reqwest::Client,
    manifest_urls: &[String],
    manifest_path: &Path,
    max_attempts: u32,
) -> AppResult<String> {
    let attempts = max_attempts.max(1).min(3);
    let mut last_error: Option<String> = None;

    for attempt in 1..=attempts {
        for manifest_url in manifest_urls {
            match client.get(manifest_url).send().await {
                Ok(resp) if resp.status().is_success() => {
                    let manifest_text = resp.text().await?;
                    if let Some(parent) = manifest_path.parent() {
                        let _ = fs::create_dir_all(parent);
                    }
                    let _ = fs::write(manifest_path, &manifest_text);
                    return Ok(manifest_text);
                }
                Ok(resp) if resp.status().as_u16() == 429 || resp.status().is_server_error() => {
                    last_error = Some(format!("{} from {}", resp.status(), manifest_url));
                }
                Ok(resp) => {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        format!("Failed to fetch version list: {}", resp.status()),
                    )
                    .into());
                }
                Err(err) => {
                    last_error = Some(format!("{} from {}", err, manifest_url));
                }
            }
        }

        if attempt < attempts {
            tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * attempt as u64)).await;
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::Other,
        format!(
            "Failed to fetch version list: {}",
            last_error.unwrap_or_else(|| "unknown error".to_string())
        ),
    )
    .into())
}

pub async fn install_vanilla_core<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let client = build_download_client(&dl_settings)?;
    let max_attempts = dl_settings.retry_count.max(1);
    let stall_timeout = ConfigService::stall_timeout(&dl_settings);
    let runtime_dir = global_mc_root.join("runtime");
    let manifest_cache_path = runtime_dir.join("version_manifest_v2.json");
    let _ = fs::create_dir_all(&runtime_dir);

    let version_dir = global_mc_root.join("versions").join(version_id);
    fs::create_dir_all(&version_dir)?;

    let json_path = version_dir.join(format!("{}.json", version_id));
    let jar_path = version_dir.join(format!("{}.jar", version_id));

    let need_download = if json_path.exists() {
        let content = fs::read_to_string(&json_path).unwrap_or_default();
        serde_json::from_str::<serde_json::Value>(&content).is_err()
    } else {
        true
    };

    if need_download {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: format!("{}.json", version_id),
                current: 10,
                total: 100,
                message: "Fetching version manifest...".to_string(),
            },
        );

        let manifest_url = if dl_settings.vanilla_source == "official" {
            vec![
                "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json".to_string(),
                "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json".to_string(),
            ]
        } else {
            vec![
                format!(
                    "{}/mc/game/version_manifest_v2.json",
                    dl_settings.vanilla_source_url
                ),
                "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json".to_string(),
            ]
        };

        let mut manifest_res: Option<serde_json::Value> =
            read_cached_manifest(&manifest_cache_path);
        let mut version_url = manifest_res
            .as_ref()
            .and_then(|manifest| manifest["versions"].as_array())
            .and_then(|versions| {
                versions
                    .iter()
                    .find(|v| v["id"].as_str().unwrap_or("") == version_id)
                    .and_then(|v| v["url"].as_str())
                    .map(|url| url.to_string())
            });

        if version_url.is_none() {
            let manifest_text = fetch_manifest_with_retry(
                &client,
                &manifest_url,
                &manifest_cache_path,
                dl_settings.retry_count.max(1),
            )
            .await?;
            let parsed: serde_json::Value = serde_json::from_str(&manifest_text).map_err(|e| {
                std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    format!("Failed to parse version list: {}", e),
                )
            })?;

            version_url = parsed["versions"].as_array().and_then(|versions| {
                versions
                    .iter()
                    .find(|v| v["id"].as_str().unwrap_or("") == version_id)
                    .and_then(|v| v["url"].as_str())
                    .map(|url| url.to_string())
            });
            manifest_res = Some(parsed);
        }

        let _manifest_res = manifest_res.ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid version list format",
            )
        })?;

        let version_url = version_url.ok_or_else(|| {
            std::io::Error::new(std::io::ErrorKind::NotFound, "Target version URL not found")
        })?;

        let mirror_url = if dl_settings.vanilla_source == "official" {
            version_url.to_string()
        } else {
            version_url.replace(
                "https://piston-meta.mojang.com",
                &dl_settings.vanilla_source_url,
            )
        };

        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let res = client.get(&mirror_url).send().await?;
        if !res.status().is_success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!(
                    "Failed to download version manifest {}: {}",
                    version_id,
                    res.status()
                ),
            )
            .into());
        }
        let version_json_text = res.text().await?;
        fs::write(&json_path, &version_json_text)?;
    }

    let json_content = fs::read_to_string(&json_path)?;
    let parsed_json: serde_json::Value = serde_json::from_str(&json_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("Failed to parse version JSON: {}", e),
        )
    })?;

    let expected_sha1 = parsed_json["downloads"]["client"]["sha1"]
        .as_str()
        .map(|s| s.to_lowercase());

    if jar_path.exists() {
        if let Some(ref exp) = expected_sha1 {
            if let Ok(actual) = sha1_file(&jar_path).await {
                if actual == *exp {
                    return Ok(());
                }
            }
            let _ = fs::remove_file(&jar_path);
        } else {
            return Ok(());
        }
    }

    let jar_url = parsed_json["downloads"]["client"]["url"]
        .as_str()
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "Missing client URL in version JSON",
            )
        })?;

    let mirror_jar_url = if dl_settings.vanilla_source == "official" {
        jar_url.to_string()
    } else {
        jar_url.replace(
            "https://piston-data.mojang.com",
            &dl_settings.vanilla_source_url,
        )
    };

    let temp_jar_path = version_dir.join(format!("{}.jar.download", version_id));
    let candidate_urls = if mirror_jar_url == jar_url {
        vec![mirror_jar_url.clone()]
    } else {
        vec![mirror_jar_url.clone(), jar_url.to_string()]
    };
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);
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

    let mut success = false;
    let mut last_error: Option<String> = None;

    for attempt in 1..=max_attempts {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: format!("{}.jar", version_id),
                current: if attempt > 1 { 50 } else { 30 },
                total: 100,
                message: if attempt > 1 {
                    format!("Download failed, retrying ({}/{})", attempt, max_attempts)
                } else {
                    "Downloading game core...".to_string()
                },
            },
        );

        let _ = tokio::fs::remove_file(&temp_jar_path).await;

        let download_result = match download_file(
            &client,
            &candidate_urls,
            &temp_jar_path,
            tuning,
            stall_timeout,
            cancel,
            rate_limiter.clone(),
            None,
        )
        .await
        {
            Ok(result) => result,
            Err(err) => {
                last_error = Some(err.to_string());
                if attempt < max_attempts {
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * (1u64 << attempt.min(5)))).await;
                }
                continue;
            }
        };

        if let Some(ref exp) = expected_sha1 {
            let actual = sha1_file(&temp_jar_path).await.unwrap_or_default();
            if actual != *exp {
                last_error = Some(format!("sha1 mismatch (expected {}, got {})", exp, actual));
                let _ = fs::remove_file(&temp_jar_path);
                if attempt < max_attempts {
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * (1u64 << attempt.min(5)))).await;
                }
                continue;
            }
        }

        if jar_path.exists() {
            let _ = fs::remove_file(&jar_path);
        }

        if let Err(e) = fs::rename(&temp_jar_path, &jar_path) {
            last_error = Some(format!("rename failed: {}", e));
            let _ = fs::remove_file(&temp_jar_path);
            if attempt < max_attempts {
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS * (1u64 << attempt.min(5)))).await;
            }
            continue;
        }

        let final_total = download_result.total_bytes.max(1);
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: format!("{}.jar", version_id),
                current: final_total,
                total: final_total,
                message: "Downloading game core...".to_string(),
            },
        );

        success = true;
        break;
    }

    if !success {
        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!(
                "Failed to download game core after {} attempts{}",
                max_attempts,
                last_error.map(|e| format!(": {}", e)).unwrap_or_default()
            ),
        )
        .into());
    }

    Ok(())
}
