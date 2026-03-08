// src-tauri/src/services/lan/trust_store.rs
use crate::domain::lan::{DeviceIdentity, TrustedDevice};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};

use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub struct TrustStore;

impl TrustStore {
    pub fn get_or_create_identity(config_dir: &Path) -> DeviceIdentity {
        let mut settings_file = config_dir.join("settings.json");
        if !settings_file.exists() {
            if let Some(parent) = config_dir.parent() {
                settings_file = parent.join("settings.json");
            }
        }

        let mut device_id = String::new();
        let mut device_name = String::new();

        if let Ok(data) = fs::read_to_string(&settings_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
                // ✅ 核心修复：Zustand Persist 默认会将数据包裹在 "state.settings.general" 下
                if let Some(general) = json.pointer("/state/settings/general") {
                    if let Some(id) = general.get("deviceId").and_then(|v| v.as_str()) {
                        device_id = id.to_string();
                    }
                    if let Some(name) = general.get("deviceName").and_then(|v| v.as_str()) {
                        device_name = name.to_string();
                    }
                }
            }
        }

        // 兜底逻辑
        if device_id.is_empty() {
            device_id = uuid::Uuid::new_v4().to_string();
        }
        if device_name.is_empty() {
            device_name = format!("Pi-Device-{:03}", rand::random::<u16>() % 1000);
        }

        let id_file = config_dir.join("device_identity.json");
        
        if id_file.exists() {
            if let Ok(data) = fs::read_to_string(&id_file) {
                if let Ok(mut identity) = serde_json::from_str::<DeviceIdentity>(&data) {
                    // 同步最新设置
                    let needs_update = identity.device_id != device_id || identity.device_name != device_name;
                    identity.device_id = device_id;
                    identity.device_name = device_name;
                    
                    if needs_update {
                        let _ = fs::write(&id_file, serde_json::to_string_pretty(&identity).unwrap());
                    }
                    return identity;
                }
            }
        }

        // 首次生成密钥对
        let secret_bytes: [u8; 32] = rand::random();
        let signing_key = SigningKey::from_bytes(&secret_bytes);
        let verifying_key = signing_key.verifying_key();

        let identity = DeviceIdentity {
            device_id,
            device_name,
            private_key_b64: BASE64.encode(signing_key.to_bytes()),
            public_key_b64: BASE64.encode(verifying_key.to_bytes()),
        };

        let _ = fs::write(&id_file, serde_json::to_string_pretty(&identity).unwrap());
        identity
    }

    pub fn get_trusted_devices_map(config_dir: &Path) -> HashMap<String, TrustedDevice> {
        let file = config_dir.join("devices").join("trusted_devices.json");
        if let Ok(data) = fs::read_to_string(file) {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            HashMap::new()
        }
    }

    pub fn get_trusted_devices_list(config_dir: &Path) -> Vec<TrustedDevice> {
        Self::get_trusted_devices_map(config_dir).into_values().collect()
    }

    pub fn add_trusted_device(
        config_dir: &Path,
        id: String,
        name: String,
        pub_key: String,
    ) -> Result<(), String> {
        let devices_dir = config_dir.join("devices");
        fs::create_dir_all(&devices_dir).map_err(|e| e.to_string())?;

        let mut trusts = Self::get_trusted_devices_map(config_dir);
        trusts.insert(
            id.clone(),
            TrustedDevice {
                device_id: id,
                device_name: name,
                public_key_b64: pub_key,
                trusted_at: chrono::Utc::now().timestamp(),
            },
        );

        let file = devices_dir.join("trusted_devices.json");
        fs::write(file, serde_json::to_string_pretty(&trusts).unwrap())
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn verify_request(
        config_dir: &Path,
        device_id: &str,
        uri: &str,
        timestamp: i64,
        signature_b64: &str,
    ) -> bool {
        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > 300 { return false; }

        let trusted = Self::get_trusted_devices_map(config_dir);
        let device = match trusted.get(device_id) {
            Some(d) => d,
            None => return false,
        };

        let pub_key_bytes = match BASE64.decode(&device.public_key_b64) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let verifying_key = match VerifyingKey::try_from(pub_key_bytes.as_slice()) {
            Ok(k) => k,
            Err(_) => return false,
        };

        let sig_bytes = match BASE64.decode(signature_b64) {
            Ok(b) => b,
            Err(_) => return false,
        };
        let signature = match Signature::from_slice(&sig_bytes) {
            Ok(s) => s,
            Err(_) => return false,
        };

        let message = format!("{}|{}", timestamp, uri);
        verifying_key.verify(message.as_bytes(), &signature).is_ok()
    }
}