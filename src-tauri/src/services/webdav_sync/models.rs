use crate::domain::library::{FavoriteTombstone, StarredItem};
use serde::{Deserialize, Serialize};

use super::constants::SYNC_META_VERSION;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DeviceFile {
    pub(crate) device_id: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LegacyFavoriteSyncDocument {
    #[allow(dead_code)]
    pub(crate) schema_version: i32,
    #[allow(dead_code)]
    pub(crate) updated_at: i64,
    pub(crate) starred_items: Vec<StarredItem>,
    pub(crate) tombstones: Vec<FavoriteTombstone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SyncMeta {
    pub(crate) version: i32,
    pub(crate) favorites: FavoriteSyncMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FavoriteSyncMeta {
    pub(crate) last_sync_at: i64,
    pub(crate) last_snapshot_at: i64,
    pub(crate) last_snapshot_timestamp: i64,
}

impl Default for SyncMeta {
    fn default() -> Self {
        Self {
            version: SYNC_META_VERSION,
            favorites: FavoriteSyncMeta::default(),
        }
    }
}
