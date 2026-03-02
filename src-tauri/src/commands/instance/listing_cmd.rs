// src-tauri/src/commands/instance/listing_cmd.rs
use crate::domain::instance::InstanceItem;
use crate::error::AppResult;
use crate::services::instance::listing::InstanceListingService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn get_all_instances<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_all(&app)
}

// ✅ 新增的兼容性实例筛选命令
#[tauri::command]
pub async fn get_compatible_instances<R: Runtime>(
    app: AppHandle<R>,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    ignore_loader: bool, // ✅ 接收前端传入的忽略开关
) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_compatible(&app, game_versions, loaders, ignore_loader)
}
