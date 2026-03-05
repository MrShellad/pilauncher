// src-tauri/src/services/config_service.rs
use crate::error::AppResult;
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettings {
    pub concurrency: usize,
    pub speed_limit: u64,
    pub speed_unit: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: String,
    pub retry_count: u32,
    pub timeout: u64,
    pub verify_after_download: bool,
    // ✅ 新增：各路下载源路由配置
    pub vanilla_source: String,
    pub vanilla_source_url: String,
    pub fabric_source: String,
    pub fabric_source_url: String,
    pub forge_source: String,
    pub forge_source_url: String,
    pub neoforge_source: String,
    pub neoforge_source_url: String,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            concurrency: 16, speed_limit: 0, speed_unit: "MB/s".to_string(),
            proxy_type: "none".to_string(), proxy_host: "127.0.0.1".to_string(),
            proxy_port: "7890".to_string(), retry_count: 3, timeout: 15, verify_after_download: true,
            vanilla_source: "bmclapi".to_string(), vanilla_source_url: "https://bmclapi2.bangbang93.com".to_string(),
            fabric_source: "official".to_string(), fabric_source_url: "https://meta.fabricmc.net".to_string(),
            forge_source: "bmclapi".to_string(), forge_source_url: "https://bmclapi2.bangbang93.com/forge".to_string(),
            neoforge_source: "bmclapi".to_string(), neoforge_source_url: "https://bmclapi2.bangbang93.com/neoforge".to_string(),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JavaSettings {
    pub auto_detect: bool,
    pub java_path: String,
    pub jvm_args: String,
    pub max_memory: u32,
    pub min_memory: u32,
}
impl Default for JavaSettings {
    fn default() -> Self {
        Self {
            auto_detect: true, java_path: "java".to_string(),
            jvm_args: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions".to_string(),
            max_memory: 4096, min_memory: 1024,
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameSettings {
    pub fullscreen: bool,
    pub resolution: String,
}
impl Default for GameSettings {
    fn default() -> Self { Self { fullscreen: false, resolution: "854x480".to_string() } }
}

pub struct ConfigService;

impl ConfigService {
    fn get_meta_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        Ok(app.path().app_config_dir().expect("无法获取系统配置目录").join("meta.json"))
    }

    pub fn get_base_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<String>> {
        let path = Self::get_meta_path(app)?;
        if path.exists() {
            let content = fs::read_to_string(path)?;
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(bp) = json["base_path"].as_str() { return Ok(Some(bp.to_string())); }
            }
        }
        Ok(None)
    }

    fn get_settings_json<R: Runtime>(app: &AppHandle<R>) -> Option<serde_json::Value> {
        if let Ok(Some(base_path_str)) = Self::get_base_path(app) {
            let file_path = PathBuf::from(base_path_str).join("config").join("settings.json");
            if file_path.exists() {
                if let Ok(content) = fs::read_to_string(file_path) {
                    return serde_json::from_str(&content).ok();
                }
            }
        }
        None
    }

    pub fn get_download_settings<R: Runtime>(app: &AppHandle<R>) -> DownloadSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/download") {
                if let Ok(s) = serde_json::from_value(val.clone()) { return s; }
            }
        }
        DownloadSettings::default()
    }

    pub fn get_java_settings<R: Runtime>(app: &AppHandle<R>) -> JavaSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/java") {
                if let Ok(s) = serde_json::from_value(val.clone()) { return s; }
            }
        }
        JavaSettings::default()
    }

    pub fn get_game_settings<R: Runtime>(app: &AppHandle<R>) -> GameSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/game") {
                if let Ok(s) = serde_json::from_value(val.clone()) { return s; }
            }
        }
        GameSettings::default()
    }

    pub fn set_base_path<R: Runtime>(app: &AppHandle<R>, target_path: &str) -> Result<(), String> {
        let target = Path::new(target_path);
        if target.exists() {
            let mut entries = fs::read_dir(target).map_err(|e| e.to_string())?;
            if entries.next().is_some() { return Err("所选目录不为空！".to_string()); }
        } else {
            fs::create_dir_all(target).map_err(|e| e.to_string())?;
        }

        let dirs_to_create = [
            target.join("runtime").join("assets"), target.join("runtime").join("libraries"), target.join("runtime").join("versions"),
            target.join("instances"), target.join("config"),
        ];
        for dir in dirs_to_create {
            fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败 {}: {}", dir.display(), e))?;
        }

        let meta_path = Self::get_meta_path(app).map_err(|e| e.to_string())?;
        if let Some(parent) = meta_path.parent() { let _ = fs::create_dir_all(parent); }
        let data = serde_json::json!({ "base_path": target_path });
        fs::write(meta_path, data.to_string()).map_err(|e| e.to_string())?;
        Ok(())
    }
}