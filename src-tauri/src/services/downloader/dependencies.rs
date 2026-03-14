// src-tauri/src/services/downloader/dependencies.rs
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Mutex;

use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;

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

    let json_path = global_mc_root
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    let json_content = tokio::fs::read_to_string(&json_path).await?;
    let manifest: Value = serde_json::from_str(&json_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("解析版本清单 JSON 失败: {}", e),
        )
    })?;

    download_libraries(app, instance_id, &client, &manifest, global_mc_root, cancel).await?;
    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }
    download_assets(app, instance_id, &client, &manifest, global_mc_root, cancel).await?;

    Ok(())
}

async fn download_libraries<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();
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

    if let Some(libraries) = manifest["libraries"].as_array() {
        for lib in libraries {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() {
                continue;
            }

            let mut dl_url = String::new();
            let mut dl_path = String::new();
            let mut expected_size: Option<u64> = None;

            if let Some(artifact) = lib.pointer("/downloads/artifact") {
                if let Some(p) = artifact["path"].as_str() {
                    dl_path = p.to_string();
                }
                if let Some(u) = artifact["url"].as_str() {
                    dl_url = u.to_string();
                }
                expected_size = artifact["size"].as_u64();
            } else {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group = parts[0].replace('.', "/");
                    let artifact = parts[1];
                    let version = parts[2];
                    dl_path = format!(
                        "{}/{}/{}/{}-{}.jar",
                        group, artifact, version, artifact, version
                    );
                    let base_url = lib["url"]
                        .as_str()
                        .unwrap_or("https://libraries.minecraft.net/");
                    let mut base = base_url.to_string();
                    if !base.ends_with('/') {
                        base.push('/');
                    }
                    dl_url = format!("{}{}", base, dl_path);
                }
            }

            if dl_url.is_empty() || dl_path.is_empty() {
                continue;
            }

            let target_path = global_mc_root.join("libraries").join(&dl_path);

            if target_path.exists() {
                if let Some(s) = expected_size {
                    if target_path.metadata().map(|m| m.len()).unwrap_or(0) == s {
                        continue;
                    }
                } else {
                    continue;
                }
            }

            // ✅ 统一路由：所有原版、Fabric、Forge、NeoForge 的底层库统统被 BMCLAPI 包含！
            let mirror_url = if dl_settings.vanilla_source == "official" {
                dl_url.clone()
            } else {
                dl_url
                    .replace(
                        "https://libraries.minecraft.net",
                        "https://bmclapi2.bangbang93.com/maven",
                    )
                    .replace(
                        "https://maven.fabricmc.net/",
                        "https://bmclapi2.bangbang93.com/maven/",
                    )
                    .replace(
                        "https://maven.minecraftforge.net/",
                        "https://bmclapi2.bangbang93.com/maven/",
                    )
                    .replace(
                        "https://maven.neoforged.net/releases/",
                        "https://bmclapi2.bangbang93.com/maven/",
                    )
            };

            tasks.push((mirror_url, target_path, name.to_string()));
        }
    }

    let total = tasks.len() as u64;
    if total == 0 {
        return Ok(());
    }

    let cancelled_flag = Arc::new(tokio::sync::Mutex::new(false));
    let completed: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));
    let fetches = iter(tasks)
        .map(|(url, path, name): (String, PathBuf, String)| {
            let client = client.clone();
            let app = app.clone();
            let completed = Arc::clone(&completed);
            let i_id = instance_id.to_string();
            let limit = limit_per_thread;
            let cancel = Arc::clone(cancel);
            let cancelled_flag = Arc::clone(&cancelled_flag);
            async move {
                // 检查取消标志，跳过后续任务
                if is_cancelled(&cancel) {
                    *cancelled_flag.lock().await = true;
                    return;
                }
                if let Some(parent) = path.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                match client.get(&url).send().await {
                    Ok(mut res) => {
                        if res.status().is_success() {
                            let mut file_data = Vec::new();
                            while let Ok(Some(chunk)) = res.chunk().await {
                                if is_cancelled(&cancel) {
                                    return;
                                }
                                file_data.extend_from_slice(&chunk);
                                if limit > 0 {
                                    tokio::time::sleep(std::time::Duration::from_secs_f64(
                                        chunk.len() as f64 / limit as f64,
                                    ))
                                    .await;
                                }
                            }
                            if !is_cancelled(&cancel) {
                                let _ = tokio::fs::write(&path, file_data).await;
                            }
                        } else {
                            eprintln!(
                                "[Downloader ERROR] 库 HTTP 拒绝 (状态码: {}) -> {}",
                                res.status(),
                                url
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("[Downloader ERROR] 库网络异常 -> {}: {}", url, e);
                    }
                }
                let mut c = completed.lock().await;
                *c += 1;
                if *c % 10 == 0 || *c == total {
                    let _ = app.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: i_id,
                            stage: "LIBRARIES".to_string(),
                            file_name: name,
                            current: *c,
                            total,
                            message: format!("正在下载依赖库 ({}/{})", *c, total),
                        },
                    );
                }
            }
        })
        .buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }
    Ok(())
}

async fn download_assets<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &Path,
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

        let mirror_url = if dl_settings.vanilla_source == "official" {
            index_url.to_string()
        } else {
            index_url.replace(
                "https://launchermeta.mojang.com",
                &dl_settings.vanilla_source_url,
            )
        };

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
    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();

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
            if target_path.exists() && target_path.metadata().map(|m| m.len()).unwrap_or(0) == size
            {
                continue;
            }

            let url = if dl_settings.vanilla_source == "official" {
                format!(
                    "https://resources.download.minecraft.net/{}/{}",
                    prefix, hash
                )
            } else {
                format!(
                    "{}/assets/{}/{}",
                    dl_settings.vanilla_source_url, prefix, hash
                )
            };
            tasks.push((url, target_path, name.clone()));
        }
    }

    let total = tasks.len() as u64;
    if total == 0 {
        return Ok(());
    }

    let completed: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));
    let fetches = iter(tasks)
        .map(|(url, path, name): (String, PathBuf, String)| {
            let client = client.clone();
            let app = app.clone();
            let completed = Arc::clone(&completed);
            let i_id = instance_id.to_string();
            let limit = limit_per_thread;
            let cancel = Arc::clone(cancel);
            async move {
                if is_cancelled(&cancel) {
                    return;
                }
                if let Some(parent) = path.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }
                match client.get(&url).send().await {
                    Ok(mut res) => {
                        if res.status().is_success() {
                            let mut file_data = Vec::new();
                            while let Ok(Some(chunk)) = res.chunk().await {
                                if is_cancelled(&cancel) {
                                    return;
                                }
                                file_data.extend_from_slice(&chunk);
                                if limit > 0 {
                                    tokio::time::sleep(std::time::Duration::from_secs_f64(
                                        chunk.len() as f64 / limit as f64,
                                    ))
                                    .await;
                                }
                            }
                            if !is_cancelled(&cancel) {
                                let _ = tokio::fs::write(&path, file_data).await;
                            }
                        }
                    }
                    Err(_) => {}
                }
                let mut c = completed.lock().await;
                *c += 1;
                if *c % 50 == 0 || *c == total {
                    let _ = app.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: i_id,
                            stage: "ASSETS".to_string(),
                            file_name: name,
                            current: *c,
                            total,
                            message: format!("正在下载游戏资源 ({}/{})", *c, total),
                        },
                    );
                }
            }
        })
        .buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }
    Ok(())
}
