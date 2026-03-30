// src-tauri/src/commands/minecraft/loader_cmd.rs
use crate::error::AppResult;
use crate::services::loader_service::LoaderMetadataService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn get_loader_versions<R: Runtime>(
    app: AppHandle<R>,
    loader_type: String,
    game_version: String,
) -> AppResult<Vec<String>> {
    LoaderMetadataService::fetch_loader_versions(&app, &loader_type, &game_version).await
}
