use crate::domain::lan::DeviceIdentity;
use sqlx::SqlitePool;
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
        let mut user_uuid = String::new();

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

                if let Some(active_account) = json
                    .pointer("/state/settings/activeAccountId")
                    .and_then(|v| v.as_str())
                {
                    user_uuid = active_account.to_string();
                }
            }
        }

        let identity_file = config_dir.join("lan_identity.json");
        let mut private_key_b64 = String::new();
        let mut public_key_b64 = String::new();

        if let Ok(data) = fs::read_to_string(&identity_file) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&data) {
                if let Some(priv_b64) = json.get("private_key_b64").and_then(|v| v.as_str()) {
                    private_key_b64 = priv_b64.to_string();
                }
                if let Some(pub_b64) = json.get("public_key_b64").and_then(|v| v.as_str()) {
                    public_key_b64 = pub_b64.to_string();
                }
            }
        }

        if private_key_b64.is_empty() || public_key_b64.is_empty() {
            use base64::{engine::general_purpose, Engine as _};
            use ed25519_dalek::SigningKey;
            use rand_core::OsRng;

            let mut csprng = OsRng;
            let signing_key = SigningKey::generate(&mut csprng);
            let private_bytes = signing_key.to_bytes();
            let public_bytes = signing_key.verifying_key().to_bytes();

            private_key_b64 = general_purpose::STANDARD.encode(private_bytes);
            public_key_b64 = general_purpose::STANDARD.encode(public_bytes);

            let identity_json = serde_json::json!({
                "private_key_b64": private_key_b64,
                "public_key_b64": public_key_b64
            });

            if let Some(parent) = identity_file.parent() {
                let _ = fs::create_dir_all(parent);
            }
            let _ = fs::write(
                &identity_file,
                serde_json::to_string_pretty(&identity_json).unwrap_or_default(),
            );
        }

        DeviceIdentity {
            device_id,
            device_name,
            user_uuid,
            private_key_b64,
            public_key_b64,
        }
    }

    pub async fn upsert_device_relationship(
        pool: &SqlitePool,
        device_id: String,
        device_name: String,
        user_uuid: String,
        username: String,
        public_key_b64: String,
        trust_level: &str,
    ) -> Result<(), String> {
        sqlx::query(
            "INSERT INTO trusted_devices (
                device_uuid,
                device_name,
                user_uuid,
                username,
                public_key_b64,
                trust_level,
                trusted_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
             ON CONFLICT(device_uuid) DO UPDATE SET
                device_name = excluded.device_name,
                user_uuid = excluded.user_uuid,
                username = excluded.username,
                public_key_b64 = excluded.public_key_b64,
                trust_level = excluded.trust_level,
                trusted_at = CURRENT_TIMESTAMP",
        )
        .bind(device_id)
        .bind(device_name)
        .bind(user_uuid)
        .bind(username)
        .bind(public_key_b64)
        .bind(trust_level)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to persist device relationship: {}", e))?;

        Ok(())
    }

    pub async fn add_trusted_device(
        pool: &SqlitePool,
        device_id: String,
        device_name: String,
        user_uuid: String,
        username: String,
        public_key_b64: String,
    ) -> Result<(), String> {
        Self::upsert_device_relationship(
            pool,
            device_id,
            device_name,
            user_uuid,
            username,
            public_key_b64,
            "trusted",
        )
        .await
    }

    pub async fn add_friend_device(
        pool: &SqlitePool,
        device_id: String,
        device_name: String,
        user_uuid: String,
        username: String,
        public_key_b64: String,
    ) -> Result<(), String> {
        Self::upsert_device_relationship(
            pool,
            device_id,
            device_name,
            user_uuid,
            username,
            public_key_b64,
            "friend",
        )
        .await
    }
}
