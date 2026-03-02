// src-tauri/src/commands/minecraft/metadata_cmd.rs
use crate::domain::minecraft::VersionGroup;
use crate::error::AppResult;
use crate::services::minecraft_service::McMetadataService;

#[tauri::command]
pub async fn get_minecraft_versions(force: bool) -> AppResult<Vec<VersionGroup>> {
    McMetadataService::fetch_remote_versions(force).await
}
