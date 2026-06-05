use crate::domain::library::{
    Collection, CollectionItem, LibraryExportFile, LibraryImportOptions, LibraryImportPreview,
    LibraryImportResult, ModSetTracker, StarredItem, WebDavFavoriteSyncResult,
    WebDavSaveBackupSyncResult, WebDavSkinSyncResult, WebDavSyncConfig,
};
use crate::services::db_service::AppDatabase;
use crate::services::library_service::LibraryService;
use crate::services::webdav_sync_service::{
    WebDavRemoteSaveBackup, WebDavSaveBackupDeleteResult, WebDavSaveBackupDownloadResult,
    WebDavSyncService,
};
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn get_starred_items(db: State<'_, AppDatabase>) -> Result<Vec<StarredItem>, String> {
    LibraryService::get_starred_items(&db.pool)
        .await
        .map_err(|e| format!("Failed to get starred items: {}", e))
}

#[tauri::command]
pub async fn save_starred_item<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    item: StarredItem,
    device_id: String,
) -> Result<(), String> {
    LibraryService::save_starred_item(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save starred item: {}", e))?;
    WebDavSyncService::record_local_add_operation(&app, &item, &device_id).await
}

#[tauri::command]
pub async fn remove_starred_item<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
    device_id: String,
) -> Result<(), String> {
    LibraryService::remove_starred_item(&db.pool, &id)
        .await
        .map_err(|e| format!("Failed to remove starred item: {}", e))?;
    WebDavSyncService::record_local_remove_operation(&app, &id, &device_id).await
}

#[tauri::command]
pub async fn get_collections(db: State<'_, AppDatabase>) -> Result<Vec<Collection>, String> {
    LibraryService::get_collections(&db.pool)
        .await
        .map_err(|e| format!("Failed to get collections: {}", e))
}

#[tauri::command]
pub async fn save_collection(db: State<'_, AppDatabase>, item: Collection) -> Result<(), String> {
    LibraryService::save_collection(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save collection: {}", e))
}

#[tauri::command]
pub async fn remove_collection(db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    LibraryService::remove_collection(&db.pool, &id)
        .await
        .map_err(|e| format!("Failed to remove collection: {}", e))
}

#[tauri::command]
pub async fn get_collection_items(
    db: State<'_, AppDatabase>,
    collection_id: String,
) -> Result<Vec<CollectionItem>, String> {
    LibraryService::get_collection_items(&db.pool, &collection_id)
        .await
        .map_err(|e| format!("Failed to get collection items: {}", e))
}

#[tauri::command]
pub async fn get_all_collection_items(
    db: State<'_, AppDatabase>,
) -> Result<Vec<CollectionItem>, String> {
    LibraryService::get_all_collection_items(&db.pool)
        .await
        .map_err(|e| format!("Failed to get all collection items: {}", e))
}

#[tauri::command]
pub async fn save_collection_item(
    db: State<'_, AppDatabase>,
    item: CollectionItem,
) -> Result<(), String> {
    LibraryService::save_collection_item(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save collection item: {}", e))
}

#[tauri::command]
pub async fn save_collection_items(
    db: State<'_, AppDatabase>,
    items: Vec<CollectionItem>,
) -> Result<(), String> {
    LibraryService::save_collection_items(&db.pool, &items)
        .await
        .map_err(|e| format!("Failed to save collection items: {}", e))
}

#[tauri::command]
pub async fn remove_collection_item(
    db: State<'_, AppDatabase>,
    collection_id: String,
    item_id: String,
) -> Result<(), String> {
    LibraryService::remove_collection_item(&db.pool, &collection_id, &item_id)
        .await
        .map_err(|e| format!("Failed to remove collection item: {}", e))
}

#[tauri::command]
pub async fn remove_collection_items(
    db: State<'_, AppDatabase>,
    collection_id: String,
    item_ids: Vec<String>,
) -> Result<(), String> {
    LibraryService::remove_collection_items(&db.pool, &collection_id, &item_ids)
        .await
        .map_err(|e| format!("Failed to remove collection items: {}", e))
}

#[tauri::command]
pub async fn reorder_collection_items(
    db: State<'_, AppDatabase>,
    collection_id: String,
    ordered_item_ids: Vec<String>,
) -> Result<(), String> {
    LibraryService::reorder_collection_items(&db.pool, &collection_id, &ordered_item_ids)
        .await
        .map_err(|e| format!("Failed to reorder collection items: {}", e))
}

#[tauri::command]
pub async fn get_mod_set_trackers(
    db: State<'_, AppDatabase>,
) -> Result<Vec<ModSetTracker>, String> {
    LibraryService::get_mod_set_trackers(&db.pool)
        .await
        .map_err(|e| format!("Failed to get mod set trackers: {}", e))
}

#[tauri::command]
pub async fn replace_mod_set_trackers(
    db: State<'_, AppDatabase>,
    trackers: Vec<ModSetTracker>,
) -> Result<(), String> {
    LibraryService::replace_mod_set_trackers(&db.pool, &trackers)
        .await
        .map_err(|e| format!("Failed to replace mod set trackers: {}", e))
}

#[tauri::command]
pub async fn export_library_data(
    db: State<'_, AppDatabase>,
    path: String,
) -> Result<LibraryExportFile, String> {
    LibraryService::export_library_data(&db.pool, &path).await
}

#[tauri::command]
pub async fn preview_library_import(
    db: State<'_, AppDatabase>,
    path: String,
    options: Option<LibraryImportOptions>,
) -> Result<LibraryImportPreview, String> {
    LibraryService::preview_library_import(&db.pool, &path, &options.unwrap_or_default()).await
}

#[tauri::command]
pub async fn import_library_data(
    db: State<'_, AppDatabase>,
    path: String,
    options: Option<LibraryImportOptions>,
) -> Result<LibraryImportResult, String> {
    LibraryService::import_library_data(&db.pool, &path, &options.unwrap_or_default()).await
}

#[tauri::command]
pub async fn sync_webdav_favorites<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    config: WebDavSyncConfig,
) -> Result<WebDavFavoriteSyncResult, String> {
    WebDavSyncService::sync_favorites(&app, &db.pool, &config).await
}

#[tauri::command]
pub async fn sync_webdav_skin_assets<R: Runtime>(
    app: AppHandle<R>,
    config: WebDavSyncConfig,
) -> Result<WebDavSkinSyncResult, String> {
    WebDavSyncService::sync_skin_assets(&app, &config).await
}

#[tauri::command]
pub async fn sync_webdav_save_backups<R: Runtime>(
    app: AppHandle<R>,
    config: WebDavSyncConfig,
) -> Result<WebDavSaveBackupSyncResult, String> {
    WebDavSyncService::sync_save_backups(&app, &config).await
}

#[tauri::command]
pub async fn list_webdav_save_backups(
    config: WebDavSyncConfig,
) -> Result<Vec<WebDavRemoteSaveBackup>, String> {
    WebDavSyncService::list_remote_save_backups(&config).await
}

#[tauri::command]
pub async fn download_webdav_save_backup<R: Runtime>(
    app: AppHandle<R>,
    config: WebDavSyncConfig,
    backup_id: String,
    target_instance_id: String,
    restore_to_saves: bool,
    restore_configs: bool,
    auto_backup_current: bool,
) -> Result<WebDavSaveBackupDownloadResult, String> {
    WebDavSyncService::download_remote_save_backup(
        &app,
        &config,
        &backup_id,
        &target_instance_id,
        restore_to_saves,
        restore_configs,
        auto_backup_current,
    )
    .await
}

#[tauri::command]
pub async fn delete_webdav_save_backup(
    config: WebDavSyncConfig,
    backup_id: String,
) -> Result<WebDavSaveBackupDeleteResult, String> {
    WebDavSyncService::delete_remote_save_backup(&config, &backup_id).await
}

#[tauri::command]
pub async fn delete_webdav_keymap(
    config: WebDavSyncConfig,
    filename: String,
) -> Result<(), String> {
    WebDavSyncService::delete_webdav_keymap(&config, &filename).await
}

