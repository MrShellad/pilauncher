// src-tauri/src/services/downloader/core_installer.rs
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter};
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;

// 我们使用 BMCLAPI 加速国内下载
const BMCLAPI_VERSION_MANIFEST: &str = "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json";

pub async fn install_vanilla_core(
    app: &AppHandle,
    version_id: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    let client = reqwest::Client::new();
    let version_dir = global_mc_root.join("versions").join(version_id);
    fs::create_dir_all(&version_dir)?;

    let json_path = version_dir.join(format!("{}.json", version_id));
    let jar_path = version_dir.join(format!("{}.jar", version_id));

    // -----------------------------------------------------
    // 步骤 1: 获取并保存 Version JSON
    // -----------------------------------------------------
    if !json_path.exists() {
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "VANILLA_CORE".to_string(),
            file_name: format!("{}.json", version_id),
            current: 10, total: 100,
            message: "正在获取版本清单...".to_string(),
        });

        // 获取主清单
        let manifest_res: serde_json::Value = client.get(BMCLAPI_VERSION_MANIFEST).send().await?.json().await?;
        
        // 在清单中找到我们要的版本 url
        let version_url = manifest_res["versions"].as_array().unwrap().iter()
            .find(|v| v["id"].as_str().unwrap_or("") == version_id)
            .and_then(|v| v["url"].as_str())
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未找到目标版本 URL"))?;

        // 替换为 BMCLAPI 镜像源并下载具体 JSON
        let mirror_url = version_url.replace("https://piston-meta.mojang.com", "https://bmclapi2.bangbang93.com");
        let version_json_text = client.get(&mirror_url).send().await?.text().await?;
        
        fs::write(&json_path, &version_json_text)?;
    }

    // -----------------------------------------------------
    // 步骤 2: 解析 JSON 并下载 client.jar
    // -----------------------------------------------------
    // 此时 JSON 一定存在了，读取它
    let json_content = fs::read_to_string(&json_path)?;
    let parsed_json: serde_json::Value = serde_json::from_str(&json_content)?;

    if !jar_path.exists() {
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "VANILLA_CORE".to_string(),
            file_name: format!("{}.jar", version_id),
            current: 50, total: 100,
            message: "正在下载游戏核心...".to_string(),
        });

        // 提取 jar 下载链接
        let jar_url = parsed_json["downloads"]["client"]["url"].as_str()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "JSON 中无客户端 URL"))?;
        
        let mirror_jar_url = jar_url.replace("https://piston-data.mojang.com", "https://bmclapi2.bangbang93.com");
        
        // TODO: 这里目前是简单的全部读取到内存然后写入。
        // 对于几百 MB 的 jar 文件，后续我们要优化为 stream() 分块写入，才能实现真实的进度条。
        let jar_bytes = client.get(&mirror_jar_url).send().await?.bytes().await?;
        fs::write(&jar_path, jar_bytes)?;
    } else {
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "VANILLA_CORE".to_string(),
            file_name: format!("{}.jar", version_id),
            current: 100, total: 100,
            message: "核心文件已存在，跳过下载".to_string(),
        });
    }

    Ok(())
}