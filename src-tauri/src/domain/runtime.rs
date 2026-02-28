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