use crate::domain::instance::ServerBinding;
use crate::domain::mod_manifest::{ModFileHash, ModFileState, ModManifestSource};
use serde::{Deserialize, Serialize};

pub const PIPACK_FORMAT_VERSION: u32 = 1;
pub const PIPACK_MANIFEST_FILE: &str = "pi_manifest.json";
pub const PIPACK_OVERRIDES_DIR: &str = "overrides";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModpackMetadata {
    pub name: String,
    pub version: String,
    pub loader: String,
    #[serde(rename = "loaderVersion")]
    pub loader_version: String,
    pub author: String,
    pub source: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pack_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub packaged_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pack_uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PiPackManifest {
    pub format_version: u32,
    pub package: PiPackPackageInfo,
    pub minecraft: PiPackMinecraftInfo,
    #[serde(default)]
    pub overrides: String,
    #[serde(default)]
    pub mods: Vec<PiPackModEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub server: Option<ServerBinding>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PiPackPackageInfo {
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub uuid: String,
    pub packaged_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PiPackMinecraftInfo {
    pub version: String,
    pub loader: String,
    pub loader_version: String,
    pub instance_id: String,
    pub instance_name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PiPackModEntry {
    pub file_name: String,
    pub path: String,
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mod_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub source: ModManifestSource,
    pub hash: ModFileHash,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_state: Option<ModFileState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bundled_path: Option<String>,
}
