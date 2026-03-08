// src-tauri/src/services/lan/trust_store.rs
use crate::domain::lan::{DeviceIdentity, TrustedDevice};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};

// ✅ 去掉了繁琐的 RngCore 和 OsRng 导入，只保留标准库
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub struct TrustStore;

impl TrustStore {
    /// 获取设备自己的身份 (没有则自动生成 ed25519 密钥对)
    pub fn get_or_create_identity(config_dir: &Path) -> DeviceIdentity {
        let id_file = config_dir.join("device_identity.json");
        if id_file.exists() {
            if let Ok(data) = fs::read_to_string(&id_file) {
                if let Ok(identity) = serde_json::from_str(&data) {
                    return identity;
                }
            }
        }

        // =====================================================================
        // ✅ 终极解法：极其优雅地生成 32 字节密码学随机数
        // =====================================================================
        // 1. 直接使用 rand 0.9 的 random() 生成 32 字节数组，底层使用高强度 ThreadRng
        let secret_bytes: [u8; 32] = rand::random();
        
        // 2. 将纯字节数组喂给 ed25519_dalek，彻底切断它与 rand_core 的 Trait 绑定
        let signing_key = SigningKey::from_bytes(&secret_bytes);
        let verifying_key = signing_key.verifying_key();

        let identity = DeviceIdentity {
            device_id: uuid::Uuid::new_v4().to_string(),
            device_name: format!("PC-{}", rand::random::<u16>()), 
            private_key_b64: BASE64.encode(signing_key.to_bytes()),
            public_key_b64: BASE64.encode(verifying_key.to_bytes()),
        };

        fs::write(id_file, serde_json::to_string_pretty(&identity).unwrap()).ok();
        identity
    }

    /// 获取受信任设备列表 (供内部校验快速寻址使用)
    pub fn get_trusted_devices_map(config_dir: &Path) -> HashMap<String, TrustedDevice> {
        let file = config_dir.join("devices").join("trusted_devices.json");
        if let Ok(data) = fs::read_to_string(file) {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            HashMap::new()
        }
    }

    // ... 下方的代码保持原样完全不动 ...
    
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
        if (now - timestamp).abs() > 300 {
            return false;
        }

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