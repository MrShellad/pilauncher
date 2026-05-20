#[allow(unused_imports)]
use serde::{Deserialize, Serialize};
use std::sync::Arc;
#[allow(unused_imports)]
use std::time::Duration;
#[allow(unused_imports)]
use tauri::{AppHandle, Emitter, Manager, Runtime};
#[allow(unused_imports)]
use tauri_plugin_shell::process::CommandEvent;
#[allow(unused_imports)]
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex;
#[allow(unused_imports)]
use tokio::time::sleep;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerracottaStatePayload {
    pub state: String,
    pub index: u32,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

pub struct TerracottaState {
    pub child: Mutex<Option<tauri_plugin_shell::process::CommandChild>>,
    pub current_port: Mutex<Option<u16>>,
    pub is_running: Mutex<bool>,
}

impl TerracottaState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            current_port: Mutex::new(None),
            is_running: Mutex::new(false),
        }
    }
}

pub async fn is_terracotta_installed<R: Runtime>(_app: &AppHandle<R>) -> bool {
    // NOTE: Terracotta sidecar is temporarily disabled for CI compatibility.
    false
}

pub async fn start_terracotta<R: Runtime>(_app: AppHandle<R>) -> Result<u16, String> {
    // NOTE: Terracotta sidecar is temporarily disabled for CI compatibility.
    Err("Terracotta sidecar is temporarily disabled.".to_string())
}

pub async fn stop_terracotta<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<Arc<TerracottaState>>().inner().clone();
    *state.is_running.lock().await = false;

    let mut child_opt = state.child.lock().await;
    if let Some(child) = child_opt.take() {
        if let Some(port) = *state.current_port.lock().await {
            let client = reqwest::Client::new();
            let _ = client
                .get(format!("http://127.0.0.1:{}/panic?peaceful=true", port))
                .send()
                .await;
        }

        let _ = child.kill();
    }

    *state.current_port.lock().await = None;
    Ok(())
}

pub async fn create_p2p_room<R: Runtime>(
    app: AppHandle<R>,
    room: Option<String>,
    player: Option<String>,
    public_nodes: Vec<String>,
) -> Result<(), String> {
    let state = app.state::<Arc<TerracottaState>>().inner().clone();
    let mut port = *state.current_port.lock().await;

    if port.is_none() {
        port = Some(start_terracotta(app.clone()).await?);
    }

    let port = port.unwrap();
    let client = reqwest::Client::new();

    let mut query = Vec::new();
    if let Some(r) = room {
        query.push(format!("room={}", urlencoding::encode(&r)));
    }
    if let Some(p) = player {
        query.push(format!("player={}", urlencoding::encode(&p)));
    }
    for node in public_nodes {
        query.push(format!("public_nodes={}", urlencoding::encode(&node)));
    }

    let query_string = query.join("&");
    let url = format!("http://127.0.0.1:{}/state/scanning?{}", port, query_string);

    client.get(&url).send().await.map_err(|e| e.to_string())?;

    Ok(())
}

pub async fn join_p2p_room<R: Runtime>(
    app: AppHandle<R>,
    room: String,
    player: Option<String>,
    public_nodes: Vec<String>,
) -> Result<(), String> {
    let state = app.state::<Arc<TerracottaState>>().inner().clone();
    let mut port = *state.current_port.lock().await;

    if port.is_none() {
        port = Some(start_terracotta(app.clone()).await?);
    }

    let port = port.unwrap();
    let client = reqwest::Client::new();

    let mut query = vec![format!("room={}", urlencoding::encode(&room))];
    if let Some(p) = player {
        query.push(format!("player={}", urlencoding::encode(&p)));
    }
    for node in public_nodes {
        query.push(format!("public_nodes={}", urlencoding::encode(&node)));
    }

    let query_string = query.join("&");
    let url = format!("http://127.0.0.1:{}/state/guesting?{}", port, query_string);

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !resp.status().is_success() {
        return Err("Failed to join room, room code may be invalid.".to_string());
    }

    Ok(())
}

pub async fn set_p2p_idle<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<Arc<TerracottaState>>().inner().clone();
    let port = *state.current_port.lock().await;

    if let Some(port) = port {
        let client = reqwest::Client::new();
        let _ = client
            .get(format!("http://127.0.0.1:{}/state/ide", port))
            .send()
            .await;
    }
    Ok(())
}
