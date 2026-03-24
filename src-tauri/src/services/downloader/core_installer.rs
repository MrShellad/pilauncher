use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;
use sha1::{Digest, Sha1};
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncWriteExt;

const PROGRESS_EMIT_INTERVAL_MS: u64 = 200;
const RETRY_DELAY_MS: u64 = 1200;

fn sha1_hex(bytes: &[u8]) -> String {
    let digest = Sha1::digest(bytes);
    digest
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>()
}

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
    let stall_timeout = Duration::from_secs(dl_settings.timeout.max(1));

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
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json".to_string()
        } else {
            format!(
                "{}/mc/game/version_manifest_v2.json",
                dl_settings.vanilla_source_url
            )
        };

        let manifest_res_raw = client.get(&manifest_url).send().await?;
        if !manifest_res_raw.status().is_success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!(
                    "Failed to fetch version list: {}",
                    manifest_res_raw.status()
                ),
            )
            .into());
        }
        let manifest_res: serde_json::Value = manifest_res_raw.json().await?;

        let versions = manifest_res["versions"].as_array().ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "Invalid version list format",
            )
        })?;

        let version_url = versions
            .iter()
            .find(|v| v["id"].as_str().unwrap_or("") == version_id)
            .and_then(|v| v["url"].as_str())
            .ok_or_else(|| {
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
            let content = fs::read(&jar_path)?;
            if sha1_hex(&content) == *exp {
                return Ok(());
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

        let _ = tokio::fs::remove_file(&jar_path).await;

        let mut response = match client.get(&mirror_jar_url).send().await {
            Ok(res) => res,
            Err(e) => {
                last_error = Some(format!("request failed: {}", e));
                if attempt < max_attempts {
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                }
                continue;
            }
        };

        if !response.status().is_success() {
            last_error = Some(format!("http status {}", response.status()));
            if attempt < max_attempts {
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
            }
            continue;
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&jar_path).await?;
        let mut last_emit = Instant::now();
        let mut stream_error: Option<String> = None;

        loop {
            let next_chunk = tokio::time::timeout(stall_timeout, response.chunk()).await;
            match next_chunk {
                Ok(Ok(Some(chunk))) => {
                    if is_cancelled(cancel) {
                        drop(file);
                        let _ = tokio::fs::remove_file(&jar_path).await;
                        return Err(AppError::Cancelled);
                    }

                    if let Err(e) = file.write_all(&chunk).await {
                        stream_error = Some(format!("write failed: {}", e));
                        break;
                    }
                    downloaded += chunk.len() as u64;

                    if last_emit.elapsed().as_millis() >= PROGRESS_EMIT_INTERVAL_MS as u128 {
                        let _ = app.emit(
                            "instance-deployment-progress",
                            DownloadProgressEvent {
                                instance_id: instance_id.to_string(),
                                stage: "VANILLA_CORE".to_string(),
                                file_name: format!("{}.jar", version_id),
                                current: downloaded,
                                total: total_size.max(1),
                                message: "Downloading game core...".to_string(),
                            },
                        );
                        last_emit = Instant::now();
                    }
                }
                Ok(Ok(None)) => break,
                Ok(Err(e)) => {
                    stream_error = Some(format!("stream failed: {}", e));
                    break;
                }
                Err(_) => {
                    stream_error =
                        Some(format!("download stalled for {}s", stall_timeout.as_secs()));
                    break;
                }
            }
        }

        file.flush().await?;
        drop(file);

        if let Some(err) = stream_error {
            last_error = Some(err);
            let _ = fs::remove_file(&jar_path);
            if attempt < max_attempts {
                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
            }
            continue;
        }

        if let Some(ref exp) = expected_sha1 {
            let content = fs::read(&jar_path)?;
            let actual = sha1_hex(&content);
            if actual != *exp {
                last_error = Some(format!("sha1 mismatch (expected {}, got {})", exp, actual));
                let _ = fs::remove_file(&jar_path);
                if attempt < max_attempts {
                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                }
                continue;
            }
        }

        let final_total = if total_size > 0 {
            total_size
        } else {
            downloaded.max(1)
        };
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
