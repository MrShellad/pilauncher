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

    let need_download = if json_path.exists() {
        let content = fs::read_to_string(&json_path).unwrap_or_default();
        serde_json::from_str::<serde_json::Value>(&content).is_err()
    } else {
        true
    };

    if need_download {
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

        let manifest_res_raw = client.get(&manifest_url).send().await?;
        if !manifest_res_raw.status().is_success() {
            return Err(std::io::Error::new(std::io::ErrorKind::Other, format!("获取版本列表失败: {}", manifest_res_raw.status())).into());
        }
        let manifest_res: serde_json::Value = manifest_res_raw.json().await?;

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

        let res = client.get(&mirror_url).send().await?;
        if !res.status().is_success() {
            return Err(std::io::Error::new(std::io::ErrorKind::Other, format!("下载版本清单 {} 失败: {}", version_id, res.status())).into());
        }
        let version_json_text = res.text().await?;
        fs::write(&json_path, &version_json_text)?;
    }

    let json_content = fs::read_to_string(&json_path)?;
    let parsed_json: serde_json::Value = serde_json::from_str(&json_content)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, format!("解析版本 JSON 失败: {}", e)))?;

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