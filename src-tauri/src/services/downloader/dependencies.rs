// src-tauri/src/services/downloader/dependencies.rs
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Mutex;

use crate::domain::event::DownloadProgressEvent;
use crate::domain::minecraft_json::{AssetIndexJson, VersionManifestJson};
use crate::error::AppResult;
use crate::services::config_service::ConfigService; // ✅ 引入设置服务

pub async fn download_dependencies<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    let client = Client::builder().user_agent("OreLauncher/1.0").build()?;

    let json_path = global_mc_root
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    let json_content = fs::read_to_string(&json_path)?;
    let manifest: VersionManifestJson = serde_json::from_str(&json_content)?;

    download_libraries(app, instance_id, &client, &manifest, global_mc_root).await?;
    download_assets(app, instance_id, &client, &manifest, global_mc_root).await?;

    Ok(())
}

async fn download_libraries<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &VersionManifestJson,
    global_mc_root: &Path,
) -> AppResult<()> {
    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();

    // ✅ 读取配置
    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 { dl_settings.concurrency } else { 16 };
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    for lib in &manifest.libraries {
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let target_path = global_mc_root.join("libraries").join(&artifact.path);

                if target_path.exists()
                    && target_path.metadata().map(|m| m.len()).unwrap_or(0) == artifact.size
                {
                    continue;
                }
                
                // 依据用户设置的源动态替换 (这里以 bmclapi 为例处理)
                let mirror_url = if dl_settings.source == "mcbbs" {
                    artifact.url.replace("https://libraries.minecraft.net", "https://download.mcbbs.net/maven")
                } else if dl_settings.source == "official" {
                    artifact.url.clone()
                } else {
                    artifact.url.replace("https://libraries.minecraft.net", "https://bmclapi2.bangbang93.com/maven")
                };

                tasks.push((mirror_url, target_path, lib.name.clone()));
            }
        }
    }

    let total = tasks.len() as u64;
    if total == 0 { return Ok(()); }

    let completed: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));

    let fetches = iter(tasks).map(|(url, path, name): (String, PathBuf, String)| {
        let client = client.clone();
        let app = app.clone();
        let completed = Arc::clone(&completed);
        let i_id = instance_id.to_string(); 
        let limit = limit_per_thread;

        async move {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if let Ok(mut res) = client.get(&url).send().await {
                if res.status().is_success() {
                    // ✅ 核心魔法：使用 chunk 流式传输 + 休眠，实现硬核的精准限速！
                    let mut file_data = Vec::new();
                    while let Ok(Some(chunk)) = res.chunk().await {
                        file_data.extend_from_slice(&chunk);
                        if limit > 0 {
                            let duration = std::time::Duration::from_secs_f64(chunk.len() as f64 / limit as f64);
                            tokio::time::sleep(duration).await;
                        }
                    }
                    let _ = fs::write(&path, file_data);
                }
            }

            let mut c = completed.lock().await;
            *c += 1;

            if *c % 20 == 0 || *c == total {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    instance_id: i_id, 
                    stage: "LIBRARIES".to_string(),
                    file_name: name,
                    current: *c,
                    total,
                    message: format!("正在下载依赖库 ({}/{})", *c, total),
                });
            }
        }
    }).buffer_unordered(concurrency); // ✅ 应用设置的并发数

    fetches.collect::<Vec<()>>().await;
    Ok(())
}

async fn download_assets<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &VersionManifestJson,
    global_mc_root: &Path,
) -> AppResult<()> {
    let index_meta = match &manifest.asset_index {
        Some(meta) => meta,
        None => return Ok(()),
    };

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 { dl_settings.concurrency } else { 16 };
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let index_dir = global_mc_root.join("assets").join("indexes");
    fs::create_dir_all(&index_dir)?;

    let index_path = index_dir.join(format!("{}.json", index_meta.id));

    if !index_path.exists() {
        let mirror_url = if dl_settings.source == "mcbbs" {
            index_meta.url.replace("https://launchermeta.mojang.com", "https://download.mcbbs.net")
        } else if dl_settings.source == "official" {
            index_meta.url.clone()
        } else {
            index_meta.url.replace("https://launchermeta.mojang.com", "https://bmclapi2.bangbang93.com")
        };
        let index_text = client.get(&mirror_url).send().await?.text().await?;
        fs::write(&index_path, &index_text)?;
    }

    let index_content = fs::read_to_string(&index_path)?;
    let index_json: AssetIndexJson = serde_json::from_str(&index_content)?;

    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();

    for (name, object) in index_json.objects {
        let hash = object.hash;
        let prefix = &hash[0..2];

        let target_path = global_mc_root.join("assets").join("objects").join(prefix).join(&hash);

        if target_path.exists() && target_path.metadata().map(|m| m.len()).unwrap_or(0) == object.size {
            continue;
        }

        let url = if dl_settings.source == "mcbbs" {
            format!("https://download.mcbbs.net/assets/{}/{}", prefix, hash)
        } else if dl_settings.source == "official" {
            format!("https://resources.download.minecraft.net/{}/{}", prefix, hash)
        } else {
            format!("https://bmclapi2.bangbang93.com/assets/{}/{}", prefix, hash)
        };
        
        tasks.push((url, target_path, name));
    }

    let total = tasks.len() as u64;
    if total == 0 { return Ok(()); }

    let completed: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));

    let fetches = iter(tasks).map(|(url, path, name): (String, PathBuf, String)| {
        let client = client.clone();
        let app = app.clone();
        let completed = Arc::clone(&completed);
        let i_id = instance_id.to_string(); 
        let limit = limit_per_thread;

        async move {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            if let Ok(mut res) = client.get(&url).send().await {
                if res.status().is_success() {
                    let mut file_data = Vec::new();
                    while let Ok(Some(chunk)) = res.chunk().await {
                        file_data.extend_from_slice(&chunk);
                        if limit > 0 {
                            let duration = std::time::Duration::from_secs_f64(chunk.len() as f64 / limit as f64);
                            tokio::time::sleep(duration).await;
                        }
                    }
                    let _ = fs::write(&path, file_data);
                }
            }

            let mut c = completed.lock().await;
            *c += 1;

            if *c % 20 == 0 || *c == total {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    instance_id: i_id, 
                    stage: "ASSETS".to_string(),
                    file_name: name,
                    current: *c,
                    total,
                    message: format!("正在下载游戏资源 ({}/{})", *c, total),
                });
            }
        }
    }).buffer_unordered(concurrency); // ✅ 队列应用配置

    fetches.collect::<Vec<()>>().await;
    Ok(())
}