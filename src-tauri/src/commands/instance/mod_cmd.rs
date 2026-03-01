use tauri::{AppHandle, Runtime};
use crate::services::instance::mod_manager::{ModManagerService, ModMetadata, ModSnapshot};

#[tauri::command]
pub async fn get_instance_mods<R: Runtime>(app: AppHandle<R>, id: String) -> Result<Vec<ModMetadata>, String> {
    ModManagerService::get_mods(&app, &id)
}

#[tauri::command]
pub async fn create_mod_snapshot<R: Runtime>(app: AppHandle<R>, id: String, desc: String) -> Result<ModSnapshot, String> {
    ModManagerService::create_snapshot(&app, &id, &desc)
}

#[tauri::command]
pub async fn rollback_mod_snapshot<R: Runtime>(app: AppHandle<R>, id: String, snapshot_id: String) -> Result<(), String> {
    ModManagerService::rollback_snapshot(&app, &id, &snapshot_id)
}

#[tauri::command]
pub async fn update_mod_cache<R: tauri::Runtime>(app: tauri::AppHandle<R>, id: String, file_name: String, name: String, desc: String, icon_url: String) -> Result<(), String> {
    crate::services::instance::mod_manager::ModManagerService::update_mod_cache(&app, &id, &file_name, &name, &desc, &icon_url)
}

#[tauri::command]
pub async fn open_mod_folder<R: tauri::Runtime>(app: tauri::AppHandle<R>, id: String) -> Result<(), String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
    
    let mods_dir = std::path::PathBuf::from(base_path).join("instances").join(id).join("mods");
    std::fs::create_dir_all(&mods_dir).ok(); // 确保目录存在

    // ✅ 跨平台唤起系统自带的文件管理器
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer").arg(mods_dir).spawn().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "macos")]
    std::process::Command::new("open").arg(mods_dir).spawn().map_err(|e| e.to_string())?;
    
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open").arg(mods_dir).spawn().map_err(|e| e.to_string())?;
    
    Ok(())
}