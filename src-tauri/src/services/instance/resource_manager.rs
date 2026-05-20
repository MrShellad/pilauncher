use crate::services::config_service::ConfigService;
use crate::services::instance::mod_manifest_service::ModManifestService;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    pub id: String,
    pub timestamp: String,
    pub item_count: usize,
    pub description: String,
}

pub struct ResourceManager;

impl ResourceManager {
    fn get_instance_root<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "Base path is not configured".to_string())?;

        Ok(PathBuf::from(base_path).join("instances").join(instance_id))
    }

    fn get_game_dir<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<PathBuf, String> {
        let instance_root = Self::get_instance_root(app, instance_id)?;
        let mut target_dir = instance_root.clone();
        let json_path = instance_root.join("instance.json");
        if let Ok(content) = fs::read_to_string(&json_path) {
            if let Ok(config) =
                serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
            {
                if let Some(tp) = config.third_party_path {
                    target_dir = PathBuf::from(tp);
                }
            }
        }
        Ok(target_dir)
    }

    fn get_target_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: &ResourceType,
    ) -> Result<PathBuf, String> {
        let target_dir = Self::get_game_dir(app, instance_id)?.join(res_type.folder_name());
        if !target_dir.exists() {
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        }
        Ok(target_dir)
    }

    pub fn list_resources<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
    ) -> Result<Vec<ResourceItem>, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let mut items = Vec::new();

        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.filter_map(|value| value.ok()) {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') {
                    continue;
                }

                let metadata = entry.metadata().map_err(|e| e.to_string())?;
                items.push(ResourceItem {
                    file_name: file_name.clone(),
                    is_enabled: !file_name.ends_with(".disabled"),
                    is_directory: metadata.is_dir(),
                    file_size: metadata.len(),
                    modified_at: metadata
                        .modified()
                        .map_err(|e| e.to_string())?
                        .duration_since(std::time::UNIX_EPOCH)
                        .map_err(|e| e.to_string())?
                        .as_secs() as i64,
                    icon_absolute_path: None,
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

        fs::rename(current_path, target_dir.join(new_file_name)).map_err(|e| e.to_string())
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

        if res_type == ResourceType::Mod {
            let manifest_path =
                Self::get_instance_root(app, instance_id)?.join("mod_manifest.json");
            if manifest_path.exists() {
                if let Ok(content) = fs::read_to_string(&manifest_path) {
                    if let Ok(mut manifest) =
                        serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
                    {
                        let base_name = file_name.trim_end_matches(".disabled");
                        if manifest.remove(base_name).is_some() {
                            let payload = serde_json::to_string_pretty(&manifest)
                                .map_err(|e| e.to_string())?;
                            fs::write(&manifest_path, payload).map_err(|e| e.to_string())?;
                        }
                    }
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

        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
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
            timestamp: Local::now().to_rfc3339(),
            item_count,
            description: desc.to_string(),
        })
    }

    pub fn update_mod_manifest<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        source_kind: &str,
        platform: &str,
        project_id: &str,
        file_id: &str,
    ) -> Result<(), String> {
        let instance_root = Self::get_instance_root(app, instance_id)?;
        let manifest_path = instance_root.join("mod_manifest.json");
        let target_path = Self::get_game_dir(app, instance_id)?
            .join("mods")
            .join(file_name);

        ModManifestService::upsert_downloaded_mod(
            &manifest_path,
            &target_path,
            crate::domain::mod_manifest::ModSourceKind::from_input(source_kind),
            if platform.trim().is_empty() {
                None
            } else {
                Some(platform.to_string())
            },
            if project_id.trim().is_empty() {
                None
            } else {
                Some(project_id.to_string())
            },
            if file_id.trim().is_empty() {
                None
            } else {
                Some(file_id.to_string())
            },
        )
    }
}
