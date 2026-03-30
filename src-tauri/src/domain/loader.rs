// src-tauri/src/domain/loader.rs
use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct FabricLoaderMeta {
    pub loader: FabricLoaderInfo,
}

#[derive(Debug, Deserialize)]
pub struct FabricLoaderInfo {
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct QuiltLoaderMeta {
    pub loader: QuiltLoaderInfo,
}

#[derive(Debug, Deserialize)]
pub struct QuiltLoaderInfo {
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct BmclApiLoaderVersion {
    pub version: String,
}
