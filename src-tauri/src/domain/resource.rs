use serde::{Deserialize, Serialize};

// ==========================================
// 我们自己的内部标准模型 (脱离第三方绑定)
// ==========================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OreProjectDetail {
    pub id: String,
    pub title: String,
    pub author: String,
    pub description: String,
    pub icon_url: Option<String>,
    pub client_side: String,
    pub server_side: String,
    pub downloads: i32,
    pub followers: i32,
    pub updated_at: String,
    pub loaders: Vec<String>,
    pub game_versions: Vec<String>,
    pub gallery_urls: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct OreProjectVersion {
    pub id: String,
    pub name: String,
    pub version_number: String,
    pub date_published: String,
    pub loaders: Vec<String>,
    pub game_versions: Vec<String>,
    pub file_name: String,
    pub download_url: String,
}
