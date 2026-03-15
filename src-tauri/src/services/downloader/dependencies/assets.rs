use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use reqwest::Client;
use serde_json::Value;
use tauri::{AppHandle, Runtime};

use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;

use super::mirror::{route_asset_object_url, route_assets_index_url};
use super::progress::DownloadStage;
use super::scheduler::{run_downloads, DownloadTask};

/// 资源部分：负责下载资源索引以及 assets 对象
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

        let mirror_url = route_assets_index_url(index_url, &dl_settings);

        if let Ok(res) = client.get(&mirror_url).send().await {
            if res.status().is_success() {
                if let Ok(text) = res.text().await {
                    let _ = tokio::fs::write(&index_path, text).await;
                }
            } else {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("下载资源索引失败: {}", res.status()),
                )
                .into());
            }
        }
    }

    if !index_path.exists() {
        return Ok(());
    }

    let index_content = tokio::fs::read_to_string(&index_path).await?;
    let index_json: Value = serde_json::from_str(&index_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("解析资源索引 JSON 失败: {}", e),
        )
    })?;

    let mut tasks: Vec<DownloadTask> = Vec::new();

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
            if target_path.exists()
                && target_path
                    .metadata()
                    .map(|m| m.len())
                    .unwrap_or(0)
                    == size
            {
                continue;
            }

            let url = route_asset_object_url(prefix, hash, &dl_settings);

            tasks.push(DownloadTask {
                url,
                path: target_path,
                name: name.clone(),
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
        cancel,
    )
    .await
}

