// src-tauri/src/services/downloader/dependencies.rs
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
// ✅ 修复：引入 Runtime
use tauri::{AppHandle, Emitter, Runtime};
use futures::stream::{StreamExt, iter};
use reqwest::Client;
use tokio::sync::Mutex;

use crate::domain::event::DownloadProgressEvent;
use crate::domain::minecraft_json::{VersionManifestJson, AssetIndexJson};
use crate::error::AppResult;

const MAX_CONCURRENT_DOWNLOADS: usize = 16; 

// ✅ 修复：添加 <R: Runtime>
pub async fn download_dependencies<R: Runtime>(
    app: &AppHandle<R>,
    version_id: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    let client = Client::builder()
        .user_agent("OreLauncher/1.0")
        .build()?;
    
    let json_path = global_mc_root.join("versions").join(version_id).join(format!("{}.json", version_id));
    let json_content = fs::read_to_string(&json_path)?;
    let manifest: VersionManifestJson = serde_json::from_str(&json_content)?;

    download_libraries(app, &client, &manifest, global_mc_root).await?;
    download_assets(app, &client, &manifest, global_mc_root).await?;

    Ok(())
}

// ✅ 修复：添加 <R: Runtime>
async fn download_libraries<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    manifest: &VersionManifestJson,
    global_mc_root: &Path,
) -> AppResult<()> {
    let mut tasks = Vec::new();
    
    for lib in &manifest.libraries {
        if let Some(downloads) = &lib.downloads {
            if let Some(artifact) = &downloads.artifact {
                let target_path = global_mc_root.join("libraries").join(&artifact.path);
                
                if target_path.exists() && target_path.metadata().map(|m| m.len()).unwrap_or(0) == artifact.size {
                    continue;
                }

                let mirror_url = artifact.url.replace("https://libraries.minecraft.net", "https://bmclapi2.bangbang93.com/maven");
                tasks.push((mirror_url, target_path, lib.name.clone()));
            }
        }
    }

    let total = tasks.len() as u64;
    if total == 0 { return Ok(()); } 
    
    let completed = Arc::new(Mutex::new(0_u64));

    let fetches = iter(tasks).map(|(url, path, name)| {
        let client = client.clone();
        let app = app.clone(); // 这里 app.clone() 需要 T: Runtime，没问题
        let completed = Arc::clone(&completed);
        
        async move {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            match client.get(&url).send().await {
                Ok(res) if res.status().is_success() => {
                    if let Ok(bytes) = res.bytes().await {
                        let _ = fs::write(&path, bytes);
                    }
                }
                _ => { /* 忽略失败 */ }
            }

            let mut c = completed.lock().await;
            *c += 1;
            
            let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                stage: "LIBRARIES".to_string(),
                file_name: name,
                current: *c,
                total,
                message: format!("正在下载依赖库 ({}/{})", *c, total),
            });
        }
    }).buffer_unordered(MAX_CONCURRENT_DOWNLOADS);

    fetches.collect::<Vec<()>>().await;
    Ok(())
}

// ✅ 修复：添加 <R: Runtime>
async fn download_assets<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    manifest: &VersionManifestJson,
    global_mc_root: &Path,
) -> AppResult<()> {
    let index_meta = &manifest.asset_index;
    let index_dir = global_mc_root.join("assets").join("indexes");
    fs::create_dir_all(&index_dir)?;
    
    let index_path = index_dir.join(format!("{}.json", index_meta.id));
    
    if !index_path.exists() {
        let mirror_url = index_meta.url.replace("https://launchermeta.mojang.com", "https://bmclapi2.bangbang93.com");
        let index_text = client.get(&mirror_url).send().await?.text().await?;
        fs::write(&index_path, &index_text)?;
    }

    let index_content = fs::read_to_string(&index_path)?;
    let index_json: AssetIndexJson = serde_json::from_str(&index_content)?;

    let mut tasks = Vec::new();

    for (name, object) in index_json.objects {
        let hash = object.hash;
        let prefix = &hash[0..2]; 
        
        let target_path = global_mc_root.join("assets").join("objects").join(prefix).join(&hash);
        
        if target_path.exists() && target_path.metadata().map(|m| m.len()).unwrap_or(0) == object.size {
            continue;
        }

        let url = format!("https://bmclapi2.bangbang93.com/assets/{}/{}", prefix, hash);
        tasks.push((url, target_path, name));
    }

    let total = tasks.len() as u64;
    if total == 0 { return Ok(()); }

    let completed = Arc::new(Mutex::new(0_u64));

    let fetches = iter(tasks).map(|(url, path, name)| {
        let client = client.clone();
        let app = app.clone();
        let completed = Arc::clone(&completed);
        
        async move {
            if let Some(parent) = path.parent() {
                let _ = fs::create_dir_all(parent);
            }

            match client.get(&url).send().await {
                Ok(res) if res.status().is_success() => {
                    if let Ok(bytes) = res.bytes().await {
                        let _ = fs::write(&path, bytes);
                    }
                }
                _ => {}
            }

            let mut c = completed.lock().await;
            *c += 1;
            
            if *c % 20 == 0 || *c == total {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    stage: "ASSETS".to_string(),
                    file_name: name,
                    current: *c,
                    total,
                    message: format!("正在下载游戏资源 ({}/{})", *c, total),
                });
            }
        }
    }).buffer_unordered(MAX_CONCURRENT_DOWNLOADS);

    fetches.collect::<Vec<()>>().await;
    Ok(())
}