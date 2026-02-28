use serde::{Deserialize, Serialize};

#[derive(Serialize)]
pub struct MemoryStats {
    pub total: u64,
    pub available: u64,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct JavaInstall {
    pub version: String,
    pub path: String,
}

#[derive(Serialize)]
pub struct ValidationResult {
    pub valid: Vec<JavaInstall>,
    pub missing: Vec<JavaInstall>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeConfig {
    pub use_global_java: bool,
    pub use_global_memory: bool,
    pub java_path: String,
    pub max_memory: u64,
    pub min_memory: u64,
    pub jvm_args: String,
}