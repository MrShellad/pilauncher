use crate::services::terracotta;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn check_terracotta_installed<R: Runtime>(app: AppHandle<R>) -> Result<bool, String> {
    Ok(terracotta::is_terracotta_installed(&app).await)
}

#[tauri::command]
pub async fn create_p2p_room<R: Runtime>(
    app: AppHandle<R>,
    room: Option<String>,
    player: Option<String>,
    public_nodes: Vec<String>,
) -> Result<(), String> {
    terracotta::create_p2p_room(app.clone(), room, player, public_nodes).await
}

#[tauri::command]
pub async fn join_p2p_room<R: Runtime>(
    app: AppHandle<R>,
    room: String,
    player: Option<String>,
    public_nodes: Vec<String>,
) -> Result<(), String> {
    terracotta::join_p2p_room(app.clone(), room, player, public_nodes).await
}

#[tauri::command]
pub async fn stop_p2p_session<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    terracotta::stop_terracotta(app.clone()).await
}

#[tauri::command]
pub async fn set_p2p_idle<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    terracotta::set_p2p_idle(app.clone()).await
}
