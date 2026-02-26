// src-tauri/src/commands/instance/listing_cmd.rs
use tauri::{AppHandle, Runtime};
use crate::domain::instance::InstanceItem;
use crate::services::instance::listing::InstanceListingService;
use crate::error::AppResult;

#[tauri::command]
pub async fn get_all_instances<R: Runtime>(app: AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
    // 获取列表通常涉及文件遍历，使用 async 运行是正确的
    InstanceListingService::get_all(&app)
}