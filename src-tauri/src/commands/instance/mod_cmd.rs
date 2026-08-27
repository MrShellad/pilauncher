use crate::services::instance::mod_manager::{ModManagerService, ModMetadata};
use tauri::{AppHandle, Manager, Runtime};

#[tauri::command]
pub async fn get_instance_mods<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    request_id: Option<String>,
) -> Result<Vec<ModMetadata>, String> {
    ModManagerService::get_mods(&app, &id, request_id).await
}

#[tauri::command]
pub async fn get_instance_mod_manifest_cache<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<Vec<ModMetadata>, String> {
    ModManagerService::get_mod_manifest_cache(&app, &id).await
}

#[tauri::command]
pub async fn update_mod_cache<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    cache_key: String,
    name: String,
    desc: String,
    icon_url: String,
    mod_id: Option<String>,
    curseforge_fingerprint: Option<u32>,
    modrinth_hash: Option<String>,
    curseforge_project_id: Option<String>,
    modrinth_project_id: Option<String>,
) -> Result<Option<String>, String> {
    crate::services::instance::mod_manager::ModManagerService::update_mod_cache(
        &app,
        &cache_key,
        &name,
        &desc,
        &icon_url,
        mod_id.as_deref(),
        curseforge_fingerprint,
        modrinth_hash.as_deref(),
        curseforge_project_id.as_deref(),
        modrinth_project_id.as_deref(),
    )
    .await
}

#[tauri::command]
pub async fn update_mod_cache_batch<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    items: Vec<crate::services::instance::mod_manager::ModCacheUpdateItem>,
) -> Result<std::collections::HashMap<String, Option<String>>, String> {
    crate::services::instance::mod_manager::ModManagerService::update_mod_cache_batch(&app, items)
        .await
}

#[tauri::command]
pub async fn ensure_offline_jar_icon<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    instance_id: String,
    file_name: String,
) -> Result<Option<String>, String> {
    crate::services::instance::mod_manager::ModManagerService::ensure_offline_jar_icon(
        &app,
        &instance_id,
        &file_name,
    )
    .await
}

#[tauri::command]
pub async fn open_mod_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
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

    let mods_dir = target_dir.join("mods");
    std::fs::create_dir_all(&mods_dir).ok(); // 确保目录存在

    // ✅ 跨平台唤起系统自带的文件管理器
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(mods_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(mods_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(mods_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn execute_mod_file_cleanup<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    items: Vec<crate::services::instance::mod_manager::ModFileNameCleanupItem>,
) -> Result<crate::services::instance::mod_manager::ModFileNameCleanupResult, String> {
    crate::services::instance::mod_manager::ModManagerService::execute_mod_file_cleanup(
        &app, &id, items,
    )
    .await
}

#[tauri::command]
pub async fn get_instance_dependency_health<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<crate::services::instance::mod_manager::InstanceDependencyHealth, String> {
    crate::services::instance::mod_manager::ModManagerService::get_instance_dependency_health(
        &app, &id,
    )
    .await
}

#[tauri::command]
pub async fn save_mod_relations<R: Runtime>(
    app: AppHandle<R>,
    relations: Vec<crate::services::db_service::ModRelationRecord>,
) -> Result<(), String> {
    let db = app.state::<crate::services::db_service::AppDatabase>();
    crate::services::db_service::DbService::save_mod_relations(&db.pool, &relations)
        .await
        .map_err(|e| e.to_string())
}
