// src-tauri/src/commands/instance/resource_cmd.rs
use crate::services::instance::resource_manager::{
    ResourceItem, ResourceManager, ResourceSnapshot, ResourceType,
};
use std::collections::HashMap;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn list_resources<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    res_type: ResourceType,
) -> Result<Vec<ResourceItem>, String> {
    ResourceManager::list_resources(&app, &id, res_type)
}

#[tauri::command]
pub async fn toggle_resource<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    res_type: ResourceType,
    file_name: String,
    enable: bool,
) -> Result<(), String> {
    ResourceManager::toggle_resource(&app, &id, res_type, &file_name, enable)
}

#[tauri::command]
pub async fn delete_resource<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    res_type: ResourceType,
    file_name: String,
) -> Result<(), String> {
    ResourceManager::delete_resource(&app, &id, res_type, &file_name)
}

#[tauri::command]
pub async fn create_resource_snapshot<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    res_type: ResourceType,
    desc: String,
) -> Result<ResourceSnapshot, String> {
    ResourceManager::create_snapshot(&app, &id, res_type, &desc)
}

#[tauri::command]
pub async fn open_resource_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    res_type: ResourceType,
) -> Result<(), String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let mut target_dir = std::path::PathBuf::from(base_path)
        .join("instances")
        .join(&id);
    let json_path = target_dir.join("instance.json");
    if let Ok(content) = std::fs::read_to_string(json_path) {
        if let Ok(config) =
            serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
        {
            if let Some(tp) = config.third_party_path {
                target_dir = std::path::PathBuf::from(tp);
            }
        }
    }

    let target_dir = target_dir.join(res_type.folder_name());
    std::fs::create_dir_all(&target_dir).ok(); // 确保目录存在

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(target_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(target_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(target_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn ensure_offline_resource_icon<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    instance_id: String,
    res_type: ResourceType,
    file_name: String,
) -> Result<Option<String>, String> {
    crate::services::instance::mod_manager::icon_storage::IconStorage::ensure_offline_resource_icon(
        &app,
        &instance_id,
        res_type.folder_name(),
        &file_name,
    )
    .await
}

/// 提取资源包内的 pack.png，缓存到分桶目录
/// 返回图标文件的绝对路径（若已缓存则直接返回）
#[tauri::command]
pub async fn extract_resourcepack_icon<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    instance_id: String,
    file_name: String,
) -> Result<Option<String>, String> {
    ensure_offline_resource_icon(app, instance_id, ResourceType::ResourcePack, file_name).await
}

#[tauri::command]
pub async fn update_mod_manifest<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    file_name: String,
    source_kind: String,
    platform: String,
    project_id: String,
    file_id: String,
    version: Option<String>,
    old_file_name: Option<String>,
) -> Result<(), String> {
    ResourceManager::upsert_downloaded_mod(
        &app,
        &instance_id,
        &file_name,
        &source_kind,
        &platform,
        &project_id,
        &file_id,
        version,
        old_file_name,
    )
    .await
}

#[tauri::command]
pub async fn update_all_mods_metadata_settings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    settings: crate::domain::mod_manifest::ModMetadataSettings,
) -> Result<(), String> {
    ResourceManager::update_all_mods_metadata_settings(&app, &instance_id, settings)
}

#[tauri::command]
pub async fn reset_all_mods_platform_metadata<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<(), String> {
    ResourceManager::reset_all_mods_platform_metadata(&app, &instance_id)
}

#[tauri::command]
pub async fn update_mod_platform_matches<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    file_name: String,
    matches: HashMap<String, crate::domain::mod_manifest::ModPlatformMatch>,
) -> Result<(), String> {
    ResourceManager::update_mod_platform_matches(&app, &instance_id, &file_name, matches)
}

#[tauri::command]
pub async fn update_mod_platform_matches_batch<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    updates: Vec<crate::services::db_service::ModPlatformMatchBatchItem>,
) -> Result<(), String> {
    ResourceManager::update_mod_platform_matches_batch(&app, &instance_id, updates)
}

#[tauri::command]
pub async fn update_mod_metadata_settings<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    file_name: String,
    settings: crate::domain::mod_manifest::ModMetadataSettings,
) -> Result<(), String> {
    ResourceManager::update_mod_metadata_settings(&app, &instance_id, &file_name, settings)
}

#[tauri::command]
pub async fn reset_mod_platform_metadata<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    file_name: String,
) -> Result<(), String> {
    ResourceManager::reset_mod_platform_metadata(&app, &instance_id, &file_name)
}
