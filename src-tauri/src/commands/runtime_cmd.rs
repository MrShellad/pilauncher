// src-tauri/src/commands/runtime_cmd.rs
use crate::domain::runtime::{JavaInstall, MemoryStats, RuntimeConfig, ValidationResult};
use crate::services::config_service::ConfigService;
use crate::services::runtime_service;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// ✅ 核心修复：将 java_cache.json 转移到启动器的 config 目录下。
// 这样底层的 runtime_service 在执行 cache_file.parent().parent() 时，
// 就能完美锁定真实的 base_path，从而精准扫描到 base_path/runtime/java！
fn get_cache_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    if let Ok(Some(base_path_str)) = ConfigService::get_base_path(app) {
        let dir = PathBuf::from(base_path_str).join("config");
        fs::create_dir_all(&dir).ok();
        return dir.join("java_cache.json");
    }
    
    // 如果尚未完成向导配置，兜底存放在系统目录
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("java_cache.json")
}

#[tauri::command]
pub fn get_system_memory() -> MemoryStats {
    runtime_service::get_system_memory()
}

#[tauri::command]
pub async fn validate_java_cache<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<ValidationResult, String> {
    let cache_file = get_cache_file(&app);
    runtime_service::validate_java_cache(&cache_file)
}

#[tauri::command]
pub async fn scan_java_environments<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
) -> Result<Vec<JavaInstall>, String> {
    let cache_file = get_cache_file(&app);
    runtime_service::scan_java_environments(&cache_file)
}

#[tauri::command]
pub async fn get_instance_runtime<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<RuntimeConfig, String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);
    crate::services::runtime_service::get_instance_runtime(&instance_dir)
}

#[tauri::command]
pub async fn save_instance_runtime<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    config: RuntimeConfig,
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);
    crate::services::runtime_service::save_instance_runtime(&instance_dir, config)
}