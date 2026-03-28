use crate::domain::instance::InstanceConfig;
use crate::domain::runtime::{
    JavaInstall, MemoryStats, ResolvedJavaRuntime, RuntimeConfig, ValidationResult,
};
use crate::services::config_service::ConfigService;
use crate::services::runtime_service;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

fn get_cache_file<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> PathBuf {
    if let Ok(Some(base_path_str)) = ConfigService::get_base_path(app) {
        let dir = PathBuf::from(base_path_str).join("config");
        fs::create_dir_all(&dir).ok();
        return dir.join("java_cache.json");
    }

    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(&dir).ok();
    dir.join("java_cache.json")
}

fn get_instance_dir<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    id: &str,
) -> Result<PathBuf, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    Ok(PathBuf::from(base_path).join("instances").join(id))
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
pub async fn get_required_java_major(mc_version: String) -> Result<String, String> {
    Ok(runtime_service::get_required_java_version(&mc_version))
}

#[tauri::command]
pub async fn resolve_global_java_for_version<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    mc_version: String,
) -> Result<ResolvedJavaRuntime, String> {
    let java_settings = ConfigService::get_java_settings(&app);
    Ok(runtime_service::resolve_global_java_runtime(
        &java_settings,
        &mc_version,
        runtime_service::launcher_default_java_command(),
    ))
}

#[tauri::command]
pub async fn resolve_instance_java<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<ResolvedJavaRuntime, String> {
    let instance_dir = get_instance_dir(&app, &id)?;
    let instance_path = instance_dir.join("instance.json");
    let instance_text = fs::read_to_string(&instance_path).map_err(|e| e.to_string())?;
    let instance_cfg: InstanceConfig =
        serde_json::from_str(&instance_text).map_err(|e| e.to_string())?;

    let runtime_config = runtime_service::get_instance_runtime(&instance_dir)?;
    let java_settings = ConfigService::get_java_settings(&app);

    Ok(runtime_service::resolve_instance_java_runtime(
        &runtime_config,
        &java_settings,
        &instance_cfg.mc_version,
        runtime_service::launcher_default_java_command(),
    ))
}

#[tauri::command]
pub async fn get_instance_runtime<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<RuntimeConfig, String> {
    let instance_dir = get_instance_dir(&app, &id)?;
    runtime_service::get_instance_runtime(&instance_dir)
}

#[tauri::command]
pub async fn save_instance_runtime<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    config: RuntimeConfig,
) -> Result<(), String> {
    let instance_dir = get_instance_dir(&app, &id)?;
    runtime_service::save_instance_runtime(&instance_dir, config)
}
