// src-tauri/src/services/lan/http_api.rs
use axum::{
    extract::State,
    http::{HeaderMap, Request, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::oneshot;

use super::trust_store::TrustStore;
use crate::domain::lan::TrustRequest;
use crate::services::config_service::ConfigService;

pub struct SharedLanState {
    pub pending_trusts: Mutex<HashMap<String, oneshot::Sender<bool>>>,
}

impl SharedLanState {
    pub fn new() -> Self {
        Self {
            pending_trusts: Mutex::new(HashMap::new()),
        }
    }
}

pub struct AxumAppState {
    pub tauri_app: AppHandle,
    pub shared_state: Arc<SharedLanState>,
}

// ==========================================
// 中间件：强制签名验证拦截器
// ==========================================
async fn auth_middleware(
    State(state): State<Arc<AxumAppState>>,
    headers: HeaderMap,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let device_id = headers.get("X-Device-Id").and_then(|h| h.to_str().ok()).ok_or(StatusCode::UNAUTHORIZED)?;
    let signature = headers.get("X-Signature").and_then(|h| h.to_str().ok()).ok_or(StatusCode::UNAUTHORIZED)?;
    let timestamp = headers.get("X-Timestamp")
        .and_then(|h| h.to_str().ok())
        .and_then(|t| t.parse::<i64>().ok())
        .ok_or(StatusCode::UNAUTHORIZED)?;

    // ✅ 修复：安全获取目录，如果不存在，直接拒绝 HTTP 访问，绝不引发 panic
    let base_path = match ConfigService::get_base_path(&state.tauri_app) {
        Ok(Some(path)) => path,
        _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
    };
    
    let config_dir = std::path::PathBuf::from(base_path).join("config");
    let uri = request.uri().path().to_string();

    if TrustStore::verify_request(&config_dir, device_id, &uri, timestamp, signature) {
        Ok(next.run(request).await)
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

// ==========================================
// 路由控制器：处理外部设备的连接握手
// ==========================================
async fn handle_trust_request(
    State(state): State<Arc<AxumAppState>>,
    Json(payload): Json<TrustRequest>,
) -> Result<Json<TrustRequest>, StatusCode> {
    let (tx, rx) = oneshot::channel();
    state.shared_state.pending_trusts.lock().unwrap().insert(payload.device_id.clone(), tx);

    state.tauri_app.emit("incoming-trust-request", payload.clone()).unwrap();

    match tokio::time::timeout(std::time::Duration::from_secs(45), rx).await {
        Ok(Ok(true)) => {
            // ✅ 修复：安全获取目录
            let base_path = match ConfigService::get_base_path(&state.tauri_app) {
                Ok(Some(path)) => path,
                _ => return Err(StatusCode::INTERNAL_SERVER_ERROR),
            };
            
            let config_dir = std::path::PathBuf::from(base_path).join("config");
            let my_id = TrustStore::get_or_create_identity(&config_dir);

            Ok(Json(TrustRequest {
                device_id: my_id.device_id,
                device_name: my_id.device_name,
                public_key: my_id.public_key_b64,
            }))
        }
        _ => Err(StatusCode::FORBIDDEN),
    }
}

// ==========================================
// 路由控制器：安全的业务接口
// ==========================================
async fn get_device_info() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "version": "1.0.0" }))
}

pub async fn start_http_server(app: AppHandle, shared_state: Arc<SharedLanState>, port: u16) {
    let axum_state = Arc::new(AxumAppState {
        tauri_app: app.clone(),
        shared_state,
    });

    let secure_routes = Router::new()
        .route("/devices/info", get(get_device_info))
        .route("/instances/list", get(|| async { "[]" })) 
        .route("/instances/export", post(|| async { "export" }))
        .route("/saves/list", get(|| async { "[]" }))
        .route("/saves/download", post(|| async { "download" }))
        .route_layer(middleware::from_fn_with_state(axum_state.clone(), auth_middleware));

    let app_router = Router::new()
        .route("/api/trust/request", post(handle_trust_request)) 
        .nest("/api", secure_routes)
        .with_state(axum_state);

    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await.unwrap();
    axum::serve(listener, app_router).await.unwrap();
}