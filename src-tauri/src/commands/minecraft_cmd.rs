// src-tauri/src/commands/minecraft/metadata_cmd.rs
use crate::domain::minecraft::VersionGroup;
use crate::error::AppResult;
use crate::services::minecraft_service::McMetadataService;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn get_minecraft_versions<R: Runtime>(
    app: AppHandle<R>,
    force: bool,
) -> AppResult<Vec<VersionGroup>> {
    McMetadataService::fetch_remote_versions(&app, force).await
}
