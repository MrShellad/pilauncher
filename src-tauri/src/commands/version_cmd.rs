// src-tauri/src/commands/version_cmd.rs

use crate::error::AppResult;
use crate::services::db_service::AppDatabase;
use serde::Serialize;
use sqlx::Row;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime, State};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssociatedInstanceInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalVersionItem {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader_type: String,
    pub loader_version: String,
    pub size_bytes: u64,
    pub associated_instances: Vec<AssociatedInstanceInfo>,
}

fn get_dir_size(path: &Path) -> u64 {
    let mut size = 0;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if let Ok(metadata) = entry.metadata() {
                    size += metadata.len();
                }
            } else if path.is_dir() {
                size += get_dir_size(&path);
            }
        }
    }
    size
}

struct DbInstance {
    id: String,
    name: String,
    mc_version: String,
    loader_type: String,
    loader_version: String,
}

#[tauri::command]
pub async fn get_local_versions<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
) -> AppResult<Vec<LocalVersionItem>> {
    let base_path = match crate::services::config_service::ConfigService::get_base_path(&app) {
        Ok(Some(p)) => p,
        _ => return Ok(Vec::new()),
    };

    let versions_dir = PathBuf::from(base_path).join("runtime").join("versions");
    if !versions_dir.exists() {
        return Ok(Vec::new());
    }

    // Query all instances from db
    let rows =
        sqlx::query("SELECT id, name, mc_version, loader_type, loader_version FROM instances")
            .fetch_all(&db.pool)
            .await?;

    let db_instances: Vec<DbInstance> = rows
        .into_iter()
        .map(|row| DbInstance {
            id: row.get("id"),
            name: row.get("name"),
            mc_version: row.get("mc_version"),
            loader_type: row
                .try_get::<Option<String>, _>("loader_type")
                .ok()
                .flatten()
                .unwrap_or_else(|| "vanilla".to_string()),
            loader_version: row
                .try_get::<Option<String>, _>("loader_version")
                .ok()
                .flatten()
                .unwrap_or_default(),
        })
        .collect();

    let mut local_versions = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&versions_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let id = match path.file_name().and_then(|n| n.to_str()) {
                Some(name) if !name.is_empty() => name.to_string(),
                _ => continue,
            };

            let json_path = path.join(format!("{}.json", id));
            let mut json_val = serde_json::Value::Null;
            if json_path.exists() {
                if let Ok(content) = std::fs::read_to_string(&json_path) {
                    if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&content) {
                        json_val = parsed;
                    }
                }
            }

            let (mc_version, loader_type, loader_version) =
                crate::services::minecraft_service::parse_third_party_json(&id, &json_val);

            let loader_type_lower = loader_type.to_lowercase();
            let display_name = if loader_type == "vanilla" {
                id.clone()
            } else {
                let type_formatted = match loader_type_lower.as_str() {
                    "fabric" => "Fabric",
                    "forge" => "Forge",
                    "neoforge" => "NeoForge",
                    "quilt" => "Quilt",
                    other => other,
                };
                format!("{} {} ({})", type_formatted, loader_version, mc_version)
            };

            let size_bytes = get_dir_size(&path);

            let mut associated_instances = Vec::new();
            for inst in &db_instances {
                let matches = if loader_type == "vanilla" {
                    inst.mc_version == mc_version
                } else {
                    if let Some(folder_name) =
                        crate::services::minecraft_service::resolve_loader_folder(
                            &inst.loader_type,
                            &inst.mc_version,
                            &inst.loader_version,
                        )
                    {
                        folder_name == id
                    } else {
                        false
                    }
                };

                if matches {
                    associated_instances.push(AssociatedInstanceInfo {
                        id: inst.id.clone(),
                        name: inst.name.clone(),
                    });
                }
            }

            local_versions.push(LocalVersionItem {
                id,
                name: display_name,
                mc_version,
                loader_type,
                loader_version,
                size_bytes,
                associated_instances,
            });
        }
    }

    Ok(local_versions)
}

#[tauri::command]
pub async fn delete_local_version<R: Runtime>(app: AppHandle<R>, id: String) -> AppResult<()> {
    // Security check: ensure id is a valid directory name and not a path traversal
    let path_id = Path::new(&id);
    if path_id.components().count() != 1 {
        return Err(crate::error::AppError::Generic(
            "Invalid version ID".to_string(),
        ));
    }

    let base_path = match crate::services::config_service::ConfigService::get_base_path(&app) {
        Ok(Some(p)) => p,
        _ => {
            return Err(crate::error::AppError::Generic(
                "Base directory not configured".to_string(),
            ))
        }
    };

    let version_dir = PathBuf::from(base_path)
        .join("runtime")
        .join("versions")
        .join(&id);

    if version_dir.exists() {
        std::fs::remove_dir_all(&version_dir)?;
    }

    Ok(())
}
