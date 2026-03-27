// src-tauri/src/commands/instance/resource_cmd.rs
use crate::services::config_service::ConfigService;
use crate::services::instance::resource_manager::{
    ResourceItem, ResourceManager, ResourceSnapshot, ResourceType,
};
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

    let target_dir = std::path::PathBuf::from(base_path)
        .join("instances")
        .join(id)
        .join(res_type.folder_name());
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

/// 提取资源包内的 pack.png，缓存到 base_path/shared_mods/icons/
/// 返回图标文件的绝对路径（若已缓存则直接返回）
#[tauri::command]
pub async fn extract_resourcepack_icon<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    instance_id: String,
    file_name: String,
) -> Result<Option<String>, String> {
    use std::io::Read;

    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    // 图标缓存目录： base_path/shared_mods/icons/
    let icons_dir = std::path::PathBuf::from(&base_path).join("shared_mods").join("icons");
    std::fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;

    // 缓存文件：以 file_name (stripped) 为 key
    let clean_name = file_name.trim_end_matches(".disabled");
    let cache_key = format!("{}.png", clean_name.replace(['/', '\\', ':'], "_"));
    let icon_path = icons_dir.join(&cache_key);

    // 已缓存则直接返回
    if icon_path.exists() {
        return Ok(Some(icon_path.to_string_lossy().to_string()));
    }

    // 资源包目录
    let pack_path = std::path::PathBuf::from(&base_path)
        .join("instances")
        .join(&instance_id)
        .join("resourcepacks")
        .join(&file_name);

    if !pack_path.exists() {
        return Ok(None);
    }

    // 如果是目录形式资源包，直接读 pack.png
    if pack_path.is_dir() {
        let img_path = pack_path.join("pack.png");
        if img_path.exists() {
            std::fs::copy(&img_path, &icon_path).map_err(|e| e.to_string())?;
            return Ok(Some(icon_path.to_string_lossy().to_string()));
        }
        return Ok(None);
    }

    // ZIP 格式：提取 pack.png
    let file = std::fs::File::open(&pack_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    let result = match archive.by_name("pack.png") {
        Ok(mut entry) => {
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            std::fs::write(&icon_path, &buf).map_err(|e| e.to_string())?;
            Ok(Some(icon_path.to_string_lossy().to_string()))
        }
        Err(_) => Ok(None), // 没有 pack.png 是合法的
    };
    result
}
