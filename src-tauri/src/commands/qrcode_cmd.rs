// src-tauri/src/commands/qrcode_cmd.rs
use crate::services::qrcode_service;

#[tauri::command]
pub fn generate_device_auth_qr(url: String) -> Result<String, String> {
    qrcode_service::generate_qr_data_uri(&url)
}