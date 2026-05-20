use crate::domain::mod_manifest::{
    build_file_state, build_manifest_entry, build_manifest_source, compute_file_hash,
    mod_manifest_key, normalize_manifest_entry, read_raw_mod_manifest, upsert_mod_manifest_entry,
    write_mod_manifest, ModManifest, ModManifestEntry, ModSourceKind,
};
use std::collections::HashMap;
use std::path::Path;

pub struct ModManifestService;

impl ModManifestService {
    fn collect_from_mods_dir(
        mods_dir: &Path,
        manifest_path: &Path,
        persist: bool,
    ) -> Result<ModManifest, String> {
        let mut raw_manifest = read_raw_mod_manifest(manifest_path);
        let mut manifest = HashMap::new();

        if mods_dir.exists() {
            for entry in std::fs::read_dir(mods_dir).map_err(|e| e.to_string())? {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(_) => continue,
                };
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let file_name = entry.file_name().to_string_lossy().to_string();
                if !file_name.ends_with(".jar") && !file_name.ends_with(".jar.disabled") {
                    continue;
                }

                let key = mod_manifest_key(&file_name);
                let file_state = build_file_state(&path)?;
                let normalized = normalize_manifest_entry(
                    raw_manifest.remove(&key),
                    &path,
                    file_state,
                    ModSourceKind::ExternalImport,
                )?;
                manifest.insert(key, normalized);
            }
        }

        if persist {
            write_mod_manifest(manifest_path, &manifest)?;
        }

        Ok(manifest)
    }

    pub fn load_from_mods_dir(
        mods_dir: &Path,
        manifest_path: &Path,
    ) -> Result<ModManifest, String> {
        Self::collect_from_mods_dir(mods_dir, manifest_path, false)
    }

    pub fn sync_from_mods_dir(
        mods_dir: &Path,
        manifest_path: &Path,
    ) -> Result<ModManifest, String> {
        Self::collect_from_mods_dir(mods_dir, manifest_path, true)
    }

    pub fn upsert_downloaded_mod(
        manifest_path: &Path,
        target_path: &Path,
        source_kind: ModSourceKind,
        platform: Option<String>,
        project_id: Option<String>,
        file_id: Option<String>,
    ) -> Result<(), String> {
        let file_state = build_file_state(target_path)?;
        let hash = compute_file_hash(target_path)?;
        let entry = build_manifest_entry(
            build_manifest_source(source_kind, platform, project_id, file_id),
            hash,
            file_state,
        );

        let file_name = target_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Unable to resolve mod file name".to_string())?;

        upsert_mod_manifest_entry(manifest_path, file_name, &entry)
    }

    pub fn rename_entries(
        manifest_path: &Path,
        renames: &[(String, String)],
    ) -> Result<(), String> {
        if renames.is_empty() {
            return Ok(());
        }

        let mut manifest = if manifest_path.exists() {
            let content = std::fs::read_to_string(manifest_path).unwrap_or_default();
            serde_json::from_str::<ModManifest>(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        for (old_file_name, new_file_name) in renames {
            let old_key = mod_manifest_key(old_file_name);
            let new_key = mod_manifest_key(new_file_name);

            if old_key == new_key {
                continue;
            }

            if let Some(entry) = manifest.remove(&old_key) {
                manifest.insert(new_key, entry);
            }
        }

        write_mod_manifest(manifest_path, &manifest)
    }

    pub fn manifest_cache_key(
        entry: Option<&ModManifestEntry>,
        mod_id: Option<&str>,
        file_key: &str,
    ) -> String {
        if let Some(entry) = entry {
            if let (Some(platform), Some(project_id)) = (
                entry.source.platform.as_deref(),
                entry.source.project_id.as_deref(),
            ) {
                return format!("{}_{}", platform, project_id);
            }
        }

        if let Some(mod_id) = mod_id {
            if !mod_id.is_empty() {
                return format!("local_{}", mod_id);
            }
        }

        format!(
            "file_{}",
            file_key.replace(|c: char| !c.is_ascii_alphanumeric(), "_")
        )
    }
}
