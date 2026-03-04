// src-tauri/src/services/config_service.rs
use crate::error::AppResult;
use serde::Deserialize; // ✅ 新增：用于解析 settings.json
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime}; 

// ==========================================
// ✅ 新增：后端专用的下载配置模型 (映射前端 Settings)
// ==========================================
#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")] // 自动将驼峰转换为 Rust 的下划线命名
pub struct DownloadSettings {
    pub concurrency: usize,
    pub speed_limit: u64,
    pub speed_unit: String,
    pub source: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: String,
    pub retry_count: u32,
    pub timeout: u64,
    pub verify_after_download: bool,
}

// 如果读取文件失败或找不到节点，提供安全兜底的默认值
impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            concurrency: 16,
            speed_limit: 0,
            speed_unit: "MB/s".to_string(),
            source: "bmclapi".to_string(),
            proxy_type: "none".to_string(),
            proxy_host: "127.0.0.1".to_string(),
            proxy_port: "7890".to_string(),
            retry_count: 3,
            timeout: 15,
            verify_after_download: true,
        }
    }
}

pub struct ConfigService;

impl ConfigService {
    // 获取“路标”文件的存放路径 (通常在 AppData/Roaming/你的包名/meta.json)
    fn get_meta_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        let path = app
            .path()
            .app_config_dir()
            .expect("无法获取系统配置目录")
            .join("meta.json");
        Ok(path)
    }

    // 读取当前配置的基础目录
    pub fn get_base_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<String>> {
        let path = Self::get_meta_path(app)?;
        if path.exists() {
            let content = fs::read_to_string(path)?;
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(bp) = json["base_path"].as_str() {
                    return Ok(Some(bp.to_string()));
                }
            }
        }
        Ok(None)
    }

    // ==========================================
    // ✅ 新增核心能力：为后端下载引擎提供用户偏好配置
    // ==========================================
    pub fn get_download_settings<R: Runtime>(app: &AppHandle<R>) -> DownloadSettings {
        // 1. 尝试获取基础目录
        if let Ok(Some(base_path_str)) = Self::get_base_path(app) {
            let file_path = PathBuf::from(base_path_str).join("config").join("settings.json");
            
            // 2. 如果存在 settings.json，尝试读取
            if file_path.exists() {
                if let Ok(content) = fs::read_to_string(file_path) {
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                        // 3. 🎯 核心魔法：利用 JSON Pointer 语法直接穿透 Zustand 的嵌套层级
                        // 你的 JSON 结构是: state -> settings -> download
                        if let Some(dl_val) = json.pointer("/state/settings/download") {
                            // 4. 将提取出的对象反序列化为 Rust 的 DownloadSettings 结构体
                            if let Ok(settings) = serde_json::from_value(dl_val.clone()) {
                                return settings;
                            }
                        }
                    }
                }
            }
        }
        // 如果中间任何一步失败（如文件被删、初次启动没生成），直接返回默认安全配置
        DownloadSettings::default()
    }

    // 设置基础目录并初始化架构，包含空目录校验
    pub fn set_base_path<R: Runtime>(app: &AppHandle<R>, target_path: &str) -> Result<(), String> {
        let target = Path::new(target_path);

        // 1. 校验是否为空目录
        if target.exists() {
            let mut entries = fs::read_dir(target).map_err(|e| e.to_string())?;
            if entries.next().is_some() {
                return Err(
                    "所选目录不为空！为了防止文件冲突，请选择一个全新或空白的文件夹。".to_string(),
                );
            }
        } else {
            fs::create_dir_all(target).map_err(|e| e.to_string())?;
        }

        // 2. 初始化核心架构目录
        let dirs_to_create = [
            target.join("runtime").join("assets"),
            target.join("runtime").join("libraries"),
            target.join("runtime").join("versions"),
            target.join("instances"),
            target.join("config"),
        ];

        for dir in dirs_to_create {
            fs::create_dir_all(&dir)
                .map_err(|e| format!("创建目录失败 {}: {}", dir.display(), e))?;
        }

        // 3. 将用户选择的路径保存到 meta.json
        let meta_path = Self::get_meta_path(app).map_err(|e| e.to_string())?;
        if let Some(parent) = meta_path.parent() {
            let _ = fs::create_dir_all(parent);
        }

        let data = serde_json::json!({ "base_path": target_path });
        fs::write(meta_path, data.to_string()).map_err(|e| e.to_string())?;

        Ok(())
    }
}