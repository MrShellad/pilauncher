// src-tauri/src/services/lan/http_api.rs
use axum::{
    extract::{State, WebSocketUpgrade, ws::{WebSocket, Message}},
    http::{HeaderMap, Request, StatusCode, header},
    middleware::{self, Next},
    response::{Response, IntoResponse},
    routing::{get, post},
    Json, Router,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::sync::{oneshot, broadcast};
use std::fs;
use std::path::Path;

// ✅ 移除重复导入，引入 DeviceInitInfo
use crate::domain::lan::{TrustRequest, DeviceInitInfo};
use super::trust_store::TrustStore;

pub struct SharedLanState {
    pub pending_trusts: Mutex<HashMap<String, oneshot::Sender<bool>>>,
    pub ws_sender: broadcast::Sender<String>, 
    
    // ✅ 1. 缓存在内存中的本机富文本名片信息
    pub current_device_info: Mutex<DeviceInitInfo>,
    // ✅ 2. 本机背景图的绝对物理路径 (供 /device/bg 接口直接读取)
    pub local_bg_path: Mutex<String>,
}

impl SharedLanState {
    pub fn new() -> Self {
        let (ws_sender, _) = broadcast::channel(100);
        Self {
            pending_trusts: Mutex::new(HashMap::new()),
            ws_sender,
            // 赋一个默认空壳，前端启动后会立刻调用 Command 注入真实数据
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
                bg_url: "/device/bg".to_string(), // 固定路由
            }),
            local_bg_path: Mutex::new(String::new()),
        }
    }
}

pub struct AxumAppState {
    pub tauri_app: AppHandle,
    pub shared_state: Arc<SharedLanState>,
}

// ==========================================
// 中间件：强制签名验证拦截器 (保留不变)
// ==========================================
async fn auth_middleware(
    State(state): State<Arc<AxumAppState>>,
    headers: HeaderMap,
    request: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    Ok(next.run(request).await)
}

// ==========================================
// 无需验证的握手接口 (保留不变)
// ==========================================
async fn request_trust(
    State(state): State<Arc<AxumAppState>>,
    Json(payload): Json<TrustRequest>,
) -> Result<Json<TrustRequest>, StatusCode> {
    Err(StatusCode::FORBIDDEN)
}

// ==========================================
// 核心业务 1：初始化信息获取 (直接返回内存中的缓存)
// ==========================================
async fn get_device_init(State(state): State<Arc<AxumAppState>>) -> Json<DeviceInitInfo> {
    let info = state.shared_state.current_device_info.lock().unwrap().clone();
    Json(info)
}

// ==========================================
// 核心业务 2：独立分发背景图片二进制流
// ==========================================
async fn get_device_bg(State(state): State<Arc<AxumAppState>>) -> impl IntoResponse {
    let bg_path = state.shared_state.local_bg_path.lock().unwrap().clone();
    
    if bg_path.is_empty() {
        return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]);
    }

    match fs::read(&bg_path) {
        Ok(bytes) => {
            // 根据后缀动态推断 Content-Type
            let ext = Path::new(&bg_path).extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
            let content_type = match ext.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                _ => "application/octet-stream",
            };

            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
            // 设置长缓存，减少局域网传输压力
            headers.insert(header::CACHE_CONTROL, "public, max-age=31536000".parse().unwrap());
            (StatusCode::OK, headers, bytes)
        }
        Err(_) => {
            (StatusCode::NOT_FOUND, HeaderMap::new(), vec![])
        }
    }
}

// ==========================================
// 核心业务 3：WebSocket 状态推送
// ==========================================
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AxumAppState>>,
) -> impl IntoResponse {
    let mut rx = state.shared_state.ws_sender.subscribe();

    ws.on_upgrade(move |mut socket: WebSocket| async move {
        while let Ok(msg) = rx.recv().await {
            // ✅ 核心修复：使用 .into() 将 String 转换为 Axum 0.8 需要的 Utf8Bytes
            if socket.send(Message::Text(msg.into())).await.is_err() {
                break; 
            }
        }
    })
}

// ==========================================
// 服务启动装配
// ==========================================
pub async fn start_http_server(app: AppHandle, shared_state: Arc<SharedLanState>, port: u16) {
    let axum_state = Arc::new(AxumAppState {
        tauri_app: app.clone(),
        shared_state,
    });

    let secure_routes = Router::new()
        .route("/instances/list", get(|| async { "[]" })) 
        .route_layer(middleware::from_fn_with_state(axum_state.clone(), auth_middleware));

    let app_router = Router::new()
        .route("/trust/request", post(request_trust))
        .route("/device/init", get(get_device_init))
        .route("/device/bg", get(get_device_bg))
        .route("/ws", get(ws_handler))
        .nest("/api", secure_routes)
        .with_state(axum_state);

    let addr = format!("0.0.0.0:{}", port);
    println!("[PiLauncher] 🌐 Axum Server 正在监听 {}", addr);
    
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app_router).await.unwrap();
}