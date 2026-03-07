// src-tauri/src/services/lan/trust_store.rs
use crate::domain::lan::{DeviceIdentity, TrustedDevice};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use rand::rngs::OsRng;
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

        // 生成全新的 ed25519 密钥对
        let mut csprng = OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
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

    /// 获取受信任设备列表 (供 Command 转换为 Vec 返回给前端 UI 使用)
    pub fn get_trusted_devices_list(config_dir: &Path) -> Vec<TrustedDevice> {
        Self::get_trusted_devices_map(config_dir).into_values().collect()
    }

    /// 新增信任设备并持久化到硬盘
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

    /// Axum 中间件专用的验证拦截器：防重放攻击 + ED25519 签名校验
    pub fn verify_request(
        config_dir: &Path,
        device_id: &str,
        uri: &str,
        timestamp: i64,
        signature_b64: &str,
    ) -> bool {
        // 1. 防止重放攻击 (前后时间差不超过 5 分钟)
        let now = chrono::Utc::now().timestamp();
        if (now - timestamp).abs() > 300 {
            return false;
        }

        // 2. 检查是否在信任名单
        let trusted = Self::get_trusted_devices_map(config_dir);
        let device = match trusted.get(device_id) {
            Some(d) => d,
            None => return false,
        };

        // 3. 校验 ED25519 签名
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

        // 签名算法: base64(ed25519( timestamp + "|" + uri ))
        let message = format!("{}|{}", timestamp, uri);
        verifying_key.verify(message.as_bytes(), &signature).is_ok()
    }
}