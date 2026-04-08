use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;
use std::time::UNIX_EPOCH;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum ModSourceKind {
    ExternalImport,
    LauncherDownload,
    ModpackDeployment,
    #[default]
    Unknown,
}

impl ModSourceKind {
    pub fn from_input(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "externalimport" | "external_import" => Self::ExternalImport,
            "launcherdownload" | "launcher_download" | "manualdownload" | "manual_download" => {
                Self::LauncherDownload
            }
            "modpackdeployment" | "modpack_deployment" => Self::ModpackDeployment,
            _ => Self::Unknown,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModManifestSource {
    #[serde(default)]
    pub kind: ModSourceKind,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default, alias = "project_id")]
    pub project_id: Option<String>,
    #[serde(default, alias = "file_id")]
    pub file_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModFileHash {
    pub algorithm: String,
    pub value: String,
}

impl ModFileHash {
    pub fn sha1(value: String) -> Self {
        Self {
            algorithm: "sha1".to_string(),
            value,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModFileState {
    pub size: u64,
    pub modified_at: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ModManifestEntry {
    pub source: ModManifestSource,
    pub hash: ModFileHash,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_state: Option<ModFileState>,

    // New Metadata Cache Fields
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mod_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon_rel_path: Option<String>,
}

pub type ModManifest = HashMap<String, ModManifestEntry>;

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct RawModManifestEntry {
    #[serde(default)]
    pub source: Option<ModManifestSource>,
    #[serde(default)]
    pub hash: Option<ModFileHash>,
    #[serde(default)]
    pub file_state: Option<ModFileState>,
    #[serde(default)]
    pub platform: Option<String>,
    #[serde(default, alias = "project_id")]
    pub project_id: Option<String>,
    #[serde(default, alias = "file_id")]
    pub file_id: Option<String>,
}

pub type RawModManifest = HashMap<String, RawModManifestEntry>;

pub fn mod_manifest_key(file_name: &str) -> String {
    file_name.trim_end_matches(".disabled").to_string()
}

pub fn build_file_state(path: &Path) -> Result<ModFileState, String> {
    let metadata = fs::metadata(path).map_err(|e| e.to_string())?;
    let modified_at = metadata
        .modified()
        .map_err(|e| e.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    Ok(ModFileState {
        size: metadata.len(),
        modified_at,
    })
}

pub fn compute_sha1(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha1::new();
    let mut buffer = [0u8; 8192];

    loop {
        let bytes = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes == 0 {
            break;
        }
        hasher.update(&buffer[..bytes]);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

pub fn compute_file_hash(path: &Path) -> Result<ModFileHash, String> {
    Ok(ModFileHash::sha1(compute_sha1(path)?))
}

pub fn build_manifest_source(
    kind: ModSourceKind,
    platform: Option<String>,
    project_id: Option<String>,
    file_id: Option<String>,
) -> ModManifestSource {
    ModManifestSource {
        kind,
        platform,
        project_id,
        file_id,
    }
}

pub fn build_manifest_entry(
    source: ModManifestSource,
    hash: ModFileHash,
    file_state: ModFileState,
) -> ModManifestEntry {
    ModManifestEntry {
        source,
        hash,
        file_state: Some(file_state),
        mod_id: None,
        name: None,
        version: None,
        description: None,
        icon_rel_path: None,
    }
}

pub fn read_raw_mod_manifest(path: &Path) -> RawModManifest {
    if !path.exists() {
        return HashMap::new();
    }

    let content = fs::read_to_string(path).unwrap_or_default();
    if content.trim().is_empty() {
        return HashMap::new();
    }

    serde_json::from_str(&content).unwrap_or_default()
}

pub fn write_mod_manifest(path: &Path, manifest: &ModManifest) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let content = serde_json::to_string_pretty(manifest).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

pub fn upsert_mod_manifest_entry(
    manifest_path: &Path,
    file_name: &str,
    entry: &ModManifestEntry,
) -> Result<(), String> {
    let mut manifest = if manifest_path.exists() {
        let content = fs::read_to_string(manifest_path).unwrap_or_default();
        serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
            .unwrap_or_default()
    } else {
        serde_json::Map::new()
    };

    manifest.insert(
        mod_manifest_key(file_name),
        serde_json::to_value(entry).map_err(|e| e.to_string())?,
    );

    if let Some(parent) = manifest_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::write(
        manifest_path,
        serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

pub fn normalize_manifest_entry(
    raw: Option<RawModManifestEntry>,
    path: &Path,
    file_state: ModFileState,
    fallback_kind: ModSourceKind,
) -> Result<ModManifestEntry, String> {
    let source = match raw.as_ref().and_then(|entry| entry.source.clone()) {
        Some(source) => source,
        None => {
            let legacy_platform = raw.as_ref().and_then(|entry| entry.platform.clone());
            let legacy_project_id = raw.as_ref().and_then(|entry| entry.project_id.clone());
            let legacy_file_id = raw.as_ref().and_then(|entry| entry.file_id.clone());

            let inferred_kind = if legacy_platform.is_some()
                || legacy_project_id.is_some()
                || legacy_file_id.is_some()
            {
                ModSourceKind::Unknown
            } else {
                fallback_kind.clone()
            };

            build_manifest_source(
                inferred_kind,
                legacy_platform,
                legacy_project_id,
                legacy_file_id,
            )
        }
    };

    let hash = match raw {
        Some(entry) if entry.hash.is_some() && entry.file_state.as_ref() == Some(&file_state) => {
            entry.hash.unwrap()
        }
        _ => compute_file_hash(path)?,
    };

    Ok(build_manifest_entry(source, hash, file_state))
}
