// src-tauri/src/domain/minecraft_json.rs
use serde::Deserialize;
use std::collections::HashMap;

#[derive(Debug, Deserialize)]
pub struct VersionManifestJson {
    // ✅ 修复核心：必须用 Option 包裹！因为 Fabric/Forge 的 JSON 根本没有这个字段
    #[serde(rename = "assetIndex")]
    pub asset_index: Option<AssetIndexMeta>, 
    
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
    // 💡 提示：未来如果要做跨平台兼容，可以在这里补充对 rules 的解析
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