// src-tauri/src/services/launcher/auth.rs
use crate::domain::launcher::AuthSession;
use uuid::Uuid;

pub struct AuthService;

impl AuthService {
    /// 完美复刻 Java UUID.nameUUIDFromBytes 的离线登录逻辑
    pub fn generate_offline(username: &str) -> AuthSession {
        // 1. 拼接 Minecraft 标准离线种子
        let offline_seed = format!("OfflinePlayer:{}", username);

        // 2. 直接进行纯 MD5 哈希 (不带任何 Namespace，完全对齐 Java 原版底层逻辑)
        let mut digest = md5::compute(offline_seed.as_bytes()).0;

        // 3. 按照 RFC 4122 规范强制覆写 Version 和 Variant
        digest[6] = (digest[6] & 0x0f) | 0x30; // 强制设置为 Version 3 (MD5)
        digest[8] = (digest[8] & 0x3f) | 0x80; // 强制设置为 Variant IETF

        // 4. 从字节数组生成合法的 UUID
        let uuid = Uuid::from_bytes(digest);

        AuthSession {
            player_name: username.to_string(),
            uuid: uuid.to_string().replace("-", ""), // Minecraft 启动参数强制要求去掉中划线
            access_token: "offline_dummy_token".to_string(),
            user_type: "Legacy".to_string(),
        }
    }
}
