use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::{ImportResult, MissingRuntime};
use crate::services::config_service::ConfigService;
use crate::services::import_service::third_party_service::{
    read_candidate_from_dir, register_candidate_instance,
};
use crate::services::minecraft_service::detect_missing_runtime;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn copy_and_check_instance(
    src_dir: &Path,
    dest_instances_dir: &Path,
    runtime_dir: &Path,
) -> Result<Option<MissingRuntime>, String> {
    let instance_json_path = src_dir.join("instance.json");
    let content = fs::read_to_string(&instance_json_path).map_err(|error| error.to_string())?;
    let config: InstanceConfig =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;

    let dest_dir = dest_instances_dir.join(&config.id);
    if !dest_dir.exists() {
        copy_dir_all(src_dir, &dest_dir).map_err(|error| error.to_string())?;
    }

    Ok(detect_missing_runtime(
        runtime_dir,
        &config.id,
        &config.mc_version,
        &config.loader.r#type,
        &config.loader.version,
    ))
}

pub async fn import_local_instances_folders<R: Runtime>(
    app: &AppHandle<R>,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path).join("instances");
    let runtime_dir = PathBuf::from(&base_path).join("runtime");

    fs::create_dir_all(&instances_dir).map_err(|error| error.to_string())?;

    let mut added = 0;
    let mut missing = Vec::new();

    for path in paths {
        let root = PathBuf::from(path);
        if !root.exists() || !root.is_dir() {
            continue;
        }

        if root.join("instance.json").exists() {
            if let Ok(result) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
                added += 1;
                if let Some(missing_runtime) = result {
                    missing.push(missing_runtime);
                }
            }
            continue;
        }

        if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let child = entry.path();
                if !child.is_dir() || !child.join("instance.json").exists() {
                    continue;
                }

                if let Ok(result) = copy_and_check_instance(&child, &instances_dir, &runtime_dir) {
                    added += 1;
                    if let Some(missing_runtime) = result {
                        missing.push(missing_runtime);
                    }
                }
            }
        }
    }

    Ok(ImportResult { added, missing })
}

pub async fn scan_instances_in_dir<R: Runtime>(
    app: &AppHandle<R>,
    path: String,
) -> Result<ImportResult, String> {
    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err("Selected path is not a valid directory.".to_string());
    }

    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path).join("instances");
    let runtime_dir = PathBuf::from(&base_path).join("runtime");
    fs::create_dir_all(&instances_dir).map_err(|error| error.to_string())?;

    let mut added = 0;
    let mut missing = Vec::new();

    if root.join("instance.json").exists() {
        if let Ok(result) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
            added += 1;
            if let Some(missing_runtime) = result {
                missing.push(missing_runtime);
            }
        }
        return Ok(ImportResult { added, missing });
    }

    let entries = fs::read_dir(&root).map_err(|error| error.to_string())?;
    for entry in entries.flatten() {
        let child = entry.path();
        if !child.is_dir() {
            continue;
        }

        if child.join("instance.json").exists() {
            if let Ok(result) = copy_and_check_instance(&child, &instances_dir, &runtime_dir) {
                added += 1;
                if let Some(missing_runtime) = result {
                    missing.push(missing_runtime);
                }
            }
            continue;
        }

        let candidate = match read_candidate_from_dir(&child) {
            Ok(Some(candidate)) => candidate,
            _ => continue,
        };

        if instances_dir.join(&candidate.id).exists() {
            continue;
        }

        if register_candidate_instance(&candidate, &instances_dir).is_err() {
            continue;
        }

        added += 1;
        if let Some(missing_runtime) = detect_missing_runtime(
            &runtime_dir,
            &candidate.id,
            &candidate.mc_version,
            &candidate.loader_type,
            &candidate.loader_version,
        ) {
            missing.push(missing_runtime);
        }
    }

    Ok(ImportResult { added, missing })
}
