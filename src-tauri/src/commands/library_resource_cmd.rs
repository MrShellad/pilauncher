// src-tauri/src/commands/library_resource_cmd.rs
use crate::domain::library::StarredItem;
use crate::services::config_service::ConfigService;
use crate::services::db_service::AppDatabase;
use sqlx::Row;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime, State};

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> Result<(), String> {
    let src = src.as_ref();
    let dst = dst.as_ref();
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;
    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let ty = entry.file_type().map_err(|e| e.to_string())?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name())).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn create_junction(src: &Path, dst: &Path) -> std::io::Result<()> {
    let output = std::process::Command::new("cmd")
        .args(&[
            "/c",
            "mklink",
            "/j",
            dst.to_str().ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid destination path")
            })?,
            src.to_str().ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::InvalidInput, "Invalid source path")
            })?,
        ])
        .output()?;
    if output.status.success() {
        Ok(())
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        Err(std::io::Error::new(std::io::ErrorKind::Other, err_msg))
    }
}

fn create_resource_link(src: &Path, dst: &Path) -> Result<(), String> {
    if dst.exists() {
        if dst.is_dir() {
            fs::remove_dir_all(dst)
                .map_err(|e| format!("Failed to remove existing destination directory: {}", e))?;
        } else {
            fs::remove_file(dst)
                .map_err(|e| format!("Failed to remove existing destination file: {}", e))?;
        }
    }

    if src.is_dir() {
        #[cfg(target_os = "windows")]
        {
            // Prioritize directory junction on Windows as it doesn't require admin/dev mode and works across drives.
            if create_junction(src, dst).is_ok() {
                return Ok(());
            }
            if std::os::windows::fs::symlink_dir(src, dst).is_ok() {
                return Ok(());
            }
            copy_dir_all(src, dst)?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            if std::os::unix::fs::symlink(src, dst).is_ok() {
                return Ok(());
            }
            copy_dir_all(src, dst)?;
        }
    } else {
        #[cfg(target_os = "windows")]
        {
            // Windows file symlinks are not recognized by Minecraft/Java.
            // We prioritize hard links, and fall back to copying the file if hard link fails (e.g., across drives).
            if fs::hard_link(src, dst).is_ok() {
                return Ok(());
            }
            fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;
        }
        #[cfg(not(target_os = "windows"))]
        {
            if std::os::unix::fs::symlink(src, dst).is_ok() {
                return Ok(());
            }
            if fs::hard_link(src, dst).is_ok() {
                return Ok(());
            }
            fs::copy(src, dst).map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }
    Ok(())
}

fn safe_remove_link(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Ok(());
    }

    let meta = fs::symlink_metadata(path).map_err(|e| e.to_string())?;
    let file_type = meta.file_type();

    if file_type.is_symlink() {
        #[cfg(target_os = "windows")]
        {
            if path.is_dir() {
                fs::remove_dir(path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(path).map_err(|e| e.to_string())?;
            }
        }
        #[cfg(not(target_os = "windows"))]
        {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    } else if path.is_dir() {
        fs::remove_dir_all(path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_game_dir<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<PathBuf, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;

    let instance_root = PathBuf::from(base_path).join("instances").join(instance_id);
    let mut target_dir = instance_root.clone();
    let json_path = instance_root.join("instance.json");
    if let Ok(content) = fs::read_to_string(&json_path) {
        if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(tp) = config.get("thirdPartyPath").and_then(|v| v.as_str()) {
                if !tp.is_empty() {
                    target_dir = PathBuf::from(tp);
                }
            }
        }
    }
    Ok(target_dir)
}

#[tauri::command]
pub async fn import_local_resource_to_library<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    res_type: String,
    local_path: String,
    starred_item: StarredItem,
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let folder = match res_type.as_str() {
        "shader" => "shaders",
        "resourcepack" => "resourcepacks",
        _ => return Err(format!("Unsupported resource type: {}", res_type)),
    };
    let target_dir = PathBuf::from(&base_path)
        .join("shared_mods")
        .join("library")
        .join(folder);
    fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

    let src_path = Path::new(&local_path);
    if !src_path.exists() {
        return Err("Source file/folder does not exist".to_string());
    }

    let file_name = src_path
        .file_name()
        .ok_or_else(|| "Invalid source file name".to_string())?
        .to_string_lossy()
        .to_string();

    let target_path = target_dir.join(&file_name);

    if src_path.is_dir() {
        if target_path.exists() {
            fs::remove_dir_all(&target_path).map_err(|e| e.to_string())?;
        }
        copy_dir_all(src_path, &target_path)?;
    } else {
        if target_path.exists() {
            fs::remove_file(&target_path).map_err(|e| e.to_string())?;
        }
        fs::copy(src_path, &target_path).map_err(|e| e.to_string())?;
    }

    crate::services::library_service::LibraryService::save_starred_item(&db.pool, &starred_item)
        .await
        .map_err(|e| format!("Failed to save starred item: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_library_resource_mappings(
    db: State<'_, AppDatabase>,
    resource_id: String,
) -> Result<Vec<String>, String> {
    let rows =
        sqlx::query("SELECT instance_id FROM library_resource_mappings WHERE resource_id = ?")
            .bind(&resource_id)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| e.to_string())?;

    let instance_ids = rows
        .into_iter()
        .map(|row| row.get::<String, _>("instance_id"))
        .collect();
    Ok(instance_ids)
}

#[tauri::command]
pub async fn link_library_resource_to_instances<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    resource_id: String,
    instance_ids: Vec<String>,
) -> Result<(), String> {
    let starred_items =
        crate::services::library_service::LibraryService::get_starred_items(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
    let item = starred_items
        .into_iter()
        .find(|i| i.id == resource_id)
        .ok_or_else(|| "Resource not found in library".to_string())?;

    let res_type = item.r#type.clone();
    let folder = match res_type.as_str() {
        "shader" => "shaders",
        "resourcepack" => "resourcepacks",
        _ => return Err(format!("Unsupported type: {}", res_type)),
    };

    let snapshot_value: serde_json::Value = serde_json::from_str(&item.snapshot)
        .map_err(|e| format!("Invalid snapshot format: {}", e))?;

    let filename = snapshot_value
        .get("fileName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Filename not found in resource metadata".to_string())?;

    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let src_path = PathBuf::from(&base_path)
        .join("shared_mods")
        .join("library")
        .join(&folder)
        .join(&filename);

    if !src_path.exists() {
        return Err(format!("Library file does not exist: {:?}", src_path));
    }

    let existing_instance_ids =
        get_library_resource_mappings(db.clone(), resource_id.clone()).await?;

    let checked_set: std::collections::HashSet<String> = instance_ids.iter().cloned().collect();
    let existing_set: std::collections::HashSet<String> =
        existing_instance_ids.iter().cloned().collect();

    for inst_id in &existing_set {
        if !checked_set.contains(inst_id) {
            let instance_dir = get_game_dir(&app, inst_id)?;
            let dest_folder = match res_type.as_str() {
                "shader" => "shaderpacks",
                "resourcepack" => "resourcepacks",
                _ => return Err("Invalid type".to_string()),
            };
            let dest_path = instance_dir.join(dest_folder).join(&filename);

            safe_remove_link(&dest_path)?;

            sqlx::query(
                "DELETE FROM library_resource_mappings WHERE resource_id = ? AND instance_id = ?",
            )
            .bind(&resource_id)
            .bind(inst_id)
            .execute(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    for inst_id in &checked_set {
        if !existing_set.contains(inst_id) {
            let instance_dir = get_game_dir(&app, inst_id)?;
            let dest_folder = match res_type.as_str() {
                "shader" => "shaderpacks",
                "resourcepack" => "resourcepacks",
                _ => return Err("Invalid type".to_string()),
            };
            let dest_dir = instance_dir.join(dest_folder);
            fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
            let dest_path = dest_dir.join(&filename);

            create_resource_link(&src_path, &dest_path)?;

            let mapping_id = format!("{}:{}", resource_id, inst_id);
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;

            sqlx::query(
                "INSERT INTO library_resource_mappings (id, resource_id, instance_id, resource_type, target_filename, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)"
            )
            .bind(&mapping_id)
            .bind(&resource_id)
            .bind(inst_id)
            .bind(&res_type)
            .bind(&filename)
            .bind(now)
            .execute(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn update_library_resource_file<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    resource_id: String,
    new_local_path: String,
    new_filename: String,
    new_snapshot_json: String,
) -> Result<(), String> {
    let starred_items =
        crate::services::library_service::LibraryService::get_starred_items(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
    let mut item = starred_items
        .into_iter()
        .find(|i| i.id == resource_id)
        .ok_or_else(|| "Resource not found".to_string())?;

    let res_type = item.r#type.clone();
    let folder = match res_type.as_str() {
        "shader" => "shaders",
        "resourcepack" => "resourcepacks",
        _ => return Err("Invalid type".to_string()),
    };

    let snapshot_value: serde_json::Value =
        serde_json::from_str(&item.snapshot).map_err(|e| e.to_string())?;
    let old_filename = snapshot_value
        .get("fileName")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Old filename not found in snapshot".to_string())?;

    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let old_library_path = PathBuf::from(&base_path)
        .join("shared_mods")
        .join("library")
        .join(&folder)
        .join(old_filename);

    let new_library_path = PathBuf::from(&base_path)
        .join("shared_mods")
        .join("library")
        .join(&folder)
        .join(&new_filename);

    if old_library_path.exists() {
        if old_library_path.is_dir() {
            fs::remove_dir_all(&old_library_path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(&old_library_path).map_err(|e| e.to_string())?;
        }
    }

    let src_path = Path::new(&new_local_path);
    if !src_path.exists() {
        return Err("New local path does not exist".to_string());
    }

    if src_path.is_dir() {
        if new_library_path.exists() {
            fs::remove_dir_all(&new_library_path).map_err(|e| e.to_string())?;
        }
        copy_dir_all(src_path, &new_library_path)?;
    } else {
        if new_library_path.exists() {
            fs::remove_file(&new_library_path).map_err(|e| e.to_string())?;
        }
        fs::copy(src_path, &new_library_path).map_err(|e| e.to_string())?;
    }

    let rows =
        sqlx::query("SELECT instance_id FROM library_resource_mappings WHERE resource_id = ?")
            .bind(&resource_id)
            .fetch_all(&db.pool)
            .await
            .map_err(|e| e.to_string())?;

    let mapped_instances: Vec<String> = rows
        .into_iter()
        .map(|row| row.get::<String, _>("instance_id"))
        .collect();

    let dest_folder = match res_type.as_str() {
        "shader" => "shaderpacks",
        "resourcepack" => "resourcepacks",
        _ => return Err("Invalid type".to_string()),
    };

    for inst_id in &mapped_instances {
        let instance_dir = get_game_dir(&app, inst_id)?;

        let old_dest_path = instance_dir.join(dest_folder).join(old_filename);
        if old_dest_path.exists() {
            safe_remove_link(&old_dest_path)?;
        }

        let new_dest_path = instance_dir.join(dest_folder).join(&new_filename);
        create_resource_link(&new_library_path, &new_dest_path)?;

        sqlx::query(
            "UPDATE library_resource_mappings SET target_filename = ? WHERE resource_id = ? AND instance_id = ?"
        )
        .bind(&new_filename)
        .bind(&resource_id)
        .bind(inst_id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;
    }

    item.snapshot = new_snapshot_json;
    item.updated_at = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    crate::services::library_service::LibraryService::save_starred_item(&db.pool, &item)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn delete_library_resource<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    resource_id: String,
) -> Result<(), String> {
    let starred_items =
        crate::services::library_service::LibraryService::get_starred_items(&db.pool)
            .await
            .map_err(|e| e.to_string())?;
    let item = starred_items
        .into_iter()
        .find(|i| i.id == resource_id)
        .ok_or_else(|| "Resource not found".to_string())?;

    let res_type = item.r#type.clone();
    let folder = match res_type.as_str() {
        "shader" => "shaders",
        "resourcepack" => "resourcepacks",
        _ => return Err("Invalid type".to_string()),
    };

    let snapshot_value: serde_json::Value =
        serde_json::from_str(&item.snapshot).map_err(|e| e.to_string())?;
    let filename = snapshot_value
        .get("fileName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    if let Some(filename) = filename {
        let rows =
            sqlx::query("SELECT instance_id FROM library_resource_mappings WHERE resource_id = ?")
                .bind(&resource_id)
                .fetch_all(&db.pool)
                .await
                .map_err(|e| e.to_string())?;

        let mapped_instances: Vec<String> = rows
            .into_iter()
            .map(|row| row.get::<String, _>("instance_id"))
            .collect();

        let dest_folder = match res_type.as_str() {
            "shader" => "shaderpacks",
            "resourcepack" => "resourcepacks",
            _ => return Err("Invalid type".to_string()),
        };

        for inst_id in &mapped_instances {
            let instance_dir = get_game_dir(&app, inst_id)?;
            let dest_path = instance_dir.join(dest_folder).join(&filename);
            if dest_path.exists() {
                safe_remove_link(&dest_path)?;
            }
        }

        let base_path = ConfigService::get_base_path(&app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        let library_path = PathBuf::from(&base_path)
            .join("shared_mods")
            .join("library")
            .join(&folder)
            .join(&filename);

        if library_path.exists() {
            if library_path.is_dir() {
                fs::remove_dir_all(&library_path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(&library_path).map_err(|e| e.to_string())?;
            }
        }
    }

    sqlx::query("DELETE FROM library_resource_mappings WHERE resource_id = ?")
        .bind(&resource_id)
        .execute(&db.pool)
        .await
        .map_err(|e| e.to_string())?;

    crate::services::library_service::LibraryService::remove_starred_item(&db.pool, &resource_id)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}
