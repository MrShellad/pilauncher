// src-tauri/src/commands/lan_cmd.rs
use tauri::{AppHandle, State, Runtime, Manager};
use sqlx::Row; // 用于获取结果集的列

use crate::domain::lan::{DiscoveredDevice, DeviceInitInfo, TrustedDevice, TrustRequest};
use crate::services::config_service::ConfigService;
use crate::services::lan::trust_store::TrustStore;
use crate::services::lan::mdns_service::MdnsScanner;
use crate::services::lan::http_api::SharedLanState;
use crate::services::lan::transfer_service;
use crate::services::db_service::AppDatabase; 
use std::sync::Arc;
use std::fs;
use std::path::PathBuf;

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

fn is_safe_user_uuid(user_uuid: &str) -> bool {
    !user_uuid.is_empty()
        && user_uuid
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn is_valid_png(bytes: &[u8]) -> bool {
    bytes.len() > PNG_SIGNATURE.len() && bytes.starts_with(&PNG_SIGNATURE)
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
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap();
    let config_dir = std::path::PathBuf::from(&base_path).join("config");
    let my_identity = TrustStore::get_or_create_identity(&config_dir);

    let req_payload = TrustRequest {
        device_id: my_identity.device_id,
        device_name: my_identity.device_name,
        public_key: my_identity.public_key_b64, 
    };

    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(30)).build().unwrap();
    let url = format!("http://{}:{}/trust/request", target_ip, target_port);
    let res = client.post(&url).json(&req_payload).send().await.map_err(|_| "网络连接失败".to_string())?;

    if res.status().is_success() {
        if let Ok(target_identity) = res.json::<TrustRequest>().await {
            // ✅ 使用 async await 进行数据库插入
            TrustStore::add_trusted_device(
                &db.pool, 
                target_identity.device_id, 
                target_identity.device_name, 
                target_identity.public_key 
            ).await?;
            Ok(())
        } else {
            Err("对方数据格式异常".to_string())
        }
    } else {
        Err("对方拒绝了您的请求，或操作已超时。".to_string())
    }
}

#[tauri::command]
pub async fn resolve_trust_request<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<SharedLanState>>, 
    db: State<'_, AppDatabase>,
    device_id: String,
    accept: bool,
    device_name: String,
    public_key: String,
) -> Result<(), String> {
    let response_payload = if accept {
        let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap();
        let config_dir = std::path::PathBuf::from(base_path).join("config");
        
        // ✅ 异步等待插入
        TrustStore::add_trusted_device(&db.pool, device_id.clone(), device_name, public_key).await?;
        
        let my_identity = TrustStore::get_or_create_identity(&config_dir);
        Some(TrustRequest {
            device_id: my_identity.device_id,
            device_name: my_identity.device_name,
            public_key: my_identity.public_key_b64,
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
pub async fn update_lan_device_info(state: State<'_, Arc<SharedLanState>>, info: DeviceInitInfo, local_bg_path: String) -> Result<(), String> {
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

// ==========================================
// ✅ 核心重构：使用 sqlx 异步查询
// ==========================================
#[tauri::command]
pub async fn get_trusted_devices(db: State<'_, AppDatabase>) -> Result<Vec<TrustedDevice>, String> {
    let rows = sqlx::query(
        "SELECT device_uuid, device_name, public_key_b64, strftime('%s', trusted_at) AS ts 
         FROM trusted_devices 
         ORDER BY trusted_at DESC"
    )
    .fetch_all(&db.pool)
    .await
    .map_err(|e| format!("查询数据库失败: {}", e))?;

    let mut list = Vec::new();
    for row in rows {
        let ts_str: String = row.try_get("ts").unwrap_or_else(|_| "0".to_string());
        let trusted_at = ts_str.parse::<i64>().unwrap_or(0);

        list.push(TrustedDevice {
            device_id: row.try_get("device_uuid").map_err(|e| e.to_string())?,
            device_name: row.try_get("device_name").map_err(|e| e.to_string())?,
            public_key_b64: row.try_get("public_key_b64").map_err(|e| e.to_string())?,
            trusted_at,
        });
    }
    
    Ok(list)
}

#[tauri::command]
pub async fn get_local_instances<R: Runtime>(app: AppHandle<R>) -> Result<Vec<serde_json::Value>, String> {
    let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap_or_default();
    let inst_dir = std::path::PathBuf::from(base_path).join("instances");
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(inst_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.path().is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                list.push(serde_json::json!({ "id": name, "name": name }));
            }
        }
    }
    Ok(list)
}

#[tauri::command]
pub async fn get_instance_saves<R: Runtime>(app: AppHandle<R>, instance_id: String) -> Result<Vec<String>, String> {
    let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap_or_default();
    let saves_dir = std::path::PathBuf::from(base_path).join("instances").join(instance_id).join("saves");
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(saves_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.path().is_dir() {
                list.push(entry.file_name().to_string_lossy().to_string());
            }
        }
    }
    Ok(list)
}

#[tauri::command]
pub async fn push_to_device<R: Runtime>(
    app: AppHandle<R>, target_ip: String, target_port: u16, transfer_type: String, target_id: String, save_name: Option<String>
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap_or_default();
    let instances_dir = std::path::PathBuf::from(&base_path).join("instances");
    let (src_dir, item_name) = if transfer_type == "instance" {
        (instances_dir.join(&target_id), target_id.clone())
    } else {
        let s_name = save_name.unwrap_or_default();
        (instances_dir.join(&target_id).join("saves").join(&s_name), s_name)
    };
    if !src_dir.exists() { return Err("目标文件不存在".to_string()); }
    let temp_zip = app.path().app_data_dir().unwrap().join(format!("{}.zip", uuid::Uuid::new_v4()));
    transfer_service::zip_dir(&src_dir, &temp_zip)?;
    let config_dir = std::path::PathBuf::from(base_path).join("config");
    let identity = TrustStore::get_or_create_identity(&config_dir);
    let res = transfer_service::send_zip_to_device(&target_ip, target_port, &temp_zip, &transfer_type, &item_name, &identity.device_name).await;
    let _ = fs::remove_file(temp_zip); 
    res
}

#[tauri::command]
pub async fn apply_received_transfer<R: Runtime>(
    app: AppHandle<R>, temp_path: String, transfer_type: String, target_instance_id: Option<String>
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?.unwrap_or_default();
    let zip_file = std::path::PathBuf::from(&temp_path);
    let dest_dir = if transfer_type == "save" {
        let inst_id = target_instance_id.ok_or("必须指定目标实例")?;
        std::path::PathBuf::from(base_path).join("instances").join(inst_id).join("saves")
    } else {
        std::path::PathBuf::from(base_path).join("instances")
    };
    fs::create_dir_all(&dest_dir).ok();
    transfer_service::unzip_file(&zip_file, &dest_dir)?;
    let _ = fs::remove_file(zip_file); 
    Ok(())
}
