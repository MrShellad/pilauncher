use crate::services::telemetry_service::{self, ClientInstallationTrackResult};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn track_client_installation<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ClientInstallationTrackResult, String> {
    telemetry_service::track_client_installation(&app).await
}
