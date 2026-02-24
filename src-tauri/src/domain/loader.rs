// src-tauri/src/domain/loader.rs
use serde::{Deserialize, Serialize};

// --- Fabric 官方 API 返回结构 ---
#[derive(Debug, Deserialize)]
pub struct FabricLoaderMeta {
    pub loader: FabricLoaderInfo,
}

#[derive(Debug, Deserialize)]
pub struct FabricLoaderInfo {
    pub version: String,
}

// --- BMCLAPI (Forge & NeoForge) 返回结构 ---
#[derive(Debug, Deserialize)]
pub struct BmclApiLoaderVersion {
    pub version: String,
}