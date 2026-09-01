use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MissingDependencyInfo {
    pub target_identifier: String,
    pub target_name_hint: Option<String>,
    pub version_requirement: Option<String>,
    pub relation_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencySummaryInfo {
    pub target_identifier: String,
    pub target_type: String,
    pub source_provider: String,
    pub target_name_hint: Option<String>,
    pub relation_type: String,
    pub is_installed_in_instance: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConflictPairInfo {
    pub mod_a_file_name: String,
    pub mod_b_file_name: String,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstanceDependencyHealth {
    pub missing_dependencies: HashMap<String, Vec<MissingDependencyInfo>>,
    pub instance_dependents: HashMap<String, Vec<String>>,
    pub declared_dependencies: HashMap<String, Vec<DependencySummaryInfo>>,
    pub conflicts: Vec<ConflictPairInfo>,
}
