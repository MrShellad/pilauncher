// src-tauri/src/commands/settings_cmd.rs
use crate::services::config_service::ConfigService;
use chrono::Local;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn get_settings<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
    // 🌟 修复：如果没拿到基础路径，不再抛出错误，而是温柔地返回一个空 JSON
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(path)) => path,
        _ => return Ok(serde_json::json!({})),
    };

    let file_path = PathBuf::from(base_path_str)
        .join("config")
        .join("settings.json");

    if file_path.exists() {
        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        let json: serde_json::Value =
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
        Ok(json)
    } else {
        Ok(serde_json::json!({}))
    }
}

#[tauri::command]
pub async fn save_settings<R: Runtime>(
    app: AppHandle<R>,
    settings: serde_json::Value,
) -> Result<(), String> {
    // 🌟 修复：如果没拿到基础路径，静默返回 Ok(())。让前端在内存中保持状态即可。
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(path)) => path,
        _ => return Ok(()),
    };

    let config_dir = PathBuf::from(base_path_str).join("config");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let file_path = config_dir.join("settings.json");
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn import_background_image<R: Runtime>(
    app: AppHandle<R>,
    source_path: String,
) -> Result<String, String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?; // 这个需要报错，因为这是主动操作

    let source = std::path::Path::new(&source_path);
    if !source.exists() {
        return Err("选中的图片不存在".to_string());
    }

    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    let filename = format!("Pi_{}.{}", Local::now().format("%Y%m%d%H%M%S"), ext);
    let config_dir = PathBuf::from(base_path_str).join("config");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let target_path = config_dir.join(&filename);
    fs::copy(source, &target_path).map_err(|e| e.to_string())?;

    Ok(target_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_background_image(path: String) -> Result<(), String> {
    let file_path = std::path::Path::new(&path);
    if file_path.exists() {
        std::fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

// 获取按键映射
#[tauri::command]
pub async fn get_keybindings<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
    // 🌟 修复：同上兜底
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(path)) => path,
        _ => return Ok(serde_json::json!({})),
    };

    let file_path = PathBuf::from(base_path_str)
        .join("config")
        .join("keybindings.json");

    if file_path.exists() {
        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        let json: serde_json::Value =
            serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
        Ok(json)
    } else {
        Ok(serde_json::json!({}))
    }
}

// 保存按键映射
#[tauri::command]
pub async fn save_keybindings<R: Runtime>(
    app: AppHandle<R>,
    bindings: serde_json::Value,
) -> Result<(), String> {
    // 🌟 修复：同上兜底
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(path)) => path,
        _ => return Ok(()),
    };

    let config_dir = PathBuf::from(base_path_str).join("config");

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let file_path = config_dir.join("keybindings.json");
    let content = serde_json::to_string_pretty(&bindings).map_err(|e| e.to_string())?;
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}
