use crate::services::config::ConfigService;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Component;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Runtime};

static RESOURCE_METADATA_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ResourceType {
    Mod,
    Save,
    Shader,
    ResourcePack,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSourceMetadata {
    pub resource_type: ResourceType,
    pub file_name: String,
    pub source_kind: String,
    pub platform: String,
    pub project_id: String,
    pub file_id: String,
    pub version: Option<String>,
    pub updated_at: i64,
}

#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResourceFileIdentifiers {
    pub file_name: String,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct ResourceMetadataManifest {
    #[serde(default = "resource_metadata_schema_version")]
    schema_version: u32,
    #[serde(default)]
    resources: Vec<ResourceSourceMetadata>,
}

fn resource_metadata_schema_version() -> u32 {
    1
}

impl Default for ResourceMetadataManifest {
    fn default() -> Self {
        Self {
            schema_version: resource_metadata_schema_version(),
            resources: Vec::new(),
        }
    }
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
    pub meta: Option<ResourceSourceMetadata>,
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
    fn metadata_path<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<PathBuf, String> {
        Ok(Self::get_instance_root(app, instance_id)?
            .join("piconfig")
            .join("resource-metadata.json"))
    }

    fn metadata_key(res_type: ResourceType, file_name: &str) -> String {
        format!(
            "{}:{}",
            res_type.folder_name(),
            file_name
                .trim_end_matches(".disabled")
                .trim()
                .to_ascii_lowercase()
        )
    }

    fn load_metadata_manifest<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<ResourceMetadataManifest, String> {
        let path = Self::metadata_path(app, instance_id)?;
        let backup_path = path.with_extension("json.bak");
        if !path.exists() {
            if backup_path.exists() {
                fs::rename(&backup_path, &path)
                    .map_err(|error| format!("恢复资源来源元数据备份失败: {error}"))?;
            } else {
                return Ok(ResourceMetadataManifest {
                    schema_version: resource_metadata_schema_version(),
                    resources: Vec::new(),
                });
            }
        }

        let content = fs::read_to_string(&path)
            .map_err(|error| format!("读取资源来源元数据失败: {error}"))?;
        serde_json::from_str(&content).map_err(|error| format!("解析资源来源元数据失败: {error}"))
    }

    fn save_metadata_manifest<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        manifest: &ResourceMetadataManifest,
    ) -> Result<(), String> {
        let path = Self::metadata_path(app, instance_id)?;
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("创建资源来源元数据目录失败: {error}"))?;
        }
        let content = serde_json::to_string_pretty(manifest)
            .map_err(|error| format!("序列化资源来源元数据失败: {error}"))?;
        let temp_path = path.with_extension("json.tmp");
        let backup_path = path.with_extension("json.bak");
        fs::write(&temp_path, content)
            .map_err(|error| format!("写入资源来源元数据临时文件失败: {error}"))?;

        let had_manifest = path.exists();
        if had_manifest {
            if backup_path.exists() {
                fs::remove_file(&backup_path)
                    .map_err(|error| format!("清理资源来源元数据旧备份失败: {error}"))?;
            }
            fs::rename(&path, &backup_path)
                .map_err(|error| format!("备份资源来源元数据失败: {error}"))?;
        }

        if let Err(error) = fs::rename(&temp_path, &path) {
            if had_manifest {
                let _ = fs::rename(&backup_path, &path);
            }
            return Err(format!("提交资源来源元数据失败: {error}"));
        }

        if had_manifest {
            let _ = fs::remove_file(backup_path);
        }
        Ok(())
    }

    pub fn upsert_downloaded_resource<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        resource_type: ResourceType,
        file_name: &str,
        source_kind: &str,
        platform: &str,
        project_id: &str,
        file_id: &str,
        version: Option<String>,
        old_file_name: Option<&str>,
    ) -> Result<(), String> {
        let _guard = RESOURCE_METADATA_LOCK
            .lock()
            .map_err(|_| "资源来源元数据锁已损坏".to_string())?;
        let mut manifest = Self::load_metadata_manifest(app, instance_id)?;
        let new_key = Self::metadata_key(resource_type, file_name);
        let old_key = old_file_name.map(|name| Self::metadata_key(resource_type, name));

        manifest.resources.retain(|item| {
            let key = Self::metadata_key(item.resource_type, &item.file_name);
            key != new_key && old_key.as_ref().is_none_or(|old| &key != old)
        });
        manifest.resources.push(ResourceSourceMetadata {
            resource_type,
            file_name: file_name.to_string(),
            source_kind: source_kind.to_string(),
            platform: platform.to_string(),
            project_id: project_id.to_string(),
            file_id: file_id.to_string(),
            version,
            updated_at: chrono::Utc::now().timestamp(),
        });
        Self::save_metadata_manifest(app, instance_id, &manifest)
    }

    pub fn calculate_resource_file_identifiers<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        resource_type: ResourceType,
        file_names: &[String],
        include_sha1: bool,
        include_curseforge: bool,
    ) -> Result<Vec<ResourceFileIdentifiers>, String> {
        if resource_type != ResourceType::ResourcePack && resource_type != ResourceType::Shader {
            return Err("仅支持识别资源包和光影包".to_string());
        }

        let target_dir = Self::get_target_dir(app, instance_id, &resource_type)?;
        let mut identifiers = Vec::with_capacity(file_names.len());
        for file_name in file_names {
            let mut components = std::path::Path::new(file_name).components();
            let is_plain_file_name = matches!(components.next(), Some(Component::Normal(_)))
                && components.next().is_none();
            if !is_plain_file_name {
                continue;
            }

            let file_path = target_dir.join(file_name);
            if !file_path.is_file() {
                continue;
            }
            identifiers.push(ResourceFileIdentifiers {
                file_name: file_name.clone(),
                sha1: include_sha1
                    .then(|| crate::domain::mod_manifest::compute_sha1(&file_path).ok())
                    .flatten(),
                curseforge_fingerprint: include_curseforge
                    .then(|| {
                        crate::domain::mod_manifest::compute_curseforge_fingerprint(&file_path).ok()
                    })
                    .flatten(),
            });
        }
        Ok(identifiers)
    }

    fn rename_resource_metadata<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        resource_type: ResourceType,
        old_file_name: &str,
        new_file_name: &str,
    ) -> Result<(), String> {
        let _guard = RESOURCE_METADATA_LOCK
            .lock()
            .map_err(|_| "资源来源元数据锁已损坏".to_string())?;
        let mut manifest = Self::load_metadata_manifest(app, instance_id)?;
        let old_key = Self::metadata_key(resource_type, old_file_name);
        let mut changed = false;
        for item in &mut manifest.resources {
            if Self::metadata_key(item.resource_type, &item.file_name) == old_key {
                item.file_name = new_file_name.to_string();
                item.updated_at = chrono::Utc::now().timestamp();
                changed = true;
            }
        }
        if changed {
            Self::save_metadata_manifest(app, instance_id, &manifest)?;
        }
        Ok(())
    }

    fn remove_resource_metadata<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        resource_type: ResourceType,
        file_name: &str,
    ) -> Result<(), String> {
        let _guard = RESOURCE_METADATA_LOCK
            .lock()
            .map_err(|_| "资源来源元数据锁已损坏".to_string())?;
        let mut manifest = Self::load_metadata_manifest(app, instance_id)?;
        let target_key = Self::metadata_key(resource_type, file_name);
        let previous_len = manifest.resources.len();
        manifest
            .resources
            .retain(|item| Self::metadata_key(item.resource_type, &item.file_name) != target_key);
        if manifest.resources.len() != previous_len {
            Self::save_metadata_manifest(app, instance_id, &manifest)?;
        }
        Ok(())
    }

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
        let metadata_manifest = RESOURCE_METADATA_LOCK
            .lock()
            .ok()
            .and_then(|_guard| Self::load_metadata_manifest(app, instance_id).ok())
            .unwrap_or_default();

        let icons_base_dir =
            crate::services::instance::mod_manager::icon_storage::IconStorage::get_shared_mods_dir(
                app,
            )
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
                        is_dir
                            || lower_name.ends_with(".zip")
                            || lower_name.ends_with(".zip.disabled")
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
                    meta: metadata_manifest
                        .resources
                        .iter()
                        .find(|item| {
                            item.resource_type == res_type
                                && Self::metadata_key(item.resource_type, &item.file_name)
                                    == Self::metadata_key(res_type, &file_name)
                        })
                        .cloned(),
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

        let new_path = target_dir.join(&new_file_name);
        let res = fs::rename(&current_path, &new_path).map_err(|e| e.to_string());
        if res.is_ok() {
            if res_type == ResourceType::ResourcePack || res_type == ResourceType::Shader {
                if let Err(error) = Self::rename_resource_metadata(
                    app,
                    instance_id,
                    res_type,
                    file_name,
                    &new_file_name,
                ) {
                    let _ = fs::rename(&new_path, &current_path);
                    return Err(error);
                }
            }

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
                let db = app.state::<crate::services::db::AppDatabase>();
                let pool = db.pool.clone();
                let inst_id = instance_id.to_string();
                let old_f = file_name.to_string();
                let new_f = new_file_name.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::services::db::DbService::toggle_instance_mod(
                        &pool, &inst_id, &old_f, &new_f, enable,
                    )
                    .await;
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

    pub async fn toggle_mods_batch<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_names: &[String],
        enable: bool,
    ) -> Result<Vec<(String, String)>, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &ResourceType::Mod)?;
        let mut toggled = Vec::new();
        let db = app.state::<crate::services::db::AppDatabase>();
        let pool = db.pool.clone();

        for file_name in file_names {
            let current_path = target_dir.join(file_name);
            if !current_path.exists() {
                continue;
            }

            let new_file_name = if enable {
                file_name.trim_end_matches(".disabled").to_string()
            } else if file_name.ends_with(".disabled") {
                continue;
            } else {
                format!("{}.disabled", file_name)
            };

            if fs::rename(&current_path, target_dir.join(&new_file_name)).is_ok() {
                toggled.push((file_name.clone(), new_file_name));
            }
        }

        if !toggled.is_empty() {
            crate::services::db::DbService::toggle_instance_mods_batch(
                &pool,
                instance_id,
                &toggled,
                enable,
            )
            .await
            .map_err(|error| error.to_string())?;

            use tauri::Emitter;
            let _ = app.emit(
                "instance-mods-fs-changed",
                serde_json::json!({
                    "instanceId": instance_id,
                    "action": "batch_toggle",
                    "enable": enable,
                    "toggled": toggled
                }),
            );
        }

        Ok(toggled)
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

        if res_type == ResourceType::ResourcePack || res_type == ResourceType::Shader {
            Self::remove_resource_metadata(app, instance_id, res_type, file_name)?;
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
            let db = app.state::<crate::services::db::AppDatabase>();
            let pool = db.pool.clone();
            let inst_id = instance_id.to_string();
            let f_name = file_name.to_string();
            tauri::async_runtime::spawn(async move {
                let _ = crate::services::db::DbService::delete_instance_mods(
                    &pool,
                    &inst_id,
                    &[f_name],
                )
                .await;
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

    pub async fn upsert_downloaded_mod<R: Runtime>(
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

        let db = app.state::<crate::services::db::AppDatabase>();
        let pool = db.pool.clone();
        let inst_id = instance_id.to_string();
        let f_name = file_name.to_string();
        let p_form = if platform.trim().is_empty() {
            None
        } else {
            Some(platform.trim().to_ascii_lowercase())
        };
        let p_id = if project_id.trim().is_empty() {
            None
        } else {
            Some(project_id.to_string())
        };
        let f_id = if file_id.trim().is_empty() {
            None
        } else {
            Some(file_id.to_string())
        };
        let ver = version;
        let old_f = old_file_name;
        let s_kind = source_kind.to_string();

        if let Some(old) = old_f {
            crate::services::db::DbService::delete_instance_mods(&pool, &inst_id, &[old])
                .await
                .map_err(|error| error.to_string())?;
        }
        if !target_path.is_file() {
            return Err(format!("目标模组文件不存在或下载未完成: {}", target_path.display()));
        }

        let meta = std::fs::metadata(&target_path).map_err(|e| e.to_string())?;
        let size = meta.len() as i64;
        if size <= 0 {
            return Err(format!("目标模组文件为空 (0 字节): {}", target_path.display()));
        }

        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let jar_meta = Some(
            crate::services::instance::mod_manager::jar_parser::JarParser::parse_jar_meta(
                &target_path,
            )
        );
        let cf_fp = crate::services::instance::mod_manager::remote_fetcher::RemoteFetcher::resolve_curseforge_fingerprint(None, &target_path);

        let sha1_str = if let Ok(mut file) = std::fs::File::open(&target_path) {
            use sha1::Digest;
            let mut hasher = sha1::Sha1::new();
            let mut buffer = [0u8; 64 * 1024];
            use std::io::Read;
            while let Ok(n) = file.read(&mut buffer) {
                if n == 0 {
                    break;
                }
                hasher.update(&buffer[..n]);
            }
            Some(format!("{:x}", hasher.finalize()))
        } else {
            None
        };

        let effective_mod_id = jar_meta
            .as_ref()
            .and_then(|m| m.mod_id.clone())
            .or_else(|| p_id.clone());
        let effective_version = ver.or_else(|| jar_meta.as_ref().and_then(|m| m.version.clone()));
        let effective_name = jar_meta.as_ref().and_then(|m| m.name.clone());

        let modrinth_project_id = (p_form.as_deref() == Some("modrinth"))
            .then(|| p_id.as_deref())
            .flatten();
        let curseforge_project_id = (p_form.as_deref() == Some("curseforge"))
            .then(|| p_id.as_deref())
            .flatten();
        let identity_cache_key = p_form
            .as_deref()
            .zip(p_id.as_deref())
            .map(|(platform, project_id)| format!("{platform}_{project_id}"));

        // Persist the download identity in the shared metadata cache as well as the
        // instance row. A later full JAR scan can then recover the platform even if it
        // cannot use the instance fast path.
        crate::services::instance::mod_manager::ModManagerService::save_metadata_to_cache(
            &pool,
            effective_mod_id.as_deref(),
            cf_fp,
            sha1_str.as_deref(),
            curseforge_project_id,
            modrinth_project_id,
            effective_name.as_deref(),
            None,
            "",
            p_form.as_deref(),
            identity_cache_key.as_deref(),
        )
        .await;

        let row = crate::services::db::InstanceModDbRow {
            instance_id: inst_id.clone(),
            file_name: f_name,
            is_enabled: true,
            file_size: size,
            modified_at: mtime,
            sha1: sha1_str,
            curseforge_fingerprint: cf_fp,
            mod_id: effective_mod_id,
            version: effective_version,
            source_platform: p_form.or_else(|| Some(s_kind)),
            source_project_id: p_id,
            source_file_id: f_id,
        };
        crate::services::db::DbService::upsert_instance_mods(&pool, &inst_id, &[row])
            .await
            .map_err(|error| error.to_string())?;

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
            let _ =
                crate::services::instance::binding::InstanceBindingService::write_instance_config(
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
        let db = app.state::<crate::services::db::AppDatabase>();
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
                     WHERE instance_id = ? AND file_name = ?;",
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
        items: Vec<crate::services::db::ModPlatformMatchBatchItem>,
    ) -> Result<(), String> {
        let db = app.state::<crate::services::db::AppDatabase>();
        let pool = db.pool.clone();
        let inst_id = instance_id.to_string();

        tauri::async_runtime::spawn(async move {
            let _ = crate::services::db::DbService::update_mod_platform_matches_batch(
                &pool, &inst_id, &items,
            )
            .await;
        });

        Ok(())
    }

    pub fn update_mod_metadata_settings<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        settings: crate::domain::mod_manifest::ModMetadataSettings,
    ) -> Result<(), String> {
        let manifest_path = Self::get_instance_root(app, instance_id)?.join("mod_manifest.json");
        crate::services::instance::mod_manifest::ModManifestService::update_metadata_settings(
            &manifest_path,
            file_name,
            settings,
        )
    }

    pub async fn reset_mod_platform_metadata<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
    ) -> Result<(), String> {
        let manifest_path = Self::get_instance_root(app, instance_id)?.join("mod_manifest.json");
        crate::services::instance::mod_manifest::ModManifestService::reset_platform_metadata(
            &manifest_path,
            file_name,
        )?;

        // Version-specific dependency data must not be reused after a forced identification
        // attempt. Preserve the user-confirmed provider/project link, but clear only the stale
        // archive-level identity; a successful exact match will fill these fields again.
        let db = app.state::<crate::services::db::AppDatabase>();
        sqlx::query(
            "UPDATE instance_mods \
             SET source_file_id = NULL, version = NULL, updated_at = ? \
             WHERE instance_id = ? AND file_name = ?",
        )
        .bind(chrono::Utc::now().timestamp())
        .bind(instance_id)
        .bind(file_name)
        .execute(&db.pool)
        .await
        .map_err(|error| error.to_string())?;

        // Do not delete the confirmed provider/project mapping or its icon cache here. A
        // forced archive match is stricter than a project link and may legitimately fail for
        // repacked, renamed, or provider-removed files. Cloud sync refreshes the linked project
        // separately and replaces its icon only after the provider answers successfully.
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{ResourceManager, ResourceMetadataManifest, ResourceType};

    #[test]
    fn metadata_key_is_stable_across_disabled_state_and_case() {
        assert_eq!(
            ResourceManager::metadata_key(ResourceType::ResourcePack, "Pack.ZIP.disabled"),
            ResourceManager::metadata_key(ResourceType::ResourcePack, "pack.zip")
        );
    }

    #[test]
    fn metadata_manifest_uses_current_schema_by_default() {
        let manifest = ResourceMetadataManifest::default();
        assert_eq!(manifest.schema_version, 1);
        assert!(manifest.resources.is_empty());
    }
}
