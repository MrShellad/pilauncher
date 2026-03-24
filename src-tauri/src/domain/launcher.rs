// src-tauri/src/domain/launcher.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedLaunchConfig {
    pub java_path: String,
    pub min_memory: u32,
    pub max_memory: u32,
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub fullscreen: bool,
    pub custom_jvm_args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub player_name: String,
    pub uuid: String,
    pub access_token: String,
    pub user_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LoaderType {
    Vanilla,
    Fabric,
    Forge,
    NeoForge,
}

// ✅ 引入全新的强类型账号类型枚举
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")] // 兼容前端的小驼峰命名 (accountType)
pub enum AccountType {
    Offline,
    Microsoft,
    Authlib,
}

// ✅ 替换原有的 AccountPayload，使用你设计的最优 Account 结构
#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Account {
    pub id: String,
    pub account_type: AccountType,
    pub username: String,
    pub uuid: String,
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: Option<i64>,
    pub skin_url: Option<String>,
}
