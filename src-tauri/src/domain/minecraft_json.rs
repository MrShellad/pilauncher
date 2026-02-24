// src-tauri/src/domain/minecraft_json.rs
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct VersionManifestJson {
    #[serde(rename = "assetIndex")]
    pub asset_index: AssetIndexMeta,
    pub libraries: Vec<LibraryEntry>,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexMeta {
    pub id: String,
    pub url: String,
    pub sha1: String,
}

#[derive(Debug, Deserialize)]
pub struct LibraryEntry {
    pub name: String,
    pub downloads: Option<LibraryDownloads>,
    // 注意：这里省略了 rules 操作系统校验逻辑。
    // 在更完善的实现中，你需要根据 rules 剔除不属于当前系统 (如 macOS/Linux) 的 LWJGL 动态库。
}

#[derive(Debug, Deserialize)]
pub struct LibraryDownloads {
    pub artifact: Option<Artifact>,
}

#[derive(Debug, Deserialize)]
pub struct Artifact {
    pub path: String,
    pub url: String,
    pub sha1: String,
    pub size: u64,
}

#[derive(Debug, Deserialize)]
pub struct AssetIndexJson {
    pub objects: HashMap<String, AssetObject>,
}

#[derive(Debug, Deserialize)]
pub struct AssetObject {
    pub hash: String,
    pub size: u64,
}