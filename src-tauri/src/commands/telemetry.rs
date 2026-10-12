use crate::services::telemetry::{self, ClientInstallationTrackResult};
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn track_client_installation<R: Runtime>(
    app: AppHandle<R>,
) -> Result<ClientInstallationTrackResult, String> {
    telemetry::track_client_installation(&app).await
}
