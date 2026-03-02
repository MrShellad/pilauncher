use tauri::{AppHandle, Runtime, command};
use crate::services::resource_service::ResourceService;
use crate::domain::resource::{OreProjectDetail, OreProjectVersion};

#[command]
pub async fn get_ore_project_detail(project_id: String) -> Result<OreProjectDetail, String> {
    ResourceService::fetch_project_detail(&project_id).await
}

#[command]
pub async fn get_ore_project_versions(
    project_id: String, 
    game_version: Option<String>, 
    loader: Option<String>
) -> Result<Vec<OreProjectVersion>, String> {
    ResourceService::fetch_project_versions(
        &project_id, 
        game_version.as_deref(), 
        loader.as_deref()
    ).await
}

// ✅ 新增的底层下载指令
#[command]
pub async fn download_resource<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    file_name: String,
    instance_id: String,
    sub_folder: String, // 告诉 Rust 存在 mods 还是 resourcepacks 里
) -> Result<(), String> {
    ResourceService::download_resource(&app, &url, &file_name, &instance_id, &sub_folder).await
}