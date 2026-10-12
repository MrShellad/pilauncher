use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceModDbRow {
    pub instance_id: String,
    pub file_name: String,
    pub is_enabled: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
    pub mod_id: Option<String>,
    pub version: Option<String>,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModPlatformMatchBatchItem {
    pub file_name: String,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnrichedInstanceModRow {
    pub instance_id: String,
    pub file_name: String,
    pub is_enabled: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
    pub mod_id: Option<String>,
    pub version: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_rel_path: Option<String>,
    pub icon_source: Option<String>,
    pub aliases: Option<String>,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
    pub dependents_count: i64,
    pub dependencies: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ModRelationRecord {
    pub source_identifier: String,
    pub source_type: String,
    pub target_identifier: String,
    pub target_type: String,
    pub relation_type: String,
    pub version_requirement: Option<String>,
    pub target_name_hint: Option<String>,
    pub source_provider: String,
}

#[derive(Debug, FromRow)]
pub(crate) struct RawInstanceModQueryResult {
    pub file_name: String,
    pub is_enabled: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<i64>,
    pub mod_id: Option<String>,
    pub version: Option<String>,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_rel_path: Option<String>,
    pub icon_source: Option<String>,
    pub aliases: Option<String>,
}
