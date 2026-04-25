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
    #[serde(default)]
    pub mod_id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub icon_rel_path: Option<String>,
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

    let key = mod_manifest_key(file_name);
    let mut merged_entry = entry.clone();
    if let Some(existing_value) = manifest.get(&key) {
        merge_cached_metadata_from_value(&mut merged_entry, existing_value);
    }

    manifest.insert(
        key,
        serde_json::to_value(merged_entry).map_err(|e| e.to_string())?,
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

    let hash = match raw.as_ref() {
        Some(entry) if entry.hash.is_some() && entry.file_state.as_ref() == Some(&file_state) => {
            entry.hash.clone().unwrap()
        }
        _ => compute_file_hash(path)?,
    };

    let mut entry = build_manifest_entry(source, hash, file_state);
    copy_cached_metadata_from_raw(raw.as_ref(), &mut entry);
    Ok(entry)
}

fn copy_cached_metadata_from_raw(raw: Option<&RawModManifestEntry>, entry: &mut ModManifestEntry) {
    let Some(raw) = raw else {
        return;
    };

    entry.mod_id = raw.mod_id.clone();
    entry.name = raw.name.clone();
    entry.version = raw.version.clone();
    entry.description = raw.description.clone();
    entry.icon_rel_path = raw.icon_rel_path.clone();
}

fn merge_cached_metadata(target: &mut ModManifestEntry, source: &ModManifestEntry) {
    if target.mod_id.is_none() {
        target.mod_id = source.mod_id.clone();
    }
    if target.name.is_none() {
        target.name = source.name.clone();
    }
    if target.version.is_none() {
        target.version = source.version.clone();
    }
    if target.description.is_none() {
        target.description = source.description.clone();
    }
    if target.icon_rel_path.is_none() {
        target.icon_rel_path = source.icon_rel_path.clone();
    }
}

fn merge_cached_metadata_from_value(target: &mut ModManifestEntry, value: &serde_json::Value) {
    if let Ok(existing) = serde_json::from_value::<ModManifestEntry>(value.clone()) {
        merge_cached_metadata(target, &existing);
        return;
    }

    if let Ok(raw) = serde_json::from_value::<RawModManifestEntry>(value.clone()) {
        let mut existing = build_manifest_entry(
            raw.source.clone().unwrap_or_else(|| {
                build_manifest_source(
                    ModSourceKind::Unknown,
                    raw.platform.clone(),
                    raw.project_id.clone(),
                    raw.file_id.clone(),
                )
            }),
            raw.hash
                .clone()
                .unwrap_or_else(|| ModFileHash::sha1("".to_string())),
            raw.file_state.clone().unwrap_or_default(),
        );
        copy_cached_metadata_from_raw(Some(&raw), &mut existing);
        merge_cached_metadata(target, &existing);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_temp_dir(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("pilauncher-{}-{}", label, unique));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn normalize_manifest_entry_preserves_cached_metadata() {
        let dir = create_temp_dir("mod-manifest-normalize");
        let file_path = dir.join("example.jar");
        fs::write(&file_path, b"demo").expect("write mod file");

        let file_state = build_file_state(&file_path).expect("file state");
        let raw = RawModManifestEntry {
            source: Some(build_manifest_source(
                ModSourceKind::LauncherDownload,
                Some("modrinth".to_string()),
                Some("project-1".to_string()),
                Some("version-1".to_string()),
            )),
            hash: Some(compute_file_hash(&file_path).expect("hash")),
            file_state: Some(file_state.clone()),
            mod_id: Some("demo_mod".to_string()),
            name: Some("Demo Mod".to_string()),
            version: Some("1.0.0".to_string()),
            description: Some("Cached description".to_string()),
            icon_rel_path: Some("icons/demo.png".to_string()),
            ..Default::default()
        };

        let normalized = normalize_manifest_entry(
            Some(raw),
            &file_path,
            file_state,
            ModSourceKind::ExternalImport,
        )
        .expect("normalize manifest");

        assert_eq!(normalized.mod_id.as_deref(), Some("demo_mod"));
        assert_eq!(normalized.name.as_deref(), Some("Demo Mod"));
        assert_eq!(normalized.version.as_deref(), Some("1.0.0"));
        assert_eq!(
            normalized.description.as_deref(),
            Some("Cached description")
        );
        assert_eq!(normalized.icon_rel_path.as_deref(), Some("icons/demo.png"));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn upsert_mod_manifest_entry_preserves_existing_cached_metadata() {
        let dir = create_temp_dir("mod-manifest-upsert");
        let manifest_path = dir.join("mod_manifest.json");

        let mut existing_manifest = ModManifest::new();
        let mut existing_entry = build_manifest_entry(
            build_manifest_source(
                ModSourceKind::ExternalImport,
                Some("curseforge".to_string()),
                Some("123".to_string()),
                Some("456".to_string()),
            ),
            ModFileHash::sha1("existing".to_string()),
            ModFileState::default(),
        );
        existing_entry.mod_id = Some("demo_mod".to_string());
        existing_entry.name = Some("Demo Mod".to_string());
        existing_entry.version = Some("1.0.0".to_string());
        existing_entry.description = Some("Keep me".to_string());
        existing_entry.icon_rel_path = Some("icons/demo.png".to_string());
        existing_manifest.insert("demo.jar".to_string(), existing_entry);
        write_mod_manifest(&manifest_path, &existing_manifest).expect("write manifest");

        let updated_entry = build_manifest_entry(
            build_manifest_source(
                ModSourceKind::LauncherDownload,
                Some("modrinth".to_string()),
                Some("proj-2".to_string()),
                Some("ver-2".to_string()),
            ),
            ModFileHash::sha1("updated".to_string()),
            ModFileState::default(),
        );
        upsert_mod_manifest_entry(&manifest_path, "demo.jar", &updated_entry).expect("upsert");

        let content = fs::read_to_string(&manifest_path).expect("read manifest");
        let manifest = serde_json::from_str::<ModManifest>(&content).expect("parse manifest");
        let entry = manifest.get("demo.jar").expect("entry");

        assert_eq!(entry.source.platform.as_deref(), Some("modrinth"));
        assert_eq!(entry.mod_id.as_deref(), Some("demo_mod"));
        assert_eq!(entry.name.as_deref(), Some("Demo Mod"));
        assert_eq!(entry.version.as_deref(), Some("1.0.0"));
        assert_eq!(entry.description.as_deref(), Some("Keep me"));
        assert_eq!(entry.icon_rel_path.as_deref(), Some("icons/demo.png"));

        let _ = fs::remove_dir_all(dir);
    }
}
