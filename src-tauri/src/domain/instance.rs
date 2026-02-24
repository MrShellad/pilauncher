// src-tauri/src/domain/instance.rs
use serde::{Deserialize, Serialize};

// --- 前端请求模型 ---
#[derive(Debug, Deserialize)]
pub struct CreateInstancePayload {
    pub name: String,
    pub folder_name: String,
    pub game_version: String,
    pub loader_type: String,
    pub loader_version: Option<String>,
    pub save_path: String,
    pub cover_image: Option<String>,
}

// --- 本地 instance.json 存储模型 ---
#[derive(Debug, Serialize, Deserialize)]
pub struct InstanceConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "mcVersion")]
    pub mc_version: String,
    pub loader: LoaderConfig,
    pub java: JavaConfig,
    pub memory: MemoryConfig,
    pub resolution: ResolutionConfig,
    // 保留你原本需要的统计字段
    #[serde(rename = "playTime")]
    pub play_time: f64,
    #[serde(rename = "lastPlayed")]
    pub last_played: String,
    #[serde(rename = "createdAt")]
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoaderConfig {
    pub r#type: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JavaConfig {
    pub path: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryConfig {
    pub min: u32,
    pub max: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ResolutionConfig {
    pub width: u32,
    pub height: u32,
}

// --- 返回给前端的列表项模型 ---
#[derive(Debug, Serialize)]
pub struct InstanceItem {
    pub id: String,
    pub name: String,
    pub version: String,
    pub loader: String,
    pub play_time: f64,
    pub last_played: String,
    pub cover_path: Option<String>,
}