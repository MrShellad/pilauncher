// src-tauri/src/domain/modpack.rs
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct ModpackMetadata {
    pub name: String,
    pub version: String,
    pub loader: String,
    #[serde(rename = "loaderVersion")] // 兼容前端的驼峰命名
    pub loader_version: String,
    pub author: String,
    pub source: String,
}
