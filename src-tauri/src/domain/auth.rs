// src-tauri/src/domain/auth.rs
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct DeviceCodeResponse {
    pub user_code: String,
    pub device_code: String,
    pub verification_uri: String,
    pub expires_in: u64,
    pub interval: u64,
    pub message: Option<String>, 
}

#[derive(Deserialize, Debug)]
pub struct MicrosoftTokenResponse {
    pub access_token: Option<String>,
    pub refresh_token: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>, 
}

// ✅ 引入全新的强类型账号类型枚举
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")] // 兼容前端的小驼峰命名
pub enum AccountType {
    Offline,
    Microsoft,
    Authlib,
}

// ✅ 替换原有的 MinecraftAccount，使用你设计的最优 Account 结构
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

#[derive(Deserialize, Debug)]
pub struct Skin {
    pub url: String,
}

#[derive(Deserialize, Debug)]
pub struct McProfile {
    pub id: String,
    pub name: String,
    pub skins: Vec<Skin>,
}