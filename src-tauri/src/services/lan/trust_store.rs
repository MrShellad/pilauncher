// src-tauri/src/services/lan/trust_store.rs
use crate::domain::lan::DeviceIdentity;
use sqlx::SqlitePool;
use std::fs;
use std::path::Path;

pub struct TrustStore;

impl TrustStore {
    // 获取本机身份
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

        DeviceIdentity {
            device_id,
            device_name,
            private_key_b64: String::new(), 
            public_key_b64: String::new(),
        }
    }

    // ✅ 改用异步的 SqlitePool 写入
    pub async fn add_trusted_device(
        pool: &SqlitePool,
        device_id: String,
        device_name: String,
        public_key_b64: String,
    ) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO trusted_devices (device_uuid, device_name, public_key_b64, trusted_at)
             VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
             ON CONFLICT(device_uuid) DO UPDATE SET
                device_name = excluded.device_name,
                public_key_b64 = excluded.public_key_b64,
                trusted_at = CURRENT_TIMESTAMP"
        )
        .bind(device_id)
        .bind(device_name)
        .bind(public_key_b64)
        .execute(pool)
        .await
        .map_err(|e| format!("写入数据库失败: {}", e))?;
        
        Ok(())
    }
}