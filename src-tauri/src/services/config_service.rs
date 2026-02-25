// src-tauri/src/services/config_service.rs
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};
use crate::error::AppResult; // 假设你有统一定义的 AppResult

pub struct ConfigService;

impl ConfigService {
    // 获取“路标”文件的存放路径 (通常在 AppData/Roaming/你的包名/meta.json)
    fn get_meta_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        let path = app.path().app_config_dir()
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

    // 设置基础目录并初始化架构，包含空目录校验
    pub fn set_base_path<R: Runtime>(app: &AppHandle<R>, target_path: &str) -> Result<(), String> {
        let target = Path::new(target_path);

        // 1. 校验是否为空目录
        if target.exists() {
            let mut entries = fs::read_dir(target).map_err(|e| e.to_string())?;
            if entries.next().is_some() {
                return Err("所选目录不为空！为了防止文件冲突，请选择一个全新或空白的文件夹。".to_string());
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
            fs::create_dir_all(&dir).map_err(|e| format!("创建目录失败 {}: {}", dir.display(), e))?;
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