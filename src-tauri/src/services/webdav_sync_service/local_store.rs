use crate::domain::library::{FavoriteOperation, FavoriteSnapshot};
use serde_json;
use std::collections::HashMap;
use std::fs;
use tauri::{AppHandle, Runtime};

use super::models::{DeviceFile, SyncMeta};
use super::paths;
use super::util;

pub(crate) fn ensure_local_layout<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    fs::create_dir_all(paths::operations_dir(app)?).map_err(|error| error.to_string())?;
    let meta_path = paths::sync_meta_path(app)?;
    if !meta_path.exists() {
        write_sync_meta(app, &SyncMeta::default())?;
    }
    Ok(())
}

pub(crate) fn ensure_device_id<R: Runtime>(
    app: &AppHandle<R>,
    preferred_device_id: &str,
) -> Result<String, String> {
    let device_path = paths::device_path(app)?;
    if let Some(parent) = device_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    if let Ok(content) = fs::read_to_string(&device_path) {
        if let Ok(device) = serde_json::from_str::<DeviceFile>(&content) {
            if !device.device_id.trim().is_empty() {
                return Ok(device.device_id);
            }
        }
    }

    let device_id = if preferred_device_id.trim().is_empty() {
        uuid::Uuid::new_v4().to_string()
    } else {
        preferred_device_id.trim().to_string()
    };

    fs::write(
        device_path,
        serde_json::to_string_pretty(&DeviceFile {
            device_id: device_id.clone(),
        })
        .map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;

    Ok(device_id)
}

pub(crate) fn write_operation<R: Runtime>(
    app: &AppHandle<R>,
    operation: &FavoriteOperation,
) -> Result<(), String> {
    let operations_dir = paths::operations_dir(app)?;
    fs::create_dir_all(&operations_dir).map_err(|error| error.to_string())?;

    let file_path = operations_dir.join(util::operation_file_name(operation));
    fs::write(
        file_path,
        serde_json::to_string_pretty(operation).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

pub(crate) fn list_operation_files<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<String>, String> {
    let operations_dir = paths::operations_dir(app)?;
    if !operations_dir.exists() {
        return Ok(Vec::new());
    }

    let mut file_names = fs::read_dir(operations_dir)
        .map_err(|error| error.to_string())?
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| name.starts_with("op-") && name.ends_with(".json"))
        .collect::<Vec<_>>();
    file_names.sort();
    Ok(file_names)
}

pub(crate) fn load_operations<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Vec<FavoriteOperation>, String> {
    let mut by_id = HashMap::<String, FavoriteOperation>::new();
    let operations_dir = paths::operations_dir(app)?;
    if !operations_dir.exists() {
        return Ok(Vec::new());
    }

    for entry in fs::read_dir(operations_dir).map_err(|error| error.to_string())? {
        let path = match entry {
            Ok(entry) => entry.path(),
            Err(_) => continue,
        };

        if path.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }

        let operation = match fs::read_to_string(&path)
            .ok()
            .and_then(|content| serde_json::from_str::<FavoriteOperation>(&content).ok())
        {
            Some(operation) => operation,
            None => continue,
        };

        if operation.op_id.trim().is_empty() || operation.target_id.trim().is_empty() {
            continue;
        }

        by_id.entry(operation.op_id.clone()).or_insert(operation);
    }

    let mut operations = by_id.into_values().collect::<Vec<_>>();
    operations.sort_by(|left, right| {
        left.timestamp
            .cmp(&right.timestamp)
            .then_with(|| left.op_id.cmp(&right.op_id))
    });
    Ok(operations)
}

pub(crate) fn read_snapshot<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<Option<FavoriteSnapshot>, String> {
    let snapshot_path = paths::snapshot_path(app)?;
    if !snapshot_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(snapshot_path).map_err(|error| error.to_string())?;
    serde_json::from_str::<FavoriteSnapshot>(&content)
        .map(Some)
        .map_err(|error| format!("invalid local favorite snapshot: {error}"))
}

pub(crate) fn write_snapshot<R: Runtime>(
    app: &AppHandle<R>,
    snapshot: &FavoriteSnapshot,
) -> Result<(), String> {
    let snapshot_path = paths::snapshot_path(app)?;
    if let Some(parent) = snapshot_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    fs::write(
        snapshot_path,
        serde_json::to_string_pretty(snapshot).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}

pub(crate) fn read_sync_meta<R: Runtime>(app: &AppHandle<R>) -> Result<SyncMeta, String> {
    let meta_path = paths::sync_meta_path(app)?;
    if !meta_path.exists() {
        return Ok(SyncMeta::default());
    }

    let content = fs::read_to_string(meta_path).map_err(|error| error.to_string())?;
    serde_json::from_str::<SyncMeta>(&content)
        .map_err(|error| format!("invalid sync meta document: {error}"))
}

pub(crate) fn write_sync_meta<R: Runtime>(
    app: &AppHandle<R>,
    sync_meta: &SyncMeta,
) -> Result<(), String> {
    let meta_path = paths::sync_meta_path(app)?;
    if let Some(parent) = meta_path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    fs::write(
        meta_path,
        serde_json::to_string_pretty(sync_meta).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())
}
