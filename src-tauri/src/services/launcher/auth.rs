// src-tauri/src/services/launcher/auth.rs
use crate::domain::launcher::{Account, AccountType, AuthSession};
use std::fs;
use std::path::Path;

pub struct AuthService;

impl AuthService {
    // 接收新版 Account 模型，并传入 runtime_dir 用于落盘保存
    pub fn build_session(account: Account, runtime_dir: &Path) -> AuthSession {
        // 1. 将用户的 json 文件放到 runtime/accounts 下，方便后续调用跟验证
        let account_dir = runtime_dir.join("accounts");
        if !account_dir.exists() {
            let _ = fs::create_dir_all(&account_dir);
        }
        let account_file = account_dir.join(format!("{}.json", account.uuid));
        let _ = fs::write(
            &account_file,
            serde_json::to_string_pretty(&account).unwrap_or_default(),
        );

        // ✅ 直接使用前端传来的、已经构建好的现成 UUID，剥离中划线以符合启动参数要求
        let formatted_uuid = account.uuid.replace("-", "");

        // 2. 根据账号类型分别构建 Launch Session
        match account.account_type {
            AccountType::Microsoft => AuthSession {
                player_name: account.username,
                uuid: formatted_uuid,
                access_token: account.access_token,
                user_type: "msa".to_string(),
            },
            AccountType::Authlib => AuthSession {
                player_name: account.username,
                uuid: formatted_uuid,
                access_token: account.access_token,
                user_type: "mojang".to_string(),
            },
            AccountType::Offline => {
                AuthSession {
                    // ✅ 拒绝重复计算：直接读取 account 中已有的离线用户信息
                    player_name: account.username,
                    uuid: formatted_uuid.clone(),
                    access_token: formatted_uuid, // 离线模式直接使用 UUID 作为 Dummy Token
                    user_type: "legacy".to_string(), // 必须纯小写
                }
            }
        }
    }
}
