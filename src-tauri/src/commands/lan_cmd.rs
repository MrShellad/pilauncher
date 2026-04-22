use crate::domain::lan::{
    DeviceInitInfo, DiscoveredDevice, OnlineDeviceCheck, TransferProgressEvent, TransferRecord,
    TrustRequest, TrustedDevice,
};
use crate::services::config_service::ConfigService;
use crate::services::db_service::AppDatabase;
use crate::services::lan::http_api::SharedLanState;
use crate::services::lan::mdns_service::MdnsScanner;
use crate::services::lan::transfer_records::{
    emit_transfer_progress, fetch_transfer_history as fetch_transfer_history_records,
    upsert_transfer_record, TransferRecordUpsert,
};
use crate::services::lan::transfer_service;
use crate::services::lan::trust_store::TrustStore;
use futures::stream;
use sqlx::Row;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::io::AsyncReadExt;

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

fn is_safe_user_uuid(user_uuid: &str) -> bool {
    !user_uuid.is_empty() && user_uuid.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn is_valid_png(bytes: &[u8]) -> bool {
    bytes.len() > PNG_SIGNATURE.len() && bytes.starts_with(&PNG_SIGNATURE)
}

fn normalize_request_kind(value: Option<&str>) -> &'static str {
    match value
        .unwrap_or("friend")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "trusted" => "trusted",
        _ => "friend",
    }
}

async fn fetch_remote_device_info(target_ip: &str, target_port: u16) -> Option<DeviceInitInfo> {
    let url = format!("http://{}:{}/device/init", target_ip, target_port);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .ok()?;
    let response = client.get(url).send().await.ok()?;
    if !response.status().is_success() {
        return None;
    }
    response.json::<DeviceInitInfo>().await.ok()
}

fn build_progress_event(
    transfer_id: &str,
    direction: &str,
    remote_device_id: &str,
    remote_device_name: &str,
    remote_username: &str,
    transfer_type: &str,
    name: &str,
    status: &str,
    stage: &str,
    current: u64,
    total: u64,
    message: String,
) -> TransferProgressEvent {
    TransferProgressEvent {
        transfer_id: transfer_id.to_string(),
        direction: direction.to_string(),
        remote_device_id: remote_device_id.to_string(),
        remote_device_name: remote_device_name.to_string(),
        remote_username: remote_username.to_string(),
        transfer_type: transfer_type.to_string(),
        name: name.to_string(),
        status: status.to_string(),
        stage: stage.to_string(),
        current,
        total,
        message,
    }
}

#[tauri::command]
pub async fn scan_lan_devices() -> Result<Vec<DiscoveredDevice>, String> {
    MdnsScanner::scan_for_seconds(3).await
}

#[tauri::command]
pub async fn send_trust_request<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    target_ip: String,
    target_port: u16,
    request_kind: Option<String>,
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let config_dir = std::path::PathBuf::from(&base_path).join("config");
    let my_identity = TrustStore::get_or_create_identity(&config_dir);
    let shared_state = app.state::<Arc<SharedLanState>>();
    let current_info = shared_state.current_device_info.lock().unwrap().clone();
    let request_kind = normalize_request_kind(request_kind.as_deref());

    let req_payload = TrustRequest {
        device_id: if !current_info.device_id.trim().is_empty() { current_info.device_id.clone() } else { my_identity.device_id.clone() },
        device_name: if !current_info.device_name.trim().is_empty() { current_info.device_name.clone() } else { my_identity.device_name.clone() },
        user_uuid: if !current_info.user_uuid.trim().is_empty() { current_info.user_uuid.clone() } else { my_identity.user_uuid.clone() },
        public_key: my_identity.public_key_b64.clone(),
        username: (!current_info.username.trim().is_empty()).then(|| current_info.username.clone()),
        request_kind: Some(request_kind.to_string()),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let url = format!("http://{}:{}/trust/request", target_ip, target_port);
    let response = client
        .post(&url)
        .json(&req_payload)
        .send()
        .await
        .map_err(|_| "缃戠粶杩炴帴澶辫触".to_string())?;

    if !response.status().is_success() {
        return Err("瀵规柟鎷掔粷浜嗘偍鐨勮姹傦紝鎴栨搷浣滃凡瓒呮椂銆?".to_string());
    }

    let target_identity = response
        .json::<TrustRequest>()
        .await
        .map_err(|_| "瀵规柟鏁版嵁鏍煎紡寮傚父".to_string())?;
    let remote_info = fetch_remote_device_info(&target_ip, target_port).await;
    let remote_username = remote_info
        .as_ref()
        .map(|info| info.username.clone())
        .or_else(|| target_identity.username.clone())
        .unwrap_or_default();
    let remote_device_name = remote_info
        .as_ref()
        .map(|info| info.device_name.clone())
        .unwrap_or_else(|| target_identity.device_name.clone());

    if request_kind == "trusted" {
        TrustStore::add_trusted_device(
            &db.pool,
            target_identity.device_id,
            remote_device_name,
            target_identity.user_uuid,
            remote_username,
            target_identity.public_key,
        )
        .await?;
    } else {
        TrustStore::add_friend_device(
            &db.pool,
            target_identity.device_id,
            remote_device_name,
            target_identity.user_uuid,
            remote_username,
            target_identity.public_key,
        )
        .await?;
    }

    Ok(())
}

#[tauri::command]
pub async fn resolve_trust_request<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<SharedLanState>>,
    db: State<'_, AppDatabase>,
    device_id: String,
    accept: bool,
    device_name: String,
    user_uuid: String,
    username: String,
    public_key: String,
    request_kind: Option<String>,
) -> Result<(), String> {
    let normalized_kind = normalize_request_kind(request_kind.as_deref());

    let response_payload = if accept {
        let base_path = ConfigService::get_base_path(&app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();
        let config_dir = std::path::PathBuf::from(base_path).join("config");

        if normalized_kind == "trusted" {
            TrustStore::add_trusted_device(
                &db.pool,
                device_id.clone(),
                device_name.clone(),
                user_uuid.clone(),
                username.clone(),
                public_key.clone(),
            )
            .await?;
        } else {
            TrustStore::add_friend_device(
                &db.pool,
                device_id.clone(),
                device_name.clone(),
                user_uuid.clone(),
                username.clone(),
                public_key.clone(),
            )
            .await?;
        }

        let my_identity = TrustStore::get_or_create_identity(&config_dir);
        let current_info = state.current_device_info.lock().unwrap().clone();
        Some(TrustRequest {
            device_id: if !current_info.device_id.trim().is_empty() { current_info.device_id.clone() } else { my_identity.device_id },
            device_name: if !current_info.device_name.trim().is_empty() { current_info.device_name.clone() } else { my_identity.device_name },
            user_uuid: if !current_info.user_uuid.trim().is_empty() { current_info.user_uuid.clone() } else { my_identity.user_uuid },
            public_key: my_identity.public_key_b64,
            username: (!current_info.username.trim().is_empty()).then(|| current_info.username),
            request_kind: Some(normalized_kind.to_string()),
        })
    } else {
        None
    };

    if let Some(tx) = state.pending_trusts.lock().unwrap().remove(&device_id) {
        let _ = tx.send(response_payload);
    }
    Ok(())
}

#[tauri::command]
pub async fn update_lan_device_info(
    state: State<'_, Arc<SharedLanState>>,
    info: DeviceInitInfo,
    local_bg_path: String,
) -> Result<(), String> {
    let mut current_info = state.current_device_info.lock().unwrap();
    *current_info = info;
    let mut bg_path = state.local_bg_path.lock().unwrap();
    *bg_path = local_bg_path;
    Ok(())
}

#[tauri::command]
pub async fn sync_lan_avatar<R: Runtime>(
    app: AppHandle<R>,
    target_ip: String,
    target_port: u16,
    user_uuid: String,
) -> Result<String, String> {
    if !is_safe_user_uuid(&user_uuid) {
        return Err("非法的用户 UUID".to_string());
    }

    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置启动器基础数据目录".to_string())?;

    let account_dir = PathBuf::from(base_path)
        .join("runtime")
        .join("accounts")
        .join(&user_uuid);
    fs::create_dir_all(&account_dir).map_err(|e| format!("创建头像缓存目录失败: {}", e))?;

    let avatar_path = account_dir.join("avatar.png");
    if let Ok(existing_bytes) = fs::read(&avatar_path) {
        if is_valid_png(&existing_bytes) {
            return Ok(avatar_path.to_string_lossy().to_string());
        }
        let _ = fs::remove_file(&avatar_path);
    }

    let url = format!(
        "http://{}:{}/device/avatar?user_uuid={}",
        target_ip, target_port, user_uuid
    );

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .build()
        .map_err(|e| format!("创建请求客户端失败: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("请求局域网头像失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("局域网头像接口返回状态码 {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("读取头像响应失败: {}", e))?;

    if !is_valid_png(bytes.as_ref()) {
        return Err("局域网头像数据不是有效 PNG".to_string());
    }

    fs::write(&avatar_path, bytes.as_ref()).map_err(|e| format!("写入本地头像失败: {}", e))?;
    Ok(avatar_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_trusted_devices(db: State<'_, AppDatabase>) -> Result<Vec<TrustedDevice>, String> {
    let rows = sqlx::query(
        "SELECT device_uuid, device_name, user_uuid, username, public_key_b64, trust_level,
                strftime('%s', trusted_at) AS ts
         FROM trusted_devices
         WHERE trust_level = 'trusted'
         ORDER BY trusted_at DESC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("查询已信任设备失败: {}", e))?;

    rows.into_iter()
        .map(|row| {
            let trusted_at = row
                .try_get::<String, _>("ts")
                .unwrap_or_else(|_| "0".to_string())
                .parse::<i64>()
                .unwrap_or(0);

            Ok(TrustedDevice {
                device_id: row.try_get("device_uuid").map_err(|e| e.to_string())?,
                device_name: row.try_get("device_name").map_err(|e| e.to_string())?,
                user_uuid: row.try_get("user_uuid").unwrap_or_default(),
                username: row.try_get("username").unwrap_or_default(),
                public_key_b64: row.try_get("public_key_b64").unwrap_or_default(),
                trusted_at,
                trust_level: row
                    .try_get("trust_level")
                    .unwrap_or_else(|_| "trusted".to_string()),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn get_friend_devices(db: State<'_, AppDatabase>) -> Result<Vec<TrustedDevice>, String> {
    let rows = sqlx::query(
        "SELECT device_uuid, device_name, user_uuid, username, public_key_b64, trust_level,
                strftime('%s', trusted_at) AS ts
         FROM trusted_devices
         WHERE trust_level IN ('friend', 'trusted')
         ORDER BY CASE trust_level WHEN 'trusted' THEN 0 ELSE 1 END, trusted_at DESC",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("查询好友设备失败: {}", e))?;

    rows.into_iter()
        .map(|row| {
            let trusted_at = row
                .try_get::<String, _>("ts")
                .unwrap_or_else(|_| "0".to_string())
                .parse::<i64>()
                .unwrap_or(0);

            Ok(TrustedDevice {
                device_id: row.try_get("device_uuid").map_err(|e| e.to_string())?,
                device_name: row.try_get("device_name").map_err(|e| e.to_string())?,
                user_uuid: row.try_get("user_uuid").unwrap_or_default(),
                username: row.try_get("username").unwrap_or_default(),
                public_key_b64: row.try_get("public_key_b64").unwrap_or_default(),
                trusted_at,
                trust_level: row
                    .try_get("trust_level")
                    .unwrap_or_else(|_| "friend".to_string()),
            })
        })
        .collect()
}

#[tauri::command]
pub async fn trust_device(
    db: State<'_, AppDatabase>,
    device_id: String,
    device_name: String,
    user_uuid: String,
    username: String,
    public_key_b64: String,
) -> Result<(), String> {
    TrustStore::add_trusted_device(
        &db.pool,
        device_id,
        device_name,
        user_uuid,
        username,
        public_key_b64,
    )
    .await
}

#[tauri::command]
pub async fn remove_trusted_device(
    db: State<'_, AppDatabase>,
    device_id: String,
) -> Result<(), String> {
    sqlx::query(
        "UPDATE trusted_devices
         SET trust_level = 'friend'
         WHERE device_uuid = $1 AND trust_level = 'trusted'",
    )
    .bind(&device_id)
    .execute(&db.pool)
    .await
    .map_err(|e| format!("取消设备信任失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn verify_trusted_devices(
    db: State<'_, AppDatabase>,
    online_devices: Vec<OnlineDeviceCheck>,
) -> Result<Vec<String>, String> {
    let rows = sqlx::query(
        "SELECT device_uuid, device_name, public_key_b64
         FROM trusted_devices
         WHERE trust_level = 'trusted'",
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("查询设备信任状态失败: {}", e))?;

    let mut downgraded = Vec::new();

    for row in rows {
        let db_device_id: String = row.try_get("device_uuid").unwrap_or_default();
        let db_device_name: String = row.try_get("device_name").unwrap_or_default();
        let db_public_key: String = row.try_get("public_key_b64").unwrap_or_default();

        if let Some(online) = online_devices
            .iter()
            .find(|item| item.device_id == db_device_id)
        {
            if online.device_name != db_device_name || online.public_key != db_public_key {
                sqlx::query(
                    "UPDATE trusted_devices
                     SET trust_level = 'friend'
                     WHERE device_uuid = $1",
                )
                .bind(&db_device_id)
                .execute(&db.pool)
                .await
                .map_err(|e| format!("更新设备信任状态失败: {}", e))?;
                downgraded.push(db_device_id);
            }
        }
    }

    Ok(downgraded)
}

#[tauri::command]
pub async fn get_local_instances<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Vec<serde_json::Value>, String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let instances_dir = PathBuf::from(base_path).join("instances");
    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(instances_dir) {
        for entry in entries.filter_map(|item| item.ok()) {
            if entry.path().is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                list.push(serde_json::json!({ "id": name, "name": name }));
            }
        }
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_instance_saves<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<Vec<String>, String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let saves_dir = PathBuf::from(base_path)
        .join("instances")
        .join(instance_id)
        .join("saves");
    let mut list = Vec::new();

    if let Ok(entries) = fs::read_dir(saves_dir) {
        for entry in entries.filter_map(|item| item.ok()) {
            if entry.path().is_dir() {
                list.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }

    Ok(list)
}

#[tauri::command]
pub async fn get_transfer_history(
    db: State<'_, AppDatabase>,
    remote_device_id: Option<String>,
) -> Result<Vec<TransferRecord>, String> {
    fetch_transfer_history_records(&db, remote_device_id.as_deref()).await
}

#[tauri::command]
pub async fn push_to_device<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    state: State<'_, Arc<SharedLanState>>,
    target_ip: String,
    target_port: u16,
    transfer_type: String,
    target_id: String,
    save_name: Option<String>,
    remote_device_id: Option<String>,
    remote_device_name: Option<String>,
    remote_username: Option<String>,
) -> Result<String, String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let instances_dir = PathBuf::from(&base_path).join("instances");

    let (src_dir, item_name) = if transfer_type == "instance" {
        (instances_dir.join(&target_id), target_id.clone())
    } else {
        let selected_save = save_name.unwrap_or_default();
        (
            instances_dir
                .join(&target_id)
                .join("saves")
                .join(&selected_save),
            selected_save,
        )
    };

    if !src_dir.exists() {
        return Err("目标内容不存在，无法发送".to_string());
    }

    let transfer_id = uuid::Uuid::new_v4().to_string();
    let temp_root = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("temp_transfers");
    fs::create_dir_all(&temp_root).map_err(|e| format!("创建传输缓存目录失败: {}", e))?;
    let temp_zip = temp_root.join(format!("{}.zip", transfer_id));

    let current_info = state.current_device_info.lock().unwrap().clone();
    let config_dir = PathBuf::from(&base_path).join("config");
    let identity = TrustStore::get_or_create_identity(&config_dir);
    let remote_info = fetch_remote_device_info(&target_ip, target_port).await;

    let sender_device_id = if current_info.device_id.trim().is_empty() {
        identity.device_id.clone()
    } else {
        current_info.device_id.clone()
    };
    let sender_device_name = if current_info.device_name.trim().is_empty() {
        identity.device_name.clone()
    } else {
        current_info.device_name.clone()
    };
    let sender_username = current_info.username.clone();

    let resolved_remote_device_id = remote_device_id
        .or_else(|| remote_info.as_ref().map(|item| item.device_id.clone()))
        .unwrap_or_else(|| format!("{}:{}", target_ip, target_port));
    let resolved_remote_device_name = remote_device_name
        .or_else(|| remote_info.as_ref().map(|item| item.device_name.clone()))
        .unwrap_or_else(|| "局域网设备".to_string());
    let resolved_remote_username = remote_username
        .or_else(|| remote_info.as_ref().map(|item| item.username.clone()))
        .unwrap_or_default();

    let make_upsert = |status: &str,
                       size: i64,
                       error_message: Option<&str>,
                       mark_completed: bool| TransferRecordUpsert {
        transfer_id: &transfer_id,
        direction: "outgoing",
        sender_device_id: &sender_device_id,
        sender_device: &sender_device_name,
        receiver_device_id: &resolved_remote_device_id,
        receiver_device: &resolved_remote_device_name,
        remote_device_id: &resolved_remote_device_id,
        remote_device_name: &resolved_remote_device_name,
        remote_username: &resolved_remote_username,
        transfer_type: &transfer_type,
        name: &item_name,
        size,
        status: status.to_string(),
        error_message: error_message.map(str::to_string),
        mark_completed,
    };

    let emit_stage = |status: &str, stage: &str, current: u64, total: u64, message: String| {
        emit_transfer_progress(
            &app,
            &build_progress_event(
                &transfer_id,
                "outgoing",
                &resolved_remote_device_id,
                &resolved_remote_device_name,
                &resolved_remote_username,
                &transfer_type,
                &item_name,
                status,
                stage,
                current,
                total,
                message,
            ),
        );
    };

    upsert_transfer_record(&app, &db, make_upsert("packing", 0, None, false)).await?;
    emit_stage(
        "packing",
        "PACKING",
        0,
        0,
        "正在整理并打包传输内容".to_string(),
    );

    let result: Result<String, String> = async {
        if let Err(error) = transfer_service::zip_dir_with_progress(
            &src_dir,
            &temp_zip,
            |current, total, message| {
                emit_stage("packing", "PACKING", current, total, message);
            },
        ) {
            let message = format!("打包失败: {}", error);
            let _ =
                upsert_transfer_record(&app, &db, make_upsert("failed", 0, Some(&message), true))
                    .await;
            emit_stage("failed", "FAILED", 0, 0, message.clone());
            return Err(message);
        }

        let total_size = fs::metadata(&temp_zip)
            .map_err(|e| format!("读取临时压缩包信息失败: {}", e))?
            .len();

        upsert_transfer_record(
            &app,
            &db,
            make_upsert("sending", total_size as i64, None, false),
        )
        .await?;
        emit_stage(
            "sending",
            "SENDING",
            0,
            total_size,
            "正在发送压缩包到目标设备".to_string(),
        );

        let client = match reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(900))
            .build()
        {
            Ok(client) => client,
            Err(error) => {
                let message = format!("创建网络客户端失败: {}", error);
                let _ = upsert_transfer_record(
                    &app,
                    &db,
                    make_upsert("failed", total_size as i64, Some(&message), true),
                )
                .await;
                emit_stage("failed", "FAILED", 0, total_size, message.clone());
                return Err(message);
            }
        };

        let file = match tokio::fs::File::open(&temp_zip).await {
            Ok(file) => file,
            Err(error) => {
                let message = format!("读取临时压缩包失败: {}", error);
                let _ = upsert_transfer_record(
                    &app,
                    &db,
                    make_upsert("failed", total_size as i64, Some(&message), true),
                )
                .await;
                emit_stage("failed", "FAILED", 0, total_size, message.clone());
                return Err(message);
            }
        };

        let app_for_stream = app.clone();
        let transfer_id_for_stream = transfer_id.clone();
        let remote_device_id_for_stream = resolved_remote_device_id.clone();
        let remote_device_name_for_stream = resolved_remote_device_name.clone();
        let remote_username_for_stream = resolved_remote_username.clone();
        let transfer_type_for_stream = transfer_type.clone();
        let item_name_for_stream = item_name.clone();

        let body_stream = stream::try_unfold((file, 0_u64), move |(mut file, sent)| {
            let app = app_for_stream.clone();
            let transfer_id = transfer_id_for_stream.clone();
            let remote_device_id = remote_device_id_for_stream.clone();
            let remote_device_name = remote_device_name_for_stream.clone();
            let remote_username = remote_username_for_stream.clone();
            let transfer_type = transfer_type_for_stream.clone();
            let item_name = item_name_for_stream.clone();

            async move {
                let mut buffer = vec![0_u8; 128 * 1024];
                let read = file.read(&mut buffer).await?;
                if read == 0 {
                    return Ok::<_, std::io::Error>(None);
                }

                buffer.truncate(read);
                let current = sent + read as u64;
                emit_transfer_progress(
                    &app,
                    &build_progress_event(
                        &transfer_id,
                        "outgoing",
                        &remote_device_id,
                        &remote_device_name,
                        &remote_username,
                        &transfer_type,
                        &item_name,
                        "sending",
                        "SENDING",
                        current,
                        total_size,
                        "正在通过局域网传输压缩包".to_string(),
                    ),
                );

                Ok(Some((buffer, (file, current))))
            }
        });

        let response = match client
            .post(format!(
                "http://{}:{}/api/transfer/receive",
                target_ip, target_port
            ))
            .header("X-Transfer-Id", transfer_id.clone())
            .header("X-Transfer-Type", transfer_type.clone())
            .header(
                "X-Transfer-Name",
                urlencoding::encode(&item_name).into_owned(),
            )
            .header(
                "X-Device-Name",
                urlencoding::encode(&sender_device_name).into_owned(),
            )
            .header("X-Device-Id", sender_device_id.clone())
            .header(
                "X-Username",
                urlencoding::encode(&sender_username).into_owned(),
            )
            .header(reqwest::header::CONTENT_LENGTH, total_size.to_string())
            .body(reqwest::Body::wrap_stream(body_stream))
            .send()
            .await
        {
            Ok(response) => response,
            Err(error) => {
                let message = format!("发送失败: {}", error);
                let _ = upsert_transfer_record(
                    &app,
                    &db,
                    make_upsert("failed", total_size as i64, Some(&message), true),
                )
                .await;
                emit_stage("failed", "FAILED", 0, total_size, message.clone());
                return Err(message);
            }
        };

        if !response.status().is_success() {
            let status = if response.status() == reqwest::StatusCode::FORBIDDEN {
                "rejected"
            } else {
                "failed"
            };
            let message = format!("目标设备返回状态码 {}", response.status());
            let _ = upsert_transfer_record(
                &app,
                &db,
                make_upsert(status, total_size as i64, Some(&message), true),
            )
            .await;
            emit_stage(status, "FAILED", total_size, total_size, message.clone());
            return Err(message);
        }

        upsert_transfer_record(
            &app,
            &db,
            make_upsert("received", total_size as i64, None, true),
        )
        .await?;
        emit_stage(
            "received",
            "RECEIVED",
            total_size,
            total_size,
            "目标设备已接收传输内容".to_string(),
        );

        Ok(transfer_id.clone())
    }
    .await;

    let _ = fs::remove_file(&temp_zip);
    result
}

#[tauri::command]
pub async fn reject_received_transfer<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    transfer_id: String,
    temp_path: String,
    transfer_type: String,
    name: String,
    remote_device_id: String,
    remote_device_name: String,
    remote_username: String,
) -> Result<(), String> {
    let state = app.state::<Arc<SharedLanState>>();
    let current_info = state.current_device_info.lock().unwrap().clone();
    let size = fs::metadata(&temp_path)
        .map(|meta| meta.len() as i64)
        .unwrap_or(0);

    fs::remove_file(&temp_path).map_err(|e| format!("清理临时文件失败: {}", e))?;

    upsert_transfer_record(
        &app,
        &db,
        TransferRecordUpsert {
            transfer_id: &transfer_id,
            direction: "incoming",
            sender_device_id: &remote_device_id,
            sender_device: &remote_device_name,
            receiver_device_id: &current_info.device_id,
            receiver_device: &current_info.device_name,
            remote_device_id: &remote_device_id,
            remote_device_name: &remote_device_name,
            remote_username: &remote_username,
            transfer_type: &transfer_type,
            name: &name,
            size,
            status: "rejected".to_string(),
            error_message: None,
            mark_completed: true,
        },
    )
    .await?;

    emit_transfer_progress(
        &app,
        &build_progress_event(
            &transfer_id,
            "incoming",
            &remote_device_id,
            &remote_device_name,
            &remote_username,
            &transfer_type,
            &name,
            "rejected",
            "REJECTED",
            size as u64,
            size as u64,
            "已拒绝接收该传输内容".to_string(),
        ),
    );

    Ok(())
}

#[tauri::command]
pub async fn apply_received_transfer<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    transfer_id: String,
    temp_path: String,
    transfer_type: String,
    target_instance_id: Option<String>,
    remote_device_id: Option<String>,
    remote_device_name: Option<String>,
    remote_username: Option<String>,
    name: Option<String>,
) -> Result<String, String> {
    let shared_state = app.state::<Arc<SharedLanState>>();
    let current_info = shared_state.current_device_info.lock().unwrap().clone();
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap_or_default();
    let zip_file = PathBuf::from(&temp_path);
    let archive_size = fs::metadata(&zip_file)
        .map(|meta| meta.len() as i64)
        .unwrap_or(0);
    let remote_device_id = remote_device_id.unwrap_or_default();
    let remote_device_name = remote_device_name.unwrap_or_else(|| "局域网设备".to_string());
    let remote_username = remote_username.unwrap_or_default();
    let transfer_name = name.unwrap_or_else(|| "未命名传输".to_string());

    let make_upsert =
        |status: &str, error_message: Option<&str>, mark_completed: bool| TransferRecordUpsert {
            transfer_id: &transfer_id,
            direction: "incoming",
            sender_device_id: &remote_device_id,
            sender_device: &remote_device_name,
            receiver_device_id: &current_info.device_id,
            receiver_device: &current_info.device_name,
            remote_device_id: &remote_device_id,
            remote_device_name: &remote_device_name,
            remote_username: &remote_username,
            transfer_type: &transfer_type,
            name: &transfer_name,
            size: archive_size,
            status: status.to_string(),
            error_message: error_message.map(str::to_string),
            mark_completed,
        };

    let emit_stage = |status: &str, stage: &str, current: u64, total: u64, message: String| {
        emit_transfer_progress(
            &app,
            &build_progress_event(
                &transfer_id,
                "incoming",
                &remote_device_id,
                &remote_device_name,
                &remote_username,
                &transfer_type,
                &transfer_name,
                status,
                stage,
                current,
                total,
                message,
            ),
        );
    };

    upsert_transfer_record(&app, &db, make_upsert("applying", None, false)).await?;
    emit_stage(
        "applying",
        "APPLYING",
        0,
        100,
        "正在校验并解压接收到的内容".to_string(),
    );

    let temp_extract_dir = app
        .path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(format!("ext_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_extract_dir).map_err(|e| e.to_string())?;

    let result: Result<String, String> = (|| {
        transfer_service::unzip_file(&zip_file, &temp_extract_dir)?;
        emit_stage(
            "applying",
            "APPLYING",
            55,
            100,
            "压缩包解压完成，正在准备部署".to_string(),
        );

        let mut root_entry = None;
        for entry in fs::read_dir(&temp_extract_dir)
            .map_err(|e| e.to_string())?
            .filter_map(|item| item.ok())
        {
            if entry.path().is_dir() {
                root_entry = Some(entry);
                break;
            }
        }

        let root_entry = root_entry.ok_or_else(|| "ZIP 内未找到有效文件夹".to_string())?;
        let original_name = root_entry.file_name().to_string_lossy().to_string();
        let mut final_name = original_name.clone();

        let dest_base = if transfer_type == "save" {
            let instance_id = target_instance_id
                .clone()
                .ok_or_else(|| "接收存档时必须指定目标实例".to_string())?;
            PathBuf::from(&base_path)
                .join("instances")
                .join(instance_id)
                .join("saves")
        } else {
            PathBuf::from(&base_path).join("instances")
        };

        fs::create_dir_all(&dest_base).map_err(|e| format!("创建目标目录失败: {}", e))?;
        if dest_base.join(&final_name).exists() {
            final_name = format!(
                "{}_{}",
                original_name,
                chrono::Local::now().format("%Y%m%d_%H%M%S")
            );
        }

        emit_stage(
            "applying",
            "APPLYING",
            80,
            100,
            "正在写入到本地实例目录".to_string(),
        );
        fs::rename(root_entry.path(), dest_base.join(&final_name))
            .map_err(|e| format!("写入目标目录失败: {}", e))?;

        Ok(final_name)
    })();

    let _ = fs::remove_dir_all(&temp_extract_dir);
    let _ = fs::remove_file(&zip_file);

    match result {
        Ok(final_name) => {
            upsert_transfer_record(&app, &db, make_upsert("applied", None, true)).await?;
            emit_stage(
                "applied",
                "APPLIED",
                100,
                100,
                "传输内容已部署到本地".to_string(),
            );
            Ok(final_name)
        }
        Err(error) => {
            let _ =
                upsert_transfer_record(&app, &db, make_upsert("failed", Some(&error), true)).await;
            emit_stage("failed", "FAILED", 100, 100, error.clone());
            Err(error)
        }
    }
}
