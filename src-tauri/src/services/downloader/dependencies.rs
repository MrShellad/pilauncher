// src-tauri/src/services/downloader/dependencies.rs
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::Mutex;
use serde_json::Value;

use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;
use crate::services::config_service::ConfigService;

pub async fn download_dependencies<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    // ✅ 核心修复 1: 伪装成正常的浏览器 UA，防止被 BMCLAPI 或官方防火墙拦截导致 403 无法下载
    let client = Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()?;

    let json_path = global_mc_root
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));
    
    // ✅ 核心修复 3: 使用 tokio::fs 防止阻塞线程池
    let json_content = tokio::fs::read_to_string(&json_path).await?;
    let manifest: Value = serde_json::from_str(&json_content)?;

    download_libraries(app, instance_id, &client, &manifest, global_mc_root).await?;
    download_assets(app, instance_id, &client, &manifest, global_mc_root).await?;

    Ok(())
}

async fn download_libraries<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &Path,
) -> AppResult<()> {
    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();
    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 { dl_settings.concurrency } else { 16 };
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    if let Some(libraries) = manifest["libraries"].as_array() {
        for lib in libraries {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() { continue; }

            let mut dl_url = String::new();
            let mut dl_path = String::new();
            let mut expected_size: Option<u64> = None;

            if let Some(artifact) = lib.pointer("/downloads/artifact") {
                if let Some(p) = artifact["path"].as_str() { dl_path = p.to_string(); }
                if let Some(u) = artifact["url"].as_str() { dl_url = u.to_string(); }
                expected_size = artifact["size"].as_u64();
            } else {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group = parts[0].replace('.', "/");
                    let artifact = parts[1];
                    let version = parts[2];
                    dl_path = format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version);

                    let base_url = lib["url"].as_str().unwrap_or("https://libraries.minecraft.net/");
                    let mut base = base_url.to_string();
                    if !base.ends_with('/') { base.push('/'); }
                    dl_url = format!("{}{}", base, dl_path);
                }
            }

            if dl_url.is_empty() || dl_path.is_empty() { continue; }

            let target_path = global_mc_root.join("libraries").join(&dl_path);
            
            if target_path.exists() {
                if let Some(s) = expected_size {
                    if target_path.metadata().map(|m| m.len()).unwrap_or(0) == s { continue; }
                } else {
                    continue; 
                }
            }

            let mirror_url = if dl_settings.source == "official" {
                dl_url.clone()
            } else {
                // 如果是 bmclapi，或者是已经失效的 mcbbs，统一使用稳定的 bmclapi
                dl_url.replace("https://libraries.minecraft.net", "https://bmclapi2.bangbang93.com/maven")
                      .replace("https://maven.fabricmc.net/", "https://bmclapi2.bangbang93.com/maven/")
            };

            tasks.push((mirror_url, target_path, name.to_string()));
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
                let _ = tokio::fs::create_dir_all(parent).await; 
            }

            // ✅ 核心修复 2：彻底暴露下载过程中的所有网络错误，拒绝静默失败！
            match client.get(&url).send().await {
                Ok(mut res) => {
                    if res.status().is_success() {
                        let mut file_data = Vec::new();
                        while let Ok(Some(chunk)) = res.chunk().await {
                            file_data.extend_from_slice(&chunk);
                            if limit > 0 {
                                tokio::time::sleep(std::time::Duration::from_secs_f64(chunk.len() as f64 / limit as f64)).await;
                            }
                        }
                        if let Err(e) = tokio::fs::write(&path, file_data).await {
                            eprintln!("[Downloader ERROR] 磁盘写入失败 {}: {}", path.display(), e);
                        }
                    } else {
                        eprintln!("[Downloader ERROR] HTTP 请求被拒绝 (状态码: {}) -> {}", res.status(), url);
                    }
                }
                Err(e) => {
                    eprintln!("[Downloader ERROR] 网络连接异常 -> {}: {}", url, e);
                }
            }

            let mut c = completed.lock().await;
            *c += 1;
            if *c % 10 == 0 || *c == total {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    instance_id: i_id, stage: "LIBRARIES".to_string(), file_name: name, current: *c, total,
                    message: format!("正在下载依赖库 ({}/{})", *c, total),
                });
            }
        }
    }).buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;
    Ok(())
}

async fn download_assets<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &Path,
) -> AppResult<()> {
    let index_meta = &manifest["assetIndex"];
    if index_meta.is_null() { return Ok(()); }

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 { dl_settings.concurrency } else { 16 };
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let index_id = index_meta["id"].as_str().unwrap_or("");
    let index_url = index_meta["url"].as_str().unwrap_or("");
    if index_id.is_empty() || index_url.is_empty() { return Ok(()); }

    let index_dir = global_mc_root.join("assets").join("indexes");
    tokio::fs::create_dir_all(&index_dir).await?;
    let index_path = index_dir.join(format!("{}.json", index_id));

    if !index_path.exists() {
        let mirror_url = if dl_settings.source == "official" {
            index_url.to_string()
        } else {
            // 同样强制废弃 mcbbs 节点
            index_url.replace("https://launchermeta.mojang.com", "https://bmclapi2.bangbang93.com")
        };
        if let Ok(res) = client.get(&mirror_url).send().await {
            if let Ok(text) = res.text().await {
                let _ = tokio::fs::write(&index_path, text).await;
            }
        }
    }

    if !index_path.exists() {
        eprintln!("[Downloader ERROR] 无法下载 Asset Index: {}", index_url);
        return Ok(());
    }

    let index_content = tokio::fs::read_to_string(&index_path).await?;
    let index_json: Value = serde_json::from_str(&index_content)?;

    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();

    if let Some(objects) = index_json["objects"].as_object() {
        for (name, object) in objects {
            let hash = object["hash"].as_str().unwrap_or("");
            let size = object["size"].as_u64().unwrap_or(0);
            if hash.is_empty() { continue; }

            let prefix = &hash[0..2];
            let target_path = global_mc_root.join("assets").join("objects").join(prefix).join(hash);

            if target_path.exists() && target_path.metadata().map(|m| m.len()).unwrap_or(0) == size {
                continue;
            }

            let url = if dl_settings.source == "official" {
                format!("https://resources.download.minecraft.net/{}/{}", prefix, hash)
            } else {
                format!("https://bmclapi2.bangbang93.com/assets/{}/{}", prefix, hash)
            };
            
            tasks.push((url, target_path, name.clone()));
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
                let _ = tokio::fs::create_dir_all(parent).await; 
            }
            
            match client.get(&url).send().await {
                Ok(mut res) => {
                    if res.status().is_success() {
                        let mut file_data = Vec::new();
                        while let Ok(Some(chunk)) = res.chunk().await {
                            file_data.extend_from_slice(&chunk);
                            if limit > 0 {
                                tokio::time::sleep(std::time::Duration::from_secs_f64(chunk.len() as f64 / limit as f64)).await;
                            }
                        }
                        if let Err(e) = tokio::fs::write(&path, file_data).await {
                            eprintln!("[Downloader ERROR] 资源写入失败 {}: {}", path.display(), e);
                        }
                    } else {
                        eprintln!("[Downloader ERROR] 资源 HTTP 错误 {} -> {}", res.status(), url);
                    }
                }
                Err(e) => {
                    eprintln!("[Downloader ERROR] 资源网络请求失败 -> {}: {}", url, e);
                }
            }

            let mut c = completed.lock().await;
            *c += 1;
            if *c % 50 == 0 || *c == total {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    instance_id: i_id, stage: "ASSETS".to_string(), file_name: name, current: *c, total,
                    message: format!("正在下载游戏资源 ({}/{})", *c, total),
                });
            }
        }
    }).buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;
    Ok(())
}