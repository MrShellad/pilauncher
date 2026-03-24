// src-tauri/src/commands/instance/listing_cmd.rs
use crate::domain::instance::InstanceItem;
use crate::error::AppResult;
use crate::services::instance::listing::InstanceListingService;
use tauri::{AppHandle, Runtime};

use std::path::PathBuf;
use std::process::Command as SysCommand;

#[tauri::command]
pub async fn get_all_instances<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_all(&app)
}

// ✅ 新增的兼容性实例筛选命令
#[tauri::command]
pub async fn get_compatible_instances<R: Runtime>(
    app: AppHandle<R>,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    ignore_loader: bool, // ✅ 接收前端传入的忽略开关
) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_compatible(&app, game_versions, loaders, ignore_loader)
}

#[tauri::command]
pub fn get_instance_screenshots<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Vec<String>, String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let screen_dir = PathBuf::from(base_path)
        .join("instances")
        .join(&id)
        .join("screenshots");

    let mut screenshots = Vec::new();
    if screen_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(screen_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let ext = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if ["png", "jpg", "jpeg", "webp"].contains(&ext.as_str()) {
                        screenshots.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
    }
    // 按照字母/时间排序一下，保证轮播顺序稳定
    screenshots.sort();
    Ok(screenshots)
}

// ✅ 2. 新增指令：调用系统原生文件管理器打开实例目录
#[tauri::command]
pub fn open_instance_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);

    #[cfg(target_os = "windows")]
    SysCommand::new("explorer")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    SysCommand::new("open")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    SysCommand::new("xdg-open")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取指定实例的自定义 HeroLogo 绝对路径
/// 读取 {instance_dir}/instance.json 中的 hero_logo 字段（相对路径），
/// 解析为绝对路径返回给前端使用 convertFileSrc 展示。
#[tauri::command]
pub fn get_instance_herologo<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Option<String>, String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);
    let manifest_path = instance_dir.join("instance.json");

    let content = match std::fs::read_to_string(&manifest_path) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let config: crate::domain::instance::InstanceConfig = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    if let Some(relative_path) = config.hero_logo {
        if relative_path.is_empty() {
            return Ok(None);
        }
        // 相对路径：相对于实例目录进行解析
        let abs_path = instance_dir.join(&relative_path);
        if abs_path.exists() {
            return Ok(Some(abs_path.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}
