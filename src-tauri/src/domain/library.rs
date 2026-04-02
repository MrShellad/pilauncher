use serde::{Deserialize, Serialize};

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
