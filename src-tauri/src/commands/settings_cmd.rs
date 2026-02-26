// src-tauri/src/commands/settings_cmd.rs
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};
use crate::services::config_service::ConfigService;
use chrono::Local;

#[tauri::command]
pub async fn get_settings<R: Runtime>(app: AppHandle<R>) -> Result<serde_json::Value, String> {
    // 获取全局基础目录 (PiLauncher/)
    // ✅ 修复：加上 .map_err(|e| e.to_string()) 将 AppError 转为 String
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())? 
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        
    let file_path = PathBuf::from(base_path_str).join("config").join("settings.json");

    if file_path.exists() {
        let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
        // 如果文件存在且能被解析，返回 JSON
        let json: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
        Ok(json)
    } else {
        // 如果不存在，返回一个空对象，前端会使用默认值
        Ok(serde_json::json!({}))
    }
}

#[tauri::command]
pub async fn save_settings<R: Runtime>(app: AppHandle<R>, settings: serde_json::Value) -> Result<(), String> {
    // ✅ 修复：加上 .map_err(|e| e.to_string())
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        
    let config_dir = PathBuf::from(base_path_str).join("config");
    
    // 确保 config 目录存在
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let file_path = config_dir.join("settings.json");
    
    // 美化输出 JSON 字符串并写入文件
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(file_path, content).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn import_background_image<R: Runtime>(app: AppHandle<R>, source_path: String) -> Result<String, String> {
    // 1. 获取全局基础目录 (PiLauncher/)
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let source = std::path::Path::new(&source_path);
    if !source.exists() {
        return Err("选中的图片不存在".to_string());
    }

    // 2. 提取原图后缀名，默认给个 png
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");
    
    // 3. 按照要求格式化文件名：Pi_YYYYMMDDHHMMSS.后缀
    let filename = format!("Pi_{}.{}", Local::now().format("%Y%m%d%H%M%S"), ext);

    // 4. 定位到 PiLauncher/config/ 目录
    let config_dir = PathBuf::from(base_path_str).join("config");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }

    let target_path = config_dir.join(&filename);

    // 5. 执行物理拷贝
    fs::copy(source, &target_path).map_err(|e| e.to_string())?;

    // 6. 返回新的绝对路径给前端
    Ok(target_path.to_string_lossy().to_string())
}