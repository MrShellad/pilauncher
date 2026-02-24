// src-tauri/src/domain/minecraft.rs
use serde::{Deserialize, Serialize};

/// 官方 API 返回的原始数据结构
#[derive(Debug, Deserialize)]
pub struct RemoteVersionManifest {
    pub versions: Vec<RemoteVersion>,
}

#[derive(Debug, Deserialize)]
pub struct RemoteVersion {
    pub id: String,
    pub r#type: String, // release, snapshot, old_alpha, old_beta
    pub url: String,
    pub r#time: String,
    #[serde(rename = "releaseTime")]
    pub release_time: String,
}

/// 返回给前端的数据结构 (对应 VersionGroup)
#[derive(Debug, Serialize, Clone)] // McVersion 已经有 Clone 了
pub struct McVersion {
    pub id: String,
    pub r#type: String,
    pub release_time: String,
    pub wiki_url: String,
}

#[derive(Debug, Serialize, Clone)] 
pub struct VersionGroup {
    pub group_name: String,
    pub versions: Vec<McVersion>,
}