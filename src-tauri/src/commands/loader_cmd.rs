// src-tauri/src/commands/minecraft/loader_cmd.rs
use crate::error::AppResult;
use crate::services::loader_service::LoaderMetadataService;

#[tauri::command]
pub async fn get_loader_versions(loader_type: String, game_version: String) -> AppResult<Vec<String>> {
    LoaderMetadataService::fetch_loader_versions(&loader_type, &game_version).await
}