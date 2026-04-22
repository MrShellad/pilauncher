use axum::{
    extract::{
        ws::{Message, WebSocket},
        Query, State, WebSocketUpgrade,
    },
    http::{header, HeaderMap, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use futures::StreamExt;
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::AsyncWriteExt;
use tokio::sync::{broadcast, oneshot};
use tower_http::cors::{Any, CorsLayer};

use crate::domain::lan::{DeviceInitInfo, TrustRequest};
use crate::services::config_service::ConfigService;
use crate::services::db_service::AppDatabase;
use crate::services::lan::transfer_records::{
    emit_transfer_progress, upsert_transfer_record, TransferRecordUpsert,
};
use crate::services::lan::trust_store::TrustStore;

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

#[derive(Deserialize)]
struct DeviceAvatarQuery {
    user_uuid: Option<String>,
}

fn is_safe_user_uuid(user_uuid: &str) -> bool {
    !user_uuid.is_empty() && user_uuid.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn decode_header_value(headers: &HeaderMap, name: &str, fallback: &str) -> String {
    headers
        .get(name)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| urlencoding::decode(value).ok())
        .map(|value| value.into_owned())
        .unwrap_or_else(|| fallback.to_string())
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

async fn request_trust(
    State(state): State<Arc<AxumAppState>>,
    Json(payload): Json<TrustRequest>,
) -> Result<Json<TrustRequest>, StatusCode> {
    let my_user_uuid = state
        .shared_state
        .current_device_info
        .lock()
        .unwrap()
        .user_uuid
        .clone();
    let request_kind = payload
        .request_kind
        .clone()
        .unwrap_or_else(|| "friend".to_string());
    let is_same_user = !my_user_uuid.is_empty() && my_user_uuid == payload.user_uuid;

    if is_same_user {
        let base_path = ConfigService::get_base_path(&state.tauri_app)
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .unwrap_or_default();
        let config_dir = PathBuf::from(base_path).join("config");
        let my_identity = TrustStore::get_or_create_identity(&config_dir);
        let db = state.tauri_app.state::<AppDatabase>();
        let target_username = payload.username.clone().unwrap_or_default();

        let relationship_result = if request_kind == "trusted" {
            TrustStore::add_trusted_device(
                &db.pool,
                payload.device_id.clone(),
                payload.device_name.clone(),
                payload.user_uuid.clone(),
                target_username,
                payload.public_key.clone(),
            )
            .await
        } else {
            TrustStore::add_friend_device(
                &db.pool,
                payload.device_id.clone(),
                payload.device_name.clone(),
                payload.user_uuid.clone(),
                target_username,
                payload.public_key.clone(),
            )
            .await
        };

        relationship_result.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
        let _ = state.tauri_app.emit("trust_list_updated", json!({}));

        let current_info = state
            .shared_state
            .current_device_info
            .lock()
            .unwrap()
            .clone();

        return Ok(Json(TrustRequest {
            device_id: if !current_info.device_id.trim().is_empty() { current_info.device_id.clone() } else { my_identity.device_id },
            device_name: if !current_info.device_name.trim().is_empty() { current_info.device_name.clone() } else { my_identity.device_name },
            user_uuid: if !current_info.user_uuid.trim().is_empty() { current_info.user_uuid.clone() } else { my_identity.user_uuid },
            public_key: my_identity.public_key_b64,
            username: (!current_info.username.trim().is_empty()).then(|| current_info.username),
            request_kind: Some(request_kind),
        }));
    }

    let (tx, rx) = oneshot::channel();
    state
        .shared_state
        .pending_trusts
        .lock()
        .unwrap()
        .insert(payload.device_id.clone(), tx);

    let _ = state.tauri_app.emit(
        "trust_request_received",
        json!({
            "device_id": payload.device_id,
            "device_name": payload.device_name,
            "user_uuid": payload.user_uuid,
            "public_key": payload.public_key,
            "username": payload.username.unwrap_or_default(),
            "request_kind": request_kind,
        }),
    );

    match rx.await {
        Ok(Some(my_identity)) => Ok(Json(my_identity)),
        _ => Err(StatusCode::FORBIDDEN),
    }
}

async fn get_device_init(State(state): State<Arc<AxumAppState>>) -> Json<DeviceInitInfo> {
    Json(
        state
            .shared_state
            .current_device_info
            .lock()
            .unwrap()
            .clone(),
    )
}

async fn get_device_bg(State(state): State<Arc<AxumAppState>>) -> impl IntoResponse {
    let bg_path = state.shared_state.local_bg_path.lock().unwrap().clone();
    if bg_path.is_empty() {
        return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]);
    }

    match fs::read(&bg_path) {
        Ok(bytes) => {
            let ext = std::path::Path::new(&bg_path)
                .extension()
                .and_then(|item| item.to_str())
                .unwrap_or("")
                .to_lowercase();
            let content_type = match ext.as_str() {
                "png" => "image/png",
                "jpg" | "jpeg" => "image/jpeg",
                "webp" => "image/webp",
                "gif" => "image/gif",
                _ => "application/octet-stream",
            };

            let mut headers = HeaderMap::new();
            headers.insert(header::CONTENT_TYPE, content_type.parse().unwrap());
            headers.insert(
                header::CACHE_CONTROL,
                "public, max-age=31536000".parse().unwrap(),
            );
            (StatusCode::OK, headers, bytes)
        }
        Err(_) => (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]),
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

    let base_path = match ConfigService::get_base_path(&state.tauri_app)
        .ok()
        .flatten()
    {
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

    if bytes.len() <= PNG_SIGNATURE.len() || !bytes.starts_with(&PNG_SIGNATURE) {
        return (StatusCode::NOT_FOUND, HeaderMap::new(), vec![]);
    }

    let mut headers = HeaderMap::new();
    headers.insert(header::CONTENT_TYPE, "image/png".parse().unwrap());
    headers.insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    (StatusCode::OK, headers, bytes)
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AxumAppState>>,
) -> impl IntoResponse {
    let mut rx = state.shared_state.ws_sender.subscribe();
    ws.on_upgrade(move |mut socket: WebSocket| async move {
        while let Ok(message) = rx.recv().await {
            if socket.send(Message::Text(message.into())).await.is_err() {
                break;
            }
        }
    })
}

async fn receive_transfer(
    State(state): State<Arc<AxumAppState>>,
    headers: HeaderMap,
    request: Request<axum::body::Body>,
) -> impl IntoResponse {
    let transfer_id = headers
        .get("X-Transfer-Id")
        .and_then(|value| value.to_str().ok())
        .map(|value| value.to_string())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let transfer_type = headers
        .get("X-Transfer-Type")
        .and_then(|value| value.to_str().ok())
        .unwrap_or("unknown")
        .to_string();
    let transfer_name = decode_header_value(&headers, "X-Transfer-Name", "Unnamed");
    let from_device_name = decode_header_value(&headers, "X-Device-Name", "LAN Device");
    let from_device_id = headers
        .get("X-Device-Id")
        .and_then(|value| value.to_str().ok())
        .unwrap_or_default()
        .to_string();
    let from_username = decode_header_value(&headers, "X-Username", "");
    let total = headers
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok())
        .unwrap_or(0);

    let app_dir = state
        .tauri_app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    let temp_dir = app_dir.join("temp_transfers");
    if let Err(error) = fs::create_dir_all(&temp_dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Create temp dir failed: {}", error),
        );
    }

    let temp_path = temp_dir.join(format!("{}.zip", transfer_id));
    let mut file = match tokio::fs::File::create(&temp_path).await {
        Ok(file) => file,
        Err(error) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Create temp file failed: {}", error),
            );
        }
    };

    emit_transfer_progress(
        &state.tauri_app,
        &crate::domain::lan::TransferProgressEvent {
            transfer_id: transfer_id.clone(),
            direction: "incoming".to_string(),
            remote_device_id: from_device_id.clone(),
            remote_device_name: from_device_name.clone(),
            remote_username: from_username.clone(),
            transfer_type: transfer_type.clone(),
            name: transfer_name.clone(),
            status: "receiving".to_string(),
            stage: "RECEIVING".to_string(),
            current: 0,
            total,
            message: "正在接收来自局域网设备的传输内容".to_string(),
        },
    );

    let mut received = 0_u64;
    let mut body = request.into_body().into_data_stream();
    while let Some(next_chunk) = body.next().await {
        let chunk = match next_chunk {
            Ok(chunk) => chunk,
            Err(error) => {
                let _ = tokio::fs::remove_file(&temp_path).await;
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    format!("Read body failed: {}", error),
                );
            }
        };

        if let Err(error) = file.write_all(&chunk).await {
            let _ = tokio::fs::remove_file(&temp_path).await;
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Write temp file failed: {}", error),
            );
        }

        received += chunk.len() as u64;
        emit_transfer_progress(
            &state.tauri_app,
            &crate::domain::lan::TransferProgressEvent {
                transfer_id: transfer_id.clone(),
                direction: "incoming".to_string(),
                remote_device_id: from_device_id.clone(),
                remote_device_name: from_device_name.clone(),
                remote_username: from_username.clone(),
                transfer_type: transfer_type.clone(),
                name: transfer_name.clone(),
                status: "receiving".to_string(),
                stage: "RECEIVING".to_string(),
                current: received,
                total,
                message: "正在接收压缩包数据".to_string(),
            },
        );
    }

    if let Err(error) = file.flush().await {
        let _ = tokio::fs::remove_file(&temp_path).await;
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Flush temp file failed: {}", error),
        );
    }

    let current_info = state
        .shared_state
        .current_device_info
        .lock()
        .unwrap()
        .clone();
    let db = state.tauri_app.state::<AppDatabase>();
    let _ = upsert_transfer_record(
        &state.tauri_app,
        &db,
        TransferRecordUpsert {
            transfer_id: &transfer_id,
            direction: "incoming",
            sender_device_id: &from_device_id,
            sender_device: &from_device_name,
            receiver_device_id: &current_info.device_id,
            receiver_device: &current_info.device_name,
            remote_device_id: &from_device_id,
            remote_device_name: &from_device_name,
            remote_username: &from_username,
            transfer_type: &transfer_type,
            name: &transfer_name,
            size: received as i64,
            status: "received".to_string(),
            error_message: None,
            mark_completed: false,
        },
    )
    .await;

    emit_transfer_progress(
        &state.tauri_app,
        &crate::domain::lan::TransferProgressEvent {
            transfer_id: transfer_id.clone(),
            direction: "incoming".to_string(),
            remote_device_id: from_device_id.clone(),
            remote_device_name: from_device_name.clone(),
            remote_username: from_username.clone(),
            transfer_type: transfer_type.clone(),
            name: transfer_name.clone(),
            status: "received".to_string(),
            stage: "RECEIVED".to_string(),
            current: received,
            total: if total == 0 { received } else { total },
            message: "文件已接收，等待用户确认".to_string(),
        },
    );

    let _ = state.tauri_app.emit(
        "transfer_received",
        json!({
            "id": transfer_id,
            "type": transfer_type,
            "name": transfer_name,
            "from": from_device_name,
            "fromDeviceId": from_device_id,
            "fromUsername": from_username,
            "tempPath": temp_path.to_string_lossy().to_string(),
        }),
    );

    (StatusCode::OK, "Received".to_string())
}

pub async fn start_http_server(app: AppHandle, shared_state: Arc<SharedLanState>, port: u16) {
    let axum_state = Arc::new(AxumAppState {
        tauri_app: app.clone(),
        shared_state,
    });

    let secure_routes = Router::new()
        .route("/instances/list", get(|| async { "[]" }))
        .route("/transfer/receive", post(receive_transfer))
        .route_layer(middleware::from_fn_with_state(
            axum_state.clone(),
            auth_middleware,
        ));

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
        .layer(cors)
        .with_state(axum_state);

    let addr = format!("0.0.0.0:{}", port);
    println!("[PiLauncher] Axum Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app_router).await.unwrap();
}
