use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StarredItem {
    pub id: String,
    pub r#type: String, // "mod" | "modpack" | "server"
    pub source: String, // "modrinth" | "curseforge" | "custom"
    pub project_id: Option<String>,
    pub title: Option<String>,
    pub author: Option<String>,
    pub snapshot: String, // JSON payload representing immutable core data
    pub state: String,    // JSON payload representing volatile status like version, hasUpdate
    pub meta: String,     // JSON payload representing user specific tags, notes
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub r#type: String, // "group" | "modpack" | "favorite"
    pub cover_image: Option<String>,
    pub sort_order: i32,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CollectionItem {
    pub id: String,
    pub collection_id: String,
    pub item_id: String,
    pub position: i32,
    pub extra: Option<String>, // JSON specific to integration logic
    pub created_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModSetTracker {
    pub id: String,
    pub collection_id: String,
    pub collection_name: String,
    pub game_version: String,
    pub loader: String,
    pub readiness_status: String,
    pub ready_count: i32,
    pub total_count: i32,
    pub projects: Value,
    pub items: Value,
    pub last_checked_at: Option<i64>,
    pub notified_ready_at: Option<i64>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryExportFile {
    pub schema_version: i32,
    pub exported_at: i64,
    pub starred_items: Vec<StarredItem>,
    pub collections: Vec<Collection>,
    pub collection_items: Vec<CollectionItem>,
    pub mod_set_trackers: Vec<ModSetTracker>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryImportOptions {
    #[serde(default = "default_merge_same_name_tags")]
    pub merge_same_name_tags: bool,
}

fn default_merge_same_name_tags() -> bool {
    true
}

impl Default for LibraryImportOptions {
    fn default() -> Self {
        Self {
            merge_same_name_tags: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryImportPreview {
    pub schema_version: i32,
    pub starred_items: usize,
    pub new_starred_items: usize,
    pub duplicate_starred_items: usize,
    pub collections: usize,
    pub new_collections: usize,
    pub merged_tag_collections: usize,
    pub collection_items: usize,
    pub new_collection_items: usize,
    pub duplicate_collection_items: usize,
    pub mod_set_trackers: usize,
    pub importable_mod_set_trackers: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryImportResult {
    pub imported_starred_items: usize,
    pub skipped_starred_items: usize,
    pub imported_collections: usize,
    pub merged_tag_collections: usize,
    pub imported_collection_items: usize,
    pub skipped_collection_items: usize,
    pub imported_mod_set_trackers: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteTombstone {
    pub item_id: String,
    pub deleted_at: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteOperation {
    pub op_id: String,
    pub target_id: String,
    pub action: FavoriteOperationAction,
    pub timestamp: i64,
    pub device_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub item: Option<StarredItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum FavoriteOperationAction {
    Add,
    Remove,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FavoriteSnapshot {
    pub version: i32,
    pub favorites: Vec<StarredItem>,
    #[serde(default)]
    pub states: Vec<FavoriteOperation>,
    pub last_timestamp: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebDavSyncConfig {
    pub base_url: String,
    pub username: String,
    pub password: String,
    pub device_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebDavFavoriteSyncResult {
    pub remote_root: String,
    pub remote_created: bool,
    pub uploaded_operations: usize,
    pub downloaded_operations: usize,
    pub merged_favorites: usize,
    pub total_operations: usize,
    pub snapshot_updated: bool,
    pub compacted_operations: usize,
}
