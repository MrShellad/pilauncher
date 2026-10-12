// src-tauri/src/commands/qrcode.rs
use crate::services::qrcode;

#[tauri::command]
pub fn generate_device_auth_qr(url: String) -> Result<String, String> {
    qrcode::generate_qr_data_uri(&url)
}
