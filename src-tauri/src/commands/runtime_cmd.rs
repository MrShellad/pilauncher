use crate::domain::runtime::{JavaInstall, MemoryStats, ValidationResult};
use crate::services::runtime_service;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

// 获取缓存文件路径的辅助函数（仅属于控制层）
fn get_cache_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("java_cache.json")
}

#[tauri::command]
pub fn get_system_memory() -> MemoryStats {
    // 转发给 Service 层处理
    runtime_service::get_system_memory()
}

#[tauri::command]
pub async fn validate_java_cache<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<ValidationResult, String> {
    let cache_file = get_cache_file(&app);
    // 转发给 Service 层处理
    runtime_service::validate_java_cache(&cache_file)
}

#[tauri::command]
pub async fn scan_java_environments<R: tauri::Runtime>(app: tauri::AppHandle<R>) -> Result<Vec<JavaInstall>, String> {
    let cache_file = get_cache_file(&app);
    // 转发给 Service 层处理
    runtime_service::scan_java_environments(&cache_file)
}