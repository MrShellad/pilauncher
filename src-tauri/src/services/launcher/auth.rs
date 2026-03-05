// src-tauri/src/services/launcher/auth.rs
use crate::domain::launcher::{AccountPayload, AuthSession};

pub struct AuthService;

impl AuthService {
    /// 将前端 Store 中的账号数据，转换为 Minecraft 标准启动认证会话
    pub fn build_session(account: AccountPayload) -> AuthSession {
        // Minecraft 启动参数要求 UUID 必须是没有中划线的 32 位字符串
        let formatted_uuid = account.uuid.replace("-", "");

        let user_type = if account.r#type == "microsoft" {
            "msa".to_string()
        } else {
            "Legacy".to_string()
        };

        AuthSession {
            player_name: account.name,
            uuid: formatted_uuid,
            access_token: account.access_token,
            user_type,
        }
    }
}