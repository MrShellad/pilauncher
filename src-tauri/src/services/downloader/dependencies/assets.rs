use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde_json::Value;
use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;

use super::mirror::{route_asset_object_urls, route_assets_index_urls};
use super::progress::DownloadStage;
use super::scheduler::{run_downloads, sha1_file, DownloadTask};

async fn download_text_from_candidates(
    client: &Client,
    urls: &[String],
    retry_count: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<String> {
    let max_attempts = retry_count.max(1);
    let mut last_error = "unknown error".to_string();

    for _ in 0..max_attempts {
        for url in urls {
            if is_cancelled(cancel) {
                return Err(AppError::Cancelled);
            }

            match client.get(url).send().await {
                Ok(res) if res.status().is_success() => return Ok(res.text().await?),
                Ok(res) => {
                    last_error = format!("{} -> {}", url, res.status());
                }
                Err(err) => {
                    last_error = format!("{} -> {}", url, err);
                }
            }
        }
    }

    Err(std::io::Error::new(
        std::io::ErrorKind::Other,
        format!(
            "Failed to download assets index from all candidate sources: {}",
            last_error
        ),
    )
    .into())
}

pub async fn download_assets<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &std::path::Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let index_meta = &manifest["assetIndex"];
    if index_meta.is_null() {
        return Ok(());
    }

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        16
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let index_id = index_meta["id"].as_str().unwrap_or("");
    let index_url = index_meta["url"].as_str().unwrap_or("");
    if index_id.is_empty() || index_url.is_empty() {
        return Ok(());
    }

    let index_dir = global_mc_root.join("assets").join("indexes");
    tokio::fs::create_dir_all(&index_dir).await?;
    let index_path = index_dir.join(format!("{}.json", index_id));

    let need_download = if index_path.exists() {
        let content = tokio::fs::read_to_string(&index_path)
            .await
            .unwrap_or_default();
        serde_json::from_str::<serde_json::Value>(&content).is_err()
    } else {
        true
    };

    if need_download {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let candidate_urls = route_assets_index_urls(index_url, &dl_settings);
        let text =
            download_text_from_candidates(client, &candidate_urls, retry_count, cancel).await?;
        tokio::fs::write(&index_path, text).await?;
    }

    if !index_path.exists() {
        return Ok(());
    }

    let index_content = tokio::fs::read_to_string(&index_path).await?;
    let index_json: Value = serde_json::from_str(&index_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("Failed to parse assets index JSON: {}", e),
        )
    })?;

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let temp_root = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_root).await?;

    if let Some(objects) = index_json["objects"].as_object() {
        for (name, object) in objects {
            let hash = object["hash"].as_str().unwrap_or("");
            let size = object["size"].as_u64().unwrap_or(0);
            if hash.is_empty() {
                continue;
            }

            let prefix = &hash[0..2];
            let target_path = global_mc_root
                .join("assets")
                .join("objects")
                .join(prefix)
                .join(hash);
            if target_path.exists() {
                let size_matches = target_path.metadata().map(|m| m.len()).unwrap_or(0) == size;
                if size_matches {
                    if verify_hash {
                        if let Ok(actual) = sha1_file(&target_path).await {
                            if actual == hash.to_lowercase() {
                                continue;
                            }
                        }
                    } else {
                        continue;
                    }
                }
                let _ = tokio::fs::remove_file(&target_path).await;
            }

            let candidate_urls = route_asset_object_urls(prefix, hash, &dl_settings);
            if candidate_urls.is_empty() {
                continue;
            }
            let temp_path = temp_root
                .join("assets")
                .join("objects")
                .join(prefix)
                .join(hash);

            tasks.push(DownloadTask {
                url: candidate_urls[0].clone(),
                fallback_urls: candidate_urls.into_iter().skip(1).collect(),
                path: target_path,
                temp_path,
                name: name.clone(),
                expected_sha1: if verify_hash {
                    Some(hash.to_lowercase())
                } else {
                    None
                },
                expected_size: Some(size),
            });
        }
    }

    run_downloads(
        app,
        instance_id,
        client,
        tasks,
        DownloadStage::Assets,
        concurrency,
        limit_per_thread,
        retry_count,
        verify_hash,
        Duration::from_secs(dl_settings.timeout.max(1)),
        cancel,
    )
    .await
}
