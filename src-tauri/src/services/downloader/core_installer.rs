// src-tauri/src/services/downloader/core_installer.rs
use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use sha1::{Digest, Sha1};
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncWriteExt;
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;

const PROGRESS_EMIT_INTERVAL_MS: u64 = 200;
const MAX_JAR_RETRIES: u32 = 2;

fn sha1_hex(bytes: &[u8]) -> String {
    let digest = Sha1::digest(bytes);
    digest.iter().map(|b| format!("{:02x}", b)).collect::<String>()
}

pub async fn install_vanilla_core<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let client = reqwest::Client::new();
    let version_dir = global_mc_root.join("versions").join(version_id);
    fs::create_dir_all(&version_dir)?;

    let json_path = version_dir.join(format!("{}.json", version_id));
    let jar_path = version_dir.join(format!("{}.jar", version_id));

    let dl_settings = ConfigService::get_download_settings(app);

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
                message: "正在获取版本清单...".to_string(),
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
                format!("获取版本列表失败: {}", manifest_res_raw.status()),
            )
            .into());
        }
        let manifest_res: serde_json::Value = manifest_res_raw.json().await?;

        let version_url = manifest_res["versions"]
            .as_array()
            .unwrap()
            .iter()
            .find(|v| v["id"].as_str().unwrap_or("") == version_id)
            .and_then(|v| v["url"].as_str())
            .ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "未找到目标版本 URL")
            })?;

        let mirror_url = if dl_settings.vanilla_source == "official" {
            version_url.to_string()
        } else {
            version_url.replace("https://piston-meta.mojang.com", &dl_settings.vanilla_source_url)
        };

        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let res = client.get(&mirror_url).send().await?;
        if !res.status().is_success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("下载版本清单 {} 失败: {}", version_id, res.status()),
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
            format!("解析版本 JSON 失败: {}", e),
        )
    })?;

    let expected_sha1 = parsed_json["downloads"]["client"]["sha1"]
        .as_str()
        .map(|s| s.to_lowercase());

    // 已有 jar 且无需校验，或校验通过则跳过
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

    let jar_url = parsed_json["downloads"]["client"]["url"].as_str().ok_or_else(|| {
        std::io::Error::new(std::io::ErrorKind::NotFound, "JSON 中无客户端 URL")
    })?;

    let mirror_jar_url = if dl_settings.vanilla_source == "official" {
        jar_url.to_string()
    } else {
        jar_url.replace("https://piston-data.mojang.com", &dl_settings.vanilla_source_url)
    };

    let mut attempt = 0u32;
    loop {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: format!("{}.jar", version_id),
                current: if attempt > 0 { 50 } else { 30 },
                total: 100,
                message: if attempt > 0 {
                    format!(
                        "SHA1 校验失败，正在重新下载 ({}/{} 次)",
                        attempt, MAX_JAR_RETRIES
                    )
                } else {
                    "正在下载游戏核心...".to_string()
                },
            },
        );

        let mut response = client.get(&mirror_jar_url).send().await?;
        if !response.status().is_success() {
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("下载游戏核心失败: {}", response.status()),
            )
            .into());
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;
        let mut file = tokio::fs::File::create(&jar_path).await?;
        let mut last_emit = Instant::now();

        while let Some(chunk) = response.chunk().await.map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("流式下载失败: {}", e))
        })? {
            if is_cancelled(cancel) {
                drop(file);
                let _ = tokio::fs::remove_file(&jar_path).await;
                return Err(AppError::Cancelled);
            }
            file.write_all(&chunk).await?;
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
                        message: "正在下载游戏核心...".to_string(),
                    },
                );
                last_emit = Instant::now();
            }
        }
        file.flush().await?;
        drop(file);

        if let Some(ref exp) = expected_sha1 {
            let content = fs::read(&jar_path)?;
            let actual = sha1_hex(&content);
            if actual != *exp {
                let _ = fs::remove_file(&jar_path);
                attempt += 1;
                if attempt > MAX_JAR_RETRIES {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::InvalidData,
                        format!(
                            "游戏核心 SHA1 校验失败（已重试 {} 次），期望 {}，实际 {}",
                            MAX_JAR_RETRIES, exp, actual
                        ),
                    )
                    .into());
                }
                continue;
            }
        }

        break;
    }

    Ok(())
}
