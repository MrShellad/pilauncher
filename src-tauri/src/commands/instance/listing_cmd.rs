// src-tauri/src/commands/instance/listing_cmd.rs
use tauri::{AppHandle, Runtime};
use crate::domain::instance::InstanceItem;
use crate::services::instance::listing::InstanceListingService;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_all_instances<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_all(&app)
}

// ✅ 新增的兼容性实例筛选命令
#[tauri::command]
pub async fn get_compatible_instances<R: Runtime>(
    app: AppHandle<R>,
    game_versions: Vec<String>,
    loaders: Vec<String>
) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_compatible(&app, game_versions, loaders)
}