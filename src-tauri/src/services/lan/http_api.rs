// src-tauri/src/services/lan/http_api.rs
use axum::{
    body::Bytes,
    extract::{Query, State, WebSocketUpgrade, ws::{WebSocket, Message}},
    http::{HeaderMap, Request, StatusCode, header, Method},
    middleware::{self, Next},
    response::{Response, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json; 
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter}; 
use tokio::sync::{oneshot, broadcast};
use std::fs;
use std::path::PathBuf; 

// ✅ 引入跨域中间件
use tower_http::cors::{Any, CorsLayer};

use crate::domain::lan::{TrustRequest, DeviceInitInfo};
use crate::services::config_service::ConfigService;
use crate::services::lan::trust_store::TrustStore;

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

#[derive(Deserialize)]
struct DeviceAvatarQuery {
    user_uuid: Option<String>,
}

fn is_safe_user_uuid(user_uuid: &str) -> bool {
    !user_uuid.is_empty()
        && user_uuid
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-')
}

pub struct SharedLanState {
    pub pending_trusts: Mutex<HashMap<String, oneshot::Sender<Option<TrustRequest>>>>,
    pub ws_sender: broadcast::Sender<String>, 
    
    pub current_device_info: Mutex<DeviceInitInfo>,
    pub local_bg_path: Mutex<String>,
}

impl SharedLanState {
    pub fn new() -> Self {
        let (ws_sender, _) = broadcast::channel(100);
        Self {
            pending_trusts: Mutex::new(HashMap::new()),
            ws_sender,
            current_device_info: Mutex::new(DeviceInitInfo {
                device_id: String::new(),
                device_name: String::new(),
                username: String::new(),
                user_uuid: String::new(),
                is_premium: false,
                is_donor: false,
                launcher_version: env!("CARGO_PKG_VERSION").to_string(),
                instance_name: None,
                instance_id: None,
                bg_url: "/device/bg".to_string(), 
            }),
            local_bg_path: Mutex::new(String::new()),
        }
    }
}

pub struct AxumAppState {
    pub tauri_app: AppHandle,
    pub shared_state: Arc<SharedLanState>,
}

async fn auth_middleware(
    State(_state): State<Arc<AxumAppState>>,
    _headers: HeaderMap,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    Ok(next.run(request).await)
}

// ==========================================
// 核心握手接口
// ==========================================
async fn request_trust(
    State(state): State<Arc<AxumAppState>>,
    Json(payload): Json<TrustRequest>,
) -> Result<Json<TrustRequest>, StatusCode> {
    // 检查是否拥有相同的游戏账号 UUID，如果是，则自动信任
    let my_user_uuid = state.shared_state.current_device_info.lock().unwrap().user_uuid.clone();
    let is_same_user = !my_user_uuid.is_empty() && my_user_uuid == payload.user_uuid;

    if is_same_user {
        let base_path = ConfigService::get_base_path(&state.tauri_app).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.unwrap_or_default();
        let config_dir = std::path::PathBuf::from(base_path).join("config");
        let my_identity = TrustStore::get_or_create_identity(&config_dir);
        
        let db = state.tauri_app.state::<crate::services::db_service::AppDatabase>();
        let _ = TrustStore::add_trusted_device(
            &db.pool, 
            payload.device_id.clone(), 
            payload.device_name.clone(), 
            payload.user_uuid.clone(),
            payload.public_key.clone()
        ).await;
        
        // 发送更新事件刷新前端
        let _ = state.tauri_app.emit("trust_list_updated", json!({}));
        
        return Ok(Json(TrustRequest {
            device_id: my_identity.device_id,
            device_name: my_identity.device_name,
            user_uuid: my_identity.user_uuid,
            public_key: my_identity.public_key_b64,
        }));
    }

    let (tx, rx) = oneshot::channel();
    
    {
        let mut pending = state.shared_state.pending_trusts.lock().unwrap();
        pending.insert(payload.device_id.clone(), tx);
    }

    let _ = state.tauri_app.emit("trust_request_received", json!({
        "device_id": payload.device_id,
        "device_name": payload.device_name,
        "user_uuid": payload.user_uuid,
        "public_key": payload.public_key 
    }));

    match rx.await {
        Ok(Some(my_identity)) => Ok(Json(my_identity)),
        _ => Err(StatusCode::FORBIDDEN),               
    }
}

async fn get_device_init(State(state): State<Arc<AxumAppState>>) -> Json<DeviceInitInfo> {
    let info = state.shared_state.current_device_info.lock().unwrap().clone();
    Json(info)
}

async fn get_device_bg(State(state): State<Arc<AxumAppState>>) -> impl IntoResponse {
    let bg_path = state.shared_state.local_bg_path.lock().unwrap().clone();
    if bg_path.is_empty() { return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]); }
    match fs::read(&bg_path) {
        Ok(bytes) => {
            let ext = std::path::Path::new(&bg_path).extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            let content_type = match ext.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                _ => "application/octet-stream",
            };
            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
            headers.insert(header::CACHE_CONTROL, "public, max-age=31536000".parse().unwrap());
            (StatusCode::OK, headers, bytes)
        }
        Err(_) => (StatusCode::NOT_FOUND, HeaderMap::new(), vec![])
    }
}

async fn get_device_avatar(
    State(state): State<Arc<AxumAppState>>,
    Query(query): Query<DeviceAvatarQuery>,
) -> impl IntoResponse {
    let user_uuid = query
        .user_uuid
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| {
            state
                .shared_state
                .current_device_info
                .lock()
                .unwrap()
                .user_uuid
                .clone()
        });

    if !is_safe_user_uuid(&user_uuid) {
        return (StatusCode::BAD_REQUEST, HeaderMap::new(), vec![]);
    }

    let base_path = match ConfigService::get_base_path(&state.tauri_app).ok().flatten() {
        Some(path) => path,
        None => return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]),
    };

    let avatar_path = PathBuf::from(base_path)
        .join("runtime")
        .join("accounts")
        .join(&user_uuid)
        .join("avatar.png");

    let bytes = match fs::read(avatar_path) {
        Ok(bytes) => bytes,
        Err(_) => return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]),
    };

    let is_valid_png = bytes.len() > PNG_SIGNATURE.len() && bytes.starts_with(&PNG_SIGNATURE);
    if !is_valid_png {
        return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]);
    }

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/png".parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    (StatusCode::OK, headers, bytes)
}

async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AxumAppState>>) -> impl IntoResponse {
    let mut rx = state.shared_state.ws_sender.subscribe();
    ws.on_upgrade(move |mut socket: WebSocket| async move {
        while let Ok(msg) = rx.recv().await {
            if socket.send(Message::Text(msg.into())).await.is_err() { break; }
        }
    })
}

async fn receive_transfer(
    State(state): State<Arc<AxumAppState>>, headers: HeaderMap, body: Bytes,
) -> impl IntoResponse {
    let t_type = headers.get("X-Transfer-Type").and_then(|v| v.to_str().ok()).unwrap_or("unknown");
    let t_name = headers.get("X-Transfer-Name").and_then(|v| v.to_str().ok()).unwrap_or("Unnamed");
    let from_dev = headers.get("X-Device-Name").and_then(|v| v.to_str().ok()).unwrap_or("Lan Device");

    let temp_id = uuid::Uuid::new_v4().to_string();
    let app_dir = state.tauri_app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let temp_dir = app_dir.join("temp_transfers");
    fs::create_dir_all(&temp_dir).ok();
    
    let temp_path = temp_dir.join(format!("{}.zip", temp_id));
    if fs::write(&temp_path, body).is_ok() {
        let _ = state.tauri_app.emit("transfer_received", json!({
            "id": temp_id, "type": t_type, "name": t_name, "from": from_dev, "tempPath": temp_path.to_string_lossy().to_string()
        }));
        (StatusCode::OK, "Received")
    } else {
        (StatusCode::INTERNAL_SERVER_ERROR, "Disk Error")
    }
}

// ==========================================
// 服务启动装配
// ==========================================
pub async fn start_http_server(app: AppHandle, shared_state: Arc<SharedLanState>, port: u16) {
    let axum_state = Arc::new(AxumAppState { tauri_app: app.clone(), shared_state });
    
    let secure_routes = Router::new()
        .route("/instances/list", get(|| async { "[]" })) 
        .route("/transfer/receive", post(receive_transfer))
        .route_layer(middleware::from_fn_with_state(axum_state.clone(), auth_middleware));

    // ✅ 构建全局跨域规则：允许所有源、所有方法、所有自定义 Header（包含我们要发送的 X-Transfer-Type 等）
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers(Any);

    let app_router = Router::new()
        .route("/trust/request", post(request_trust))
        .route("/device/init", get(get_device_init))
        .route("/device/bg", get(get_device_bg))
        .route("/device/avatar", get(get_device_avatar))
        .route("/ws", get(ws_handler))
        .nest("/api", secure_routes)
        .layer(cors) // ✅ 将跨域层包裹在最外层
        .with_state(axum_state);

    let addr = format!("0.0.0.0:{}", port);
    println!("[PiLauncher] 🌐 Axum Server 正在监听 {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app_router).await.unwrap();
}
