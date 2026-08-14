use crate::domain::resource::{OreProjectDetail, OreProjectVersion};
use crate::services::resource_service::ResourceService;
use tauri::{command, AppHandle, Runtime};

#[command]
pub async fn get_ore_project_detail(project_id: String) -> Result<OreProjectDetail, String> {
    ResourceService::fetch_project_detail(&project_id).await
}

#[command]
pub async fn get_ore_project_versions(
    project_id: String,
    game_version: Option<String>,
    loader: Option<String>,
) -> Result<Vec<OreProjectVersion>, String> {
    ResourceService::fetch_project_versions(&project_id, game_version.as_deref(), loader.as_deref())
        .await
}

#[command]
pub async fn download_resource<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    file_name: String,
    instance_id: String,
    sub_folder: String,
    task_id: Option<String>,
) -> Result<(), String> {
    let task_id =
        task_id.unwrap_or_else(|| format!("resource:{}:{}:{}", instance_id, sub_folder, file_name));
    ResourceService::download_resource(&app, &url, &file_name, &instance_id, &sub_folder, &task_id)
        .await
}

#[command]
pub fn pause_resource_download(task_id: String) -> Result<(), String> {
    ResourceService::pause_download(&task_id)
}

#[command]
pub fn resume_resource_download(task_id: String) -> Result<(), String> {
    ResourceService::resume_download(&task_id)
}

#[command]
pub fn cancel_resource_download(task_id: String) -> Result<(), String> {
    ResourceService::cancel_download(&task_id)
}
