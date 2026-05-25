use crate::domain::mod_manifest::{
    build_file_state, build_manifest_entry, build_manifest_source, compute_file_hash,
    mod_manifest_key, normalize_manifest_entry, read_raw_mod_manifest, upsert_mod_manifest_entry,
    write_mod_manifest, ModManifest, ModManifestEntry, ModPlatformMatch, ModSourceKind,
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

    pub fn update_platform_matches(
        manifest_path: &Path,
        file_name: &str,
        matches: HashMap<String, ModPlatformMatch>,
    ) -> Result<(), String> {
        if matches.is_empty() {
            return Ok(());
        }

        let mut manifest = if manifest_path.exists() {
            let content = std::fs::read_to_string(manifest_path).unwrap_or_default();
            serde_json::from_str::<ModManifest>(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        let key = mod_manifest_key(file_name);
        let entry = manifest
            .get_mut(&key)
            .ok_or_else(|| format!("Mod manifest entry not found: {}", file_name))?;

        for (platform, matched) in matches {
            if platform.trim().is_empty() {
                continue;
            }
            let target = entry
                .matched_platforms
                .entry(platform.trim().to_ascii_lowercase())
                .or_default();

            if matched.project_id.is_some() {
                target.project_id = matched.project_id;
            }
            if matched.file_id.is_some() {
                target.file_id = matched.file_id;
            }
        }

        write_mod_manifest(manifest_path, &manifest)
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
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
    fn update_platform_matches_merges_multiple_platforms() {
        let dir = create_temp_dir("mod-platform-matches");
        let manifest_path = dir.join("mod_manifest.json");

        let mut manifest = ModManifest::new();
        manifest.insert(
            "demo.jar".to_string(),
            build_manifest_entry(
                build_manifest_source(ModSourceKind::ExternalImport, None, None, None),
                crate::domain::mod_manifest::ModFileHash::sha1("hash".to_string()),
                crate::domain::mod_manifest::ModFileState::default(),
            ),
        );
        write_mod_manifest(&manifest_path, &manifest).expect("write manifest");

        let mut matches = HashMap::new();
        matches.insert(
            "Modrinth".to_string(),
            ModPlatformMatch {
                project_id: Some("mr-project".to_string()),
                file_id: Some("mr-version".to_string()),
            },
        );
        matches.insert(
            "curseforge".to_string(),
            ModPlatformMatch {
                project_id: Some("cf-project".to_string()),
                file_id: Some("cf-file".to_string()),
            },
        );

        ModManifestService::update_platform_matches(&manifest_path, "demo.jar", matches)
            .expect("update matches");

        let content = fs::read_to_string(&manifest_path).expect("read manifest");
        let parsed = serde_json::from_str::<ModManifest>(&content).expect("parse manifest");
        let entry = parsed.get("demo.jar").expect("entry");

        assert_eq!(
            entry
                .matched_platforms
                .get("modrinth")
                .and_then(|matched| matched.project_id.as_deref()),
            Some("mr-project")
        );
        assert_eq!(
            entry
                .matched_platforms
                .get("curseforge")
                .and_then(|matched| matched.file_id.as_deref()),
            Some("cf-file")
        );

        let mut partial_matches = HashMap::new();
        partial_matches.insert(
            "curseforge".to_string(),
            ModPlatformMatch {
                project_id: Some("cf-project-2".to_string()),
                file_id: None,
            },
        );
        ModManifestService::update_platform_matches(&manifest_path, "demo.jar", partial_matches)
            .expect("merge partial match");

        let content = fs::read_to_string(&manifest_path).expect("read manifest");
        let parsed = serde_json::from_str::<ModManifest>(&content).expect("parse manifest");
        let entry = parsed.get("demo.jar").expect("entry");
        let curseforge = entry
            .matched_platforms
            .get("curseforge")
            .expect("curseforge");
        assert_eq!(curseforge.project_id.as_deref(), Some("cf-project-2"));
        assert_eq!(curseforge.file_id.as_deref(), Some("cf-file"));

        let _ = fs::remove_dir_all(dir);
    }
}
