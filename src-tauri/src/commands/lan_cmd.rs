// src-tauri/src/commands/lan_cmd.rs
use tauri::{AppHandle, State, Runtime};

// ✅ 补齐所需导入
use crate::domain::lan::{DiscoveredDevice, DeviceInitInfo};
use crate::services::config_service::ConfigService;
use crate::services::lan::trust_store::TrustStore;
use crate::services::lan::mdns_service::MdnsScanner;
use crate::services::lan::http_api::SharedLanState;
use std::sync::Arc;

#[tauri::command]
pub async fn scan_lan_devices() -> Result<Vec<DiscoveredDevice>, String> {
    MdnsScanner::scan_for_seconds(3).await
}

#[tauri::command]
pub async fn send_trust_request<R: Runtime>(
    app: AppHandle<R>,
    _target_ip: String,
    _target_port: u16,
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置启动器基础数据目录，无法发起握手".to_string())?;
        
    let config_dir = std::path::PathBuf::from(base_path).join("config");
    let _my_identity = TrustStore::get_or_create_identity(&config_dir);

    // TODO: 实现实际的 HTTP 握手逻辑...
    Ok(())
}

#[tauri::command]
pub async fn resolve_trust_request<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, Arc<SharedLanState>>, 
    device_id: String,
    accept: bool,
    device_name: String,
    public_key: String,
) -> Result<(), String> {
    
    if accept {
        let base_path = ConfigService::get_base_path(&app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
            
        let config_dir = std::path::PathBuf::from(base_path).join("config");
        TrustStore::add_trusted_device(&config_dir, device_id.clone(), device_name, public_key)?;
    }

    if let Some(tx) = state.pending_trusts.lock().unwrap().remove(&device_id) {
        let _ = tx.send(accept); 
    }

    Ok(())
}

// ==========================================
// ✅ 新增：供前端主动推送名片信息与壁纸路径的接口
// ==========================================
#[tauri::command]
pub async fn update_lan_device_info(
    state: State<'_, Arc<SharedLanState>>,
    info: DeviceInitInfo,
    local_bg_path: String,
) -> Result<(), String> {
    // 1. 更新后端的内存缓存
    *state.current_device_info.lock().unwrap() = info.clone();
    *state.local_bg_path.lock().unwrap() = local_bg_path;

    // 2. 将最新的名片序列化后，推给所有建立了 WebSocket 连接的局域网访客
    if let Ok(json_str) = serde_json::to_string(&info) {
        // 如果没人连，send 会返回错误，忽略即可
        let _ = state.ws_sender.send(json_str);
    }

    println!("[PiLauncher] 🔄 局域网名片已更新，并通过 WebSocket 推送完毕。");
    Ok(())
}