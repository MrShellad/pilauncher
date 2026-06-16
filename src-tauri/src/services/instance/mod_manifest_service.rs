use crate::domain::mod_manifest::{
    build_file_state, build_manifest_entry, build_manifest_source, compute_file_hash,
    mod_manifest_key, normalize_manifest_entry, read_raw_mod_manifest, upsert_mod_manifest_entry,
    write_mod_manifest, ModManifest, ModManifestEntry, ModMetadataSettings, ModPlatformMatch,
    ModSourceKind, ModFileHash,
};
use std::collections::HashMap;
use std::path::Path;

pub struct ModManifestService;

impl ModManifestService {
    pub fn read_manifest_robust(manifest_path: &Path) -> ModManifest {
        let raw_manifest = read_raw_mod_manifest(manifest_path);
        let mut manifest = HashMap::new();

        for (file_name, raw) in raw_manifest {
            let source = raw.source.clone().unwrap_or_else(|| {
                let inferred_kind = if raw.platform.is_some()
                    || raw.project_id.is_some()
                    || raw.file_id.is_some()
                {
                    ModSourceKind::Unknown
                } else {
                    ModSourceKind::ExternalImport
                };

                build_manifest_source(
                    inferred_kind,
                    raw.platform.clone(),
                    raw.project_id.clone(),
                    raw.file_id.clone(),
                )
            });
            let file_state = raw.file_state.clone().unwrap_or_default();
            let mut entry = build_manifest_entry(
                source,
                raw.hash.clone().unwrap_or_else(|| ModFileHash {
                    algorithm: "none".to_string(),
                    value: "none".to_string(),
                }),
                file_state,
            );
            entry.mod_id = raw.mod_id;
            entry.name = raw.name;
            entry.version = raw.version;
            entry.description = raw.description;
            entry.icon_rel_path = raw.icon_rel_path;
            entry.curseforge_fingerprint = raw.curseforge_fingerprint;
            entry.matched_platforms = raw.matched_platforms;
            entry.metadata_settings = raw.metadata_settings;
            manifest.insert(file_name, entry);
        }

        manifest
    }

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

                let raw_entry = match raw_manifest.remove(&key) {
                    Some(entry) => Some(entry),
                    None => {
                        // Try to find an entry in raw_manifest with the same file hash (representing manual renaming)
                        if let Ok(file_hash) = compute_file_hash(&path) {
                            let found_key = raw_manifest.iter().find_map(|(k, v)| {
                                if let Some(ref h) = v.hash {
                                    if h.value == file_hash.value && h.algorithm == file_hash.algorithm {
                                        Some(k.clone())
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            });
                            if let Some(k) = found_key {
                                raw_manifest.remove(&k)
                            } else {
                                None
                            }
                        } else {
                            None
                        }
                    }
                };

                let normalized = normalize_manifest_entry(
                    raw_entry,
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
}

fn check_is_modpack(manifest_path: &Path) -> bool {
    if let Some(parent) = manifest_path.parent() {
        let config_path = parent.join("instance.json");
        if config_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&config_path) {
                if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(tags) = config.get("tags").and_then(|t| t.as_array()) {
                        return tags.iter().any(|t| t.as_str() == Some("modpack"));
                    }
                }
            }
        }
    }
    false
}

impl ModManifestService {
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
        version: Option<String>,
        old_file_name: Option<String>,
    ) -> Result<(), String> {
        let is_modpack = check_is_modpack(manifest_path);
        let has_platform = platform.as_deref().map(|p| !p.trim().is_empty()).unwrap_or(false);
        let should_lock = (is_modpack || source_kind == ModSourceKind::LauncherDownload) && has_platform;
        let locked_settings = if should_lock {
            platform.as_ref().map(|p| ModMetadataSettings {
                metadata_platform: Some(p.clone()),
                update_platform: Some(p.clone()),
                metadata_locked: true,
                update_locked: true,
            })
        } else {
            None
        };

        let file_state = build_file_state(target_path)?;
        let hash = compute_file_hash(target_path)?;
        let mut entry = build_manifest_entry(
            build_manifest_source(source_kind, platform.clone(), project_id.clone(), file_id.clone()),
            hash,
            file_state,
        );
        if version.is_some() {
            entry.version = version;
        }
        if locked_settings.is_some() {
            entry.metadata_settings = locked_settings;
        }

        if let Ok(fingerprint) = crate::domain::mod_manifest::compute_curseforge_fingerprint(target_path) {
            entry.curseforge_fingerprint = Some(fingerprint);
        }

        if let Some(old_name) = old_file_name {
            let old_key = mod_manifest_key(&old_name);
            let manifest = Self::read_manifest_robust(manifest_path);
            if let Some(old_entry) = manifest.get(&old_key) {
                if entry.mod_id.is_none() {
                    entry.mod_id = old_entry.mod_id.clone();
                }
                if entry.name.is_none() {
                    entry.name = old_entry.name.clone();
                }
                if entry.description.is_none() {
                    entry.description = old_entry.description.clone();
                }
                if entry.icon_rel_path.is_none() {
                    entry.icon_rel_path = old_entry.icon_rel_path.clone();
                }
                if entry.matched_platforms.is_empty() {
                    entry.matched_platforms = old_entry.matched_platforms.clone();
                } else {
                    for (p, m) in &old_entry.matched_platforms {
                        entry.matched_platforms.entry(p.clone()).or_insert_with(|| m.clone());
                    }
                }
                if entry.metadata_settings.is_none() {
                    entry.metadata_settings = old_entry.metadata_settings.clone();
                }
            }
        }

        if let (Some(p), Some(pid), Some(fid)) = (platform.as_deref(), project_id.as_ref(), file_id.as_ref()) {
            let platform_key = p.trim().to_ascii_lowercase();
            if !platform_key.is_empty() {
                entry.matched_platforms.insert(
                    platform_key,
                    ModPlatformMatch {
                        project_id: Some(pid.clone()),
                        file_id: Some(fid.clone()),
                    },
                );
            }
        }

        let file_name = target_path
            .file_name()
            .and_then(|value| value.to_str())
            .ok_or_else(|| "Unable to resolve mod file name".to_string())?;

        upsert_mod_manifest_entry(manifest_path, file_name, &entry)
    }

    pub fn update_all_metadata_settings(
        manifest_path: &Path,
        settings: ModMetadataSettings,
    ) -> Result<(), String> {
        let mut manifest = Self::read_manifest_robust(manifest_path);

        for entry in manifest.values_mut() {
            let old_platform = entry.metadata_settings.as_ref()
                .and_then(|s| s.metadata_platform.as_deref())
                .unwrap_or("auto");
            let new_platform = settings.metadata_platform.as_deref().unwrap_or("auto");

            if old_platform != new_platform {
                entry.source.platform = None;
                entry.source.project_id = None;
                entry.source.file_id = None;
                entry.name = None;
                entry.description = None;
                entry.icon_rel_path = None;
            }
            entry.metadata_settings = Some(settings.clone());
        }

        write_mod_manifest(manifest_path, &manifest)
    }

    pub fn reset_all_platform_metadata(manifest_path: &Path) -> Result<(), String> {
        let mut manifest = Self::read_manifest_robust(manifest_path);

        for entry in manifest.values_mut() {
            entry.source.platform = None;
            entry.source.project_id = None;
            entry.source.file_id = None;
            entry.name = None;
            entry.description = None;
            entry.icon_rel_path = None;
            entry.matched_platforms.clear();
        }

        write_mod_manifest(manifest_path, &manifest)
    }

    pub fn update_platform_matches(
        manifest_path: &Path,
        file_name: &str,
        matches: HashMap<String, ModPlatformMatch>,
    ) -> Result<(), String> {
        if matches.is_empty() {
            return Ok(());
        }

        let mut manifest = Self::read_manifest_robust(manifest_path);

        let key = mod_manifest_key(file_name);
        let entry = manifest.entry(key).or_insert_with(|| {
            build_manifest_entry(
                build_manifest_source(ModSourceKind::ExternalImport, None, None, None),
                ModFileHash {
                    algorithm: "none".to_string(),
                    value: "none".to_string(),
                },
                crate::domain::mod_manifest::ModFileState::default(),
            )
        });

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

    pub fn update_metadata_settings(
        manifest_path: &Path,
        file_name: &str,
        settings: ModMetadataSettings,
    ) -> Result<(), String> {
        let mut manifest = Self::read_manifest_robust(manifest_path);

        let key = mod_manifest_key(file_name);
        let entry = manifest.entry(key).or_insert_with(|| {
            build_manifest_entry(
                build_manifest_source(ModSourceKind::ExternalImport, None, None, None),
                ModFileHash {
                    algorithm: "none".to_string(),
                    value: "none".to_string(),
                },
                crate::domain::mod_manifest::ModFileState::default(),
            )
        });

        let old_platform = entry.metadata_settings.as_ref()
            .and_then(|s| s.metadata_platform.as_deref())
            .unwrap_or("auto");
        let new_platform = settings.metadata_platform.as_deref().unwrap_or("auto");

        if old_platform != new_platform {
            entry.source.platform = None;
            entry.source.project_id = None;
            entry.source.file_id = None;
            entry.name = None;
            entry.description = None;
            entry.icon_rel_path = None;
        }

        entry.metadata_settings = Some(settings);
        write_mod_manifest(manifest_path, &manifest)
    }

    pub fn reset_platform_metadata(manifest_path: &Path, file_name: &str) -> Result<(), String> {
        let mut manifest = Self::read_manifest_robust(manifest_path);

        let key = mod_manifest_key(file_name);
        let entry = manifest.entry(key).or_insert_with(|| {
            build_manifest_entry(
                build_manifest_source(ModSourceKind::ExternalImport, None, None, None),
                ModFileHash {
                    algorithm: "none".to_string(),
                    value: "none".to_string(),
                },
                crate::domain::mod_manifest::ModFileState::default(),
            )
        });

        entry.source.platform = None;
        entry.source.project_id = None;
        entry.source.file_id = None;
        entry.name = None;
        entry.description = None;
        entry.icon_rel_path = None;
        entry.matched_platforms.clear();
        write_mod_manifest(manifest_path, &manifest)
    }

    pub fn rename_entries(
        manifest_path: &Path,
        renames: &[(String, String)],
    ) -> Result<(), String> {
        if renames.is_empty() {
            return Ok(());
        }

        let mut manifest = Self::read_manifest_robust(manifest_path);

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

    #[test]
    fn update_metadata_settings_preserves_matched_platforms() {
        let dir = create_temp_dir("mod-metadata-settings");
        let manifest_path = dir.join("mod_manifest.json");

        let mut entry = build_manifest_entry(
            build_manifest_source(
                ModSourceKind::LauncherDownload,
                Some("modrinth".to_string()),
                Some("mr-project".to_string()),
                Some("mr-file".to_string()),
            ),
            crate::domain::mod_manifest::ModFileHash::sha1("hash".to_string()),
            crate::domain::mod_manifest::ModFileState::default(),
        );
        entry.matched_platforms.insert(
            "modrinth".to_string(),
            ModPlatformMatch {
                project_id: Some("mr-project".to_string()),
                file_id: Some("mr-file".to_string()),
            },
        );

        let mut manifest = ModManifest::new();
        manifest.insert("demo.jar".to_string(), entry);
        write_mod_manifest(&manifest_path, &manifest).expect("write manifest");

        ModManifestService::update_metadata_settings(
            &manifest_path,
            "demo.jar",
            ModMetadataSettings {
                metadata_platform: Some("curseforge".to_string()),
                update_platform: Some("curseforge".to_string()),
                metadata_locked: true,
                update_locked: true,
            },
        )
        .expect("update settings");

        let content = fs::read_to_string(&manifest_path).expect("read manifest");
        let parsed = serde_json::from_str::<ModManifest>(&content).expect("parse manifest");
        let entry = parsed.get("demo.jar").expect("entry");

        assert_eq!(
            entry
                .matched_platforms
                .get("modrinth")
                .and_then(|matched| matched.file_id.as_deref()),
            Some("mr-file")
        );
        assert_eq!(
            entry
                .metadata_settings
                .as_ref()
                .and_then(|settings| settings.metadata_platform.as_deref()),
            Some("curseforge")
        );
        assert_eq!(
            entry
                .metadata_settings
                .as_ref()
                .map(|settings| settings.update_locked),
            Some(true)
        );

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn reset_platform_metadata_clears_source_and_matches_but_keeps_settings() {
        let dir = create_temp_dir("mod-reset-platform-metadata");
        let manifest_path = dir.join("mod_manifest.json");

        let mut entry = build_manifest_entry(
            build_manifest_source(
                ModSourceKind::LauncherDownload,
                Some("modrinth".to_string()),
                Some("mr-project".to_string()),
                Some("mr-file".to_string()),
            ),
            crate::domain::mod_manifest::ModFileHash::sha1("hash".to_string()),
            crate::domain::mod_manifest::ModFileState::default(),
        );
        entry.matched_platforms.insert(
            "modrinth".to_string(),
            ModPlatformMatch {
                project_id: Some("mr-project".to_string()),
                file_id: Some("mr-file".to_string()),
            },
        );
        entry.metadata_settings = Some(ModMetadataSettings {
            metadata_platform: Some("modrinth".to_string()),
            update_platform: Some("modrinth".to_string()),
            metadata_locked: false,
            update_locked: false,
        });

        let mut manifest = ModManifest::new();
        manifest.insert("demo.jar".to_string(), entry);
        write_mod_manifest(&manifest_path, &manifest).expect("write manifest");

        ModManifestService::reset_platform_metadata(&manifest_path, "demo.jar")
            .expect("reset metadata");

        let content = fs::read_to_string(&manifest_path).expect("read manifest");
        let parsed = serde_json::from_str::<ModManifest>(&content).expect("parse manifest");
        let entry = parsed.get("demo.jar").expect("entry");

        assert_eq!(entry.source.platform, None);
        assert_eq!(entry.source.project_id, None);
        assert!(entry.matched_platforms.is_empty());
        assert_eq!(
            entry
                .metadata_settings
                .as_ref()
                .and_then(|settings| settings.metadata_platform.as_deref()),
            Some("modrinth")
        );

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_check_is_modpack() {
        let dir = create_temp_dir("mod-check-is-modpack");
        let manifest_path = dir.join("mod_manifest.json");

        // 1. instance.json does not exist
        assert!(!check_is_modpack(&manifest_path));

        // 2. instance.json exists but has no tags
        let config_path = dir.join("instance.json");
        fs::write(&config_path, "{}").unwrap();
        assert!(!check_is_modpack(&manifest_path));

        // 3. instance.json has tags but not "modpack"
        fs::write(&config_path, r#"{"tags": ["vanilla", "forge"]}"#).unwrap();
        assert!(!check_is_modpack(&manifest_path));

        // 4. instance.json has tag "modpack"
        fs::write(&config_path, r#"{"tags": ["vanilla", "modpack", "forge"]}"#).unwrap();
        assert!(check_is_modpack(&manifest_path));

        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn test_upsert_downloaded_mod_locking_behavior() {
        let dir = create_temp_dir("mod-upsert-locking");
        let manifest_path = dir.join("mod_manifest.json");
        let jar_path = dir.join("test_mod.jar");
        fs::write(&jar_path, "dummy jar content").unwrap();

        // Helper to write an instance.json with specified tags
        let set_tags = |tags: &[&str]| {
            let tags_json = serde_json::to_string(tags).unwrap();
            let content = format!(r#"{{"tags": {}}}"#, tags_json);
            fs::write(dir.join("instance.json"), content).unwrap();
        };

        // Case 1: Not a modpack, ExternalImport, has platform. Expected: NOT locked.
        set_tags(&["forge"]);
        ModManifestService::upsert_downloaded_mod(
            &manifest_path,
            &jar_path,
            ModSourceKind::ExternalImport,
            Some("modrinth".to_string()),
            Some("proj123".to_string()),
            Some("file123".to_string()),
            Some("1.0.0".to_string()),
            None,
        ).unwrap();

        let content = fs::read_to_string(&manifest_path).unwrap();
        let parsed: ModManifest = serde_json::from_str(&content).unwrap();
        let entry = parsed.get("test_mod.jar").unwrap();
        assert!(entry.metadata_settings.is_none());

        // Case 2: Not a modpack, LauncherDownload, has platform. Expected: LOCKED.
        set_tags(&["forge"]);
        ModManifestService::upsert_downloaded_mod(
            &manifest_path,
            &jar_path,
            ModSourceKind::LauncherDownload,
            Some("curseforge".to_string()),
            Some("proj456".to_string()),
            Some("file456".to_string()),
            Some("1.0.1".to_string()),
            None,
        ).unwrap();

        let content = fs::read_to_string(&manifest_path).unwrap();
        let parsed: ModManifest = serde_json::from_str(&content).unwrap();
        let entry = parsed.get("test_mod.jar").unwrap();
        let settings = entry.metadata_settings.as_ref().unwrap();
        assert_eq!(settings.metadata_platform.as_deref(), Some("curseforge"));
        assert_eq!(settings.update_platform.as_deref(), Some("curseforge"));
        assert!(settings.metadata_locked);
        assert!(settings.update_locked);

        // Case 3: Is a modpack, ExternalImport, has platform. Expected: LOCKED.
        set_tags(&["modpack"]);
        ModManifestService::upsert_downloaded_mod(
            &manifest_path,
            &jar_path,
            ModSourceKind::ExternalImport,
            Some("modrinth".to_string()),
            Some("proj789".to_string()),
            Some("file789".to_string()),
            Some("1.0.2".to_string()),
            None,
        ).unwrap();

        let content = fs::read_to_string(&manifest_path).unwrap();
        let parsed: ModManifest = serde_json::from_str(&content).unwrap();
        let entry = parsed.get("test_mod.jar").unwrap();
        let settings = entry.metadata_settings.as_ref().unwrap();
        assert_eq!(settings.metadata_platform.as_deref(), Some("modrinth"));
        assert_eq!(settings.update_platform.as_deref(), Some("modrinth"));
        assert!(settings.metadata_locked);
        assert!(settings.update_locked);

        // Case 4: Is a modpack, ExternalImport, NO platform (None). Expected: NOT locked.
        set_tags(&["modpack"]);
        let jar_path2 = dir.join("test_mod2.jar");
        fs::write(&jar_path2, "dummy jar content 2").unwrap();
        ModManifestService::upsert_downloaded_mod(
            &manifest_path,
            &jar_path2,
            ModSourceKind::ExternalImport,
            None,
            None,
            None,
            None,
            None,
        ).unwrap();

        let content = fs::read_to_string(&manifest_path).unwrap();
        let parsed: ModManifest = serde_json::from_str(&content).unwrap();
        let entry2 = parsed.get("test_mod2.jar").unwrap();
        assert!(entry2.metadata_settings.is_none());

        let _ = fs::remove_dir_all(dir);
    }
}
