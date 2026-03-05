// src-tauri/src/services/downloader/core_installer.rs
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, Runtime};
use crate::services::config_service::ConfigService;

pub async fn install_vanilla_core<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str, 
    version_id: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    let client = reqwest::Client::new();
    let version_dir = global_mc_root.join("versions").join(version_id);
    fs::create_dir_all(&version_dir)?;

    let json_path = version_dir.join(format!("{}.json", version_id));
    let jar_path = version_dir.join(format!("{}.jar", version_id));

    let dl_settings = ConfigService::get_download_settings(app);

    if !json_path.exists() {
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: instance_id.to_string(), stage: "VANILLA_CORE".to_string(), file_name: format!("{}.json", version_id), current: 10, total: 100,
            message: "正在获取版本清单...".to_string(),
        });

        // ✅ 动态读取 Vanilla 镜像源
        let manifest_url = if dl_settings.vanilla_source == "official" {
            "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json".to_string()
        } else {
            format!("{}/mc/game/version_manifest_v2.json", dl_settings.vanilla_source_url)
        };

        let manifest_res: serde_json::Value = client.get(&manifest_url).send().await?.json().await?;

        let version_url = manifest_res["versions"]
            .as_array().unwrap().iter()
            .find(|v| v["id"].as_str().unwrap_or("") == version_id)
            .and_then(|v| v["url"].as_str())
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未找到目标版本 URL"))?;

        let mirror_url = if dl_settings.vanilla_source == "official" {
            version_url.to_string()
        } else {
            version_url.replace("https://piston-meta.mojang.com", &dl_settings.vanilla_source_url)
        };

        let version_json_text = client.get(&mirror_url).send().await?.text().await?;
        fs::write(&json_path, &version_json_text)?;
    }

    let json_content = fs::read_to_string(&json_path)?;
    let parsed_json: serde_json::Value = serde_json::from_str(&json_content)?;

    if !jar_path.exists() {
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: instance_id.to_string(), stage: "VANILLA_CORE".to_string(), file_name: format!("{}.jar", version_id), current: 50, total: 100,
            message: "正在下载游戏核心...".to_string(),
        });

        let jar_url = parsed_json["downloads"]["client"]["url"].as_str()
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "JSON 中无客户端 URL"))?;

        let mirror_jar_url = if dl_settings.vanilla_source == "official" {
            jar_url.to_string()
        } else {
            jar_url.replace("https://piston-data.mojang.com", &dl_settings.vanilla_source_url)
        };

        let jar_bytes = client.get(&mirror_jar_url).send().await?.bytes().await?;
        fs::write(&jar_path, jar_bytes)?;
    }

    Ok(())
}