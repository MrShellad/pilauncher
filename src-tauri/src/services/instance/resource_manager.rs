use crate::services::config_service::ConfigService;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ResourceType {
    Mod,
    Save,
    Shader,
    ResourcePack,
}

impl ResourceType {
    pub fn folder_name(&self) -> &'static str {
        match self {
            ResourceType::Mod => "mods",
            ResourceType::Save => "saves",
            ResourceType::Shader => "shaderpacks",
            ResourceType::ResourcePack => "resourcepacks",
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResourceItem {
    pub file_name: String,
    pub is_enabled: bool,
    pub is_directory: bool,
    pub file_size: u64,
    pub modified_at: i64,
    pub icon_absolute_path: Option<String>,
    pub meta: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    pub id: String,
    pub timestamp: String,
    pub item_count: usize,
    pub description: String,
}

pub struct ResourceManager;

impl ResourceManager {
    pub fn get_instance_root<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Base path not configured".to_string())?;

        Ok(PathBuf::from(base_path).join("instances").join(instance_id))
    }

    pub fn get_game_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let instance_root = Self::get_instance_root(app, instance_id)?;
        let config_path = instance_root.join("instance.json");

        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(config) =
                    serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
                {
                    if let Some(third_party) = config.third_party_path {
                        let path = PathBuf::from(third_party);
                        if path.exists() {
                            return Ok(path);
                        }
                    }
                }
            }
        }

        Ok(instance_root)
    }

    pub fn get_target_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: &ResourceType,
    ) -> Result<PathBuf, String> {
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let target = game_dir.join(res_type.folder_name());
        fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        Ok(target)
    }

    pub fn list_resources<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
    ) -> Result<Vec<ResourceItem>, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let mut items = Vec::new();

        let icons_base_dir = crate::services::instance::mod_manager::icon_storage::IconStorage::get_shared_mods_dir(app)
            .ok()
            .map(|d| d.join("icons"));

        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.filter_map(|value| value.ok()) {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }

                let metadata = match entry.metadata() {
                    Ok(m) => m,
                    Err(_) => continue,
                };

                let is_dir = metadata.is_dir();
                let lower_name = file_name.to_ascii_lowercase();

                // 过滤非目标资源文件（例如 txt、json、log、properties 等非包文件）
                let is_valid_resource = match res_type {
                    ResourceType::Mod => {
                        lower_name.ends_with(".jar") || lower_name.ends_with(".jar.disabled")
                    }
                    ResourceType::ResourcePack | ResourceType::Shader => {
                        is_dir || lower_name.ends_with(".zip") || lower_name.ends_with(".zip.disabled")
                    }
                    ResourceType::Save => is_dir,
                };

                if !is_valid_resource {
                    continue;
                }

                let modified_at = metadata
                    .modified()
                    .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs() as i64;

                let clean_name = file_name
                    .trim_end_matches(".disabled")
                    .trim_end_matches(".zip")
                    .trim_end_matches(".jar");

                let icon_absolute_path = icons_base_dir
                    .as_ref()
                    .and_then(|base| {
                        crate::services::instance::mod_manager::icon_storage::IconStorage::find_cached_icon_in_buckets(base, clean_name)
                            .or_else(|| {
                                let legacy = base.join("offline").join(format!("{}.png", clean_name));
                                if legacy.is_file() {
                                    Some(legacy)
                                } else {
                                    None
                                }
                            })
                    })
                    .map(|p| p.to_string_lossy().replace('\\', "/"));

                items.push(ResourceItem {
                    file_name: file_name.clone(),
                    is_enabled: !file_name.ends_with(".disabled"),
                    is_directory: metadata.is_dir(),
                    file_size: metadata.len(),
                    modified_at,
                    icon_absolute_path,
                    meta: None,
                });
            }
        }

        items.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
        Ok(items)
    }

    pub fn toggle_resource<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        file_name: &str,
        enable: bool,
    ) -> Result<(), String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let current_path = target_dir.join(file_name);
        if !current_path.exists() {
            return Err("Resource file does not exist".to_string());
        }

        let new_file_name = if enable {
            file_name.trim_end_matches(".disabled").to_string()
        } else if file_name.ends_with(".disabled") {
            return Ok(());
        } else {
            format!("{}.disabled", file_name)
        };

        let res = fs::rename(current_path, target_dir.join(&new_file_name)).map_err(|e| e.to_string());
        if res.is_ok() {
            use tauri::Emitter;
            let _ = app.emit(
                "instance-resources-fs-changed",
                serde_json::json!({
                    "instanceId": instance_id,
                    "resType": res_type,
                    "action": "toggle",
                    "fileName": new_file_name
                }),
            );

            if res_type == ResourceType::Mod {
                let db = app.state::<crate::services::db_service::AppDatabase>();
                let pool = db.pool.clone();
                let inst_id = instance_id.to_string();
                let old_f = file_name.to_string();
                let new_f = new_file_name.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::services::db_service::DbService::toggle_instance_mod(&pool, &inst_id, &old_f, &new_f, enable).await;
                });

                let _ = app.emit(
                    "instance-mods-fs-changed",
                    serde_json::json!({
                        "instanceId": instance_id,
                        "action": "toggle",
                        "fileName": new_file_name
                    }),
                );
            }
        }
        res
    }

    pub fn delete_resource<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        file_name: &str,
    ) -> Result<(), String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let current_path = target_dir.join(file_name);

        if current_path.exists() {
            if current_path.is_dir() {
                fs::remove_dir_all(&current_path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&current_path).map_err(|e| e.to_string())?;
            }
        }

        use tauri::Emitter;
        let _ = app.emit(
            "instance-resources-fs-changed",
            serde_json::json!({
                "instanceId": instance_id,
                "resType": res_type,
                "action": "delete",
                "fileName": file_name
            }),
        );

        if res_type == ResourceType::Mod {
            let db = app.state::<crate::services::db_service::AppDatabase>();
            let pool = db.pool.clone();
            let inst_id = instance_id.to_string();
            let f_name = file_name.to_string();
            tauri::async_runtime::spawn(async move {
                let _ = crate::services::db_service::DbService::delete_instance_mods(&pool, &inst_id, &[f_name]).await;
            });

            let _ = app.emit(
                "instance-mods-fs-changed",
                serde_json::json!({
                    "instanceId": instance_id,
                    "action": "delete",
                    "fileName": file_name
                }),
            );

            if let Ok(root) = Self::get_instance_root(app, instance_id) {
                let manifest_path = root.join("mod_manifest.json");
                if manifest_path.exists() {
                    let _ = fs::remove_file(manifest_path);
                }
            }
        }

        Ok(())
    }

    pub fn create_snapshot<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        desc: &str,
    ) -> Result<ResourceSnapshot, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let snapshots_dir = Self::get_instance_root(app, instance_id)?
            .join("piconfig")
            .join("snapshots")
            .join(res_type.folder_name());

        let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
        let snapshot_path = snapshots_dir.join(&timestamp);
        fs::create_dir_all(&snapshot_path).map_err(|e| e.to_string())?;

        let mut item_count = 0;
        if target_dir.exists() {
            for entry in fs::read_dir(&target_dir).map_err(|e| e.to_string())? {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(_) => continue,
                };
                if entry.path().is_file() {
                    fs::copy(entry.path(), snapshot_path.join(entry.file_name()))
                        .map_err(|e| e.to_string())?;
                    item_count += 1;
                }
            }
        }

        Ok(ResourceSnapshot {
            id: timestamp,
            timestamp: chrono::Local::now().to_rfc3339(),
            item_count,
            description: desc.to_string(),
        })
    }

    pub fn list_snapshots<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
    ) -> Result<Vec<ResourceSnapshot>, String> {
        let snapshots_dir = Self::get_instance_root(app, instance_id)?
            .join("piconfig")
            .join("snapshots")
            .join(res_type.folder_name());

        if !snapshots_dir.exists() {
            return Ok(Vec::new());
        }

        let mut snapshots = Vec::new();
        for entry in fs::read_dir(&snapshots_dir).map_err(|e| e.to_string())? {
            let entry = match entry {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            if entry.path().is_dir() {
                let id = entry.file_name().to_string_lossy().to_string();
                let item_count = fs::read_dir(entry.path())
                    .map(|entries| entries.count())
                    .unwrap_or(0);

                snapshots.push(ResourceSnapshot {
                    id: id.clone(),
                    timestamp: id,
                    item_count,
                    description: String::new(),
                });
            }
        }

        snapshots.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(snapshots)
    }

    pub fn upsert_downloaded_mod<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        source_kind: &str,
        platform: &str,
        project_id: &str,
        file_id: &str,
        version: Option<String>,
        old_file_name: Option<String>,
    ) -> Result<(), String> {
        let target_path = Self::get_game_dir(app, instance_id)?
            .join("mods")
            .join(file_name);

        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let inst_id = instance_id.to_string();
        let f_name = file_name.to_string();
        let p_form = if platform.trim().is_empty() { None } else { Some(platform.to_string()) };
        let p_id = if project_id.trim().is_empty() { None } else { Some(project_id.to_string()) };
        let f_id = if file_id.trim().is_empty() { None } else { Some(file_id.to_string()) };
        let ver = version;
        let old_f = old_file_name;
        let s_kind = source_kind.to_string();

        tauri::async_runtime::spawn(async move {
            if let Some(old) = old_f {
                let _ = crate::services::db_service::DbService::delete_instance_mods(&pool, &inst_id, &[old]).await;
            }
            let (size, mtime, jar_meta, cf_fp, sha1_str) = if target_path.exists() {
                let meta = std::fs::metadata(&target_path).ok();
                let s = meta.as_ref().map(|m| m.len() as i64).unwrap_or(0);
                let m_t = meta.as_ref().and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_secs() as i64)
                    .unwrap_or(0);
                
                let j_m = crate::services::instance::mod_manager::jar_parser::JarParser::parse_jar_meta(&target_path);
                let fp = crate::services::instance::mod_manager::remote_fetcher::RemoteFetcher::resolve_curseforge_fingerprint(None, &target_path);
                
                let s_hash = if let Ok(mut file) = std::fs::File::open(&target_path) {
                    use sha1::Digest;
                    let mut hasher = sha1::Sha1::new();
                    let mut buffer = [0u8; 64 * 1024];
                    use std::io::Read;
                    while let Ok(n) = file.read(&mut buffer) {
                        if n == 0 { break; }
                        hasher.update(&buffer[..n]);
                    }
                    Some(format!("{:x}", hasher.finalize()))
                } else {
                    None
                };

                (s, m_t, Some(j_m), fp, s_hash)
            } else {
                (0, 0, None, None, None)
            };

            let effective_mod_id = jar_meta.as_ref().and_then(|m| m.mod_id.clone()).or_else(|| p_id.clone());
            let effective_version = ver.or_else(|| jar_meta.as_ref().and_then(|m| m.version.clone()));
            let effective_name = jar_meta.as_ref().and_then(|m| m.name.clone());

            let row = crate::services::db_service::InstanceModDbRow {
                instance_id: inst_id.clone(),
                file_name: f_name,
                is_enabled: true,
                file_size: size,
                modified_at: mtime,
                sha1: sha1_str,
                curseforge_fingerprint: cf_fp,
                mod_id: effective_mod_id,
                custom_display_name: effective_name,
                version: effective_version,
                source_platform: p_form.or_else(|| Some(s_kind)),
                source_project_id: p_id,
                source_file_id: f_id,
            };
            let _ = crate::services::db_service::DbService::upsert_instance_mods(&pool, &inst_id, &[row]).await;
        });

        Ok(())
    }

    pub fn update_all_mods_metadata_settings<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        settings: crate::domain::mod_manifest::ModMetadataSettings,
    ) -> Result<(), String> {
        if let Ok(mut config) =
            crate::services::instance::binding::InstanceBindingService::load_instance_config(
                app,
                instance_id,
            )
        {
            config.global_metadata_settings = Some(settings);
            let _ = crate::services::instance::binding::InstanceBindingService::write_instance_config(
                app,
                instance_id,
                &config,
            );
        }

        Ok(())
    }

    pub fn reset_all_mods_platform_metadata<R: Runtime>(
        _app: &AppHandle<R>,
        _instance_id: &str,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn update_mod_platform_matches<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        matches: std::collections::HashMap<String, crate::domain::mod_manifest::ModPlatformMatch>,
    ) -> Result<(), String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let inst_id = instance_id.to_string();
        let f_name = file_name.to_string();

        tauri::async_runtime::spawn(async move {
            let mut p_platform = None;
            let mut p_id = None;
            let mut f_id = None;
            if let Some(m) = matches.get("modrinth") {
                p_platform = Some("modrinth".to_string());
                p_id = m.project_id.clone();
                f_id = m.file_id.clone();
            } else if let Some(m) = matches.get("curseforge") {
                p_platform = Some("curseforge".to_string());
                p_id = m.project_id.clone();
                f_id = m.file_id.clone();
            }
            if p_platform.is_some() || p_id.is_some() {
                let _ = sqlx::query(
                    "UPDATE instance_mods 
                     SET source_platform = COALESCE(?, source_platform),
                         source_project_id = COALESCE(?, source_project_id),
                         source_file_id = COALESCE(?, source_file_id)
                     WHERE instance_id = ? AND file_name = ?;"
                )
                .bind(p_platform)
                .bind(p_id)
                .bind(f_id)
                .bind(&inst_id)
                .bind(&f_name)
                .execute(&pool)
                .await;
            }
        });

        Ok(())
    }

    pub fn update_mod_platform_matches_batch<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        items: Vec<crate::services::db_service::ModPlatformMatchBatchItem>,
    ) -> Result<(), String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let inst_id = instance_id.to_string();

        tauri::async_runtime::spawn(async move {
            let _ = crate::services::db_service::DbService::update_mod_platform_matches_batch(
                &pool,
                &inst_id,
                &items,
            )
            .await;
        });

        Ok(())
    }

    pub fn update_mod_metadata_settings<R: Runtime>(
        _app: &AppHandle<R>,
        _instance_id: &str,
        _file_name: &str,
        _settings: crate::domain::mod_manifest::ModMetadataSettings,
    ) -> Result<(), String> {
        Ok(())
    }

    pub fn reset_mod_platform_metadata<R: Runtime>(
        _app: &AppHandle<R>,
        _instance_id: &str,
        _file_name: &str,
    ) -> Result<(), String> {
        Ok(())
    }
}
