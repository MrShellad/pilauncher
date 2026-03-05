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

// ✅ 新增：用于接收前端传来的真实账号数据
#[derive(Debug, Clone, Deserialize)]
pub struct AccountPayload {
    pub uuid: String,
    pub name: String,
    pub access_token: String,
    pub r#type: String,
}