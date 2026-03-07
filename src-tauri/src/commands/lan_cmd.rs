// src-tauri/src/commands/lan_cmd.rs
use tauri::{AppHandle, State, Runtime};
use reqwest::Client;
use std::time::Duration;

use crate::domain::lan::{DiscoveredDevice, TrustedDevice, TrustRequest};
use crate::services::config_service::ConfigService;
use crate::services::lan::trust_store::TrustStore;
use crate::services::lan::mdns_service::MdnsScanner;
use crate::services::lan::http_api::SharedLanState;

#[tauri::command]
pub async fn scan_lan_devices() -> Result<Vec<DiscoveredDevice>, String> {
    MdnsScanner::scan_for_seconds(3).await
}

#[tauri::command]
pub async fn send_trust_request<R: Runtime>(
    app: AppHandle<R>,
    target_ip: String,
    target_port: u16,
) -> Result<(), String> {
    // ✅ 修复：优雅解包，如果没配置目录，返回错误给前端而不是崩溃
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置启动器基础数据目录，无法发起握手".to_string())?;
        
    let config_dir = std::path::PathBuf::from(base_path).join("config");
    let my_identity = TrustStore::get_or_create_identity(&config_dir);

    let url = format!("http://{}:{}/api/trust/request", target_ip, target_port);
    let client = Client::new();
    
    let payload = TrustRequest {
        device_id: my_identity.device_id,
        device_name: my_identity.device_name,
        public_key: my_identity.public_key_b64,
    };

    let res = client.post(&url)
        .timeout(Duration::from_secs(45))
        .json(&payload)
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    if res.status().is_success() {
        if let Ok(target_info) = res.json::<TrustRequest>().await {
            TrustStore::add_trusted_device(
                &config_dir, 
                target_info.device_id, 
                target_info.device_name, 
                target_info.public_key
            )?;
            return Ok(());
        }
        Err("对方返回的数据格式异常".into())
    } else {
        Err("对方拒绝了连接请求或响应超时".into())
    }
}

#[tauri::command]
pub async fn resolve_trust_request<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, SharedLanState>, 
    device_id: String,
    accept: bool,
    device_name: String,
    public_key: String,
) -> Result<(), String> {
    
    if accept {
        // ✅ 修复：优雅解包
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

#[tauri::command]
pub fn get_trusted_devices<R: Runtime>(app: AppHandle<R>) -> Result<Vec<TrustedDevice>, String> {
    // ✅ 修复：前端 useEffect 挂载时会疯狂调用此接口
    // 如果尚未配置基础目录，直接返回空列表 []，避免报错弹窗打扰用户
    match ConfigService::get_base_path(&app) {
        Ok(Some(base_path)) => {
            let config_dir = std::path::PathBuf::from(base_path).join("config");
            Ok(TrustStore::get_trusted_devices_list(&config_dir))
        },
        _ => Ok(vec![]),
    }
}