use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModFileNameCleanupItem {
    pub original_file_name: String,
    pub suggested_file_name: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModFileNameCleanupFailure {
    pub original_file_name: String,
    pub suggested_file_name: String,
    pub error: String,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModFileNameCleanupResult {
    pub total: usize,
    pub renamed: Vec<ModFileNameCleanupItem>,
    pub failed: Vec<ModFileNameCleanupFailure>,
    pub manifest_sync_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModFileNameCleanupProgress {
    pub instance_id: String,
    pub current: usize,
    pub total: usize,
    pub file_name: String,
    pub target_file_name: String,
    pub stage: String,
    pub message: String,
}
