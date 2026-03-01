// src-tauri/src/commands/instance/resource_cmd.rs
use tauri::{AppHandle, Runtime};
use crate::services::instance::resource_manager::{ResourceManager, ResourceType, ResourceItem, ResourceSnapshot};

#[tauri::command]
pub async fn list_resources<R: Runtime>(app: AppHandle<R>, id: String, res_type: ResourceType) -> Result<Vec<ResourceItem>, String> {
    ResourceManager::list_resources(&app, &id, res_type)
}

#[tauri::command]
pub async fn toggle_resource<R: Runtime>(app: AppHandle<R>, id: String, res_type: ResourceType, file_name: String, enable: bool) -> Result<(), String> {
    ResourceManager::toggle_resource(&app, &id, res_type, &file_name, enable)
}

#[tauri::command]
pub async fn delete_resource<R: Runtime>(app: AppHandle<R>, id: String, res_type: ResourceType, file_name: String) -> Result<(), String> {
    ResourceManager::delete_resource(&app, &id, res_type, &file_name)
}

#[tauri::command]
pub async fn create_resource_snapshot<R: Runtime>(app: AppHandle<R>, id: String, res_type: ResourceType, desc: String) -> Result<ResourceSnapshot, String> {
    ResourceManager::create_snapshot(&app, &id, res_type, &desc)
}

#[tauri::command]
pub async fn open_resource_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>, id: String, res_type: ResourceType) -> Result<(), String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
    
    let target_dir = std::path::PathBuf::from(base_path).join("instances").join(id).join(res_type.folder_name());
    std::fs::create_dir_all(&target_dir).ok(); // 确保目录存在

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(target_dir).spawn().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(target_dir).spawn().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(target_dir).spawn().map_err(|e| e.to_string())?;
    
    Ok(())
}