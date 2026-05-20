use crate::services::config_service::ConfigService;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub(crate) fn sync_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "base path is not configured".to_string())?;
    Ok(PathBuf::from(base_path).join("userdata").join("sync"))
}

pub(crate) fn device_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(sync_root(app)?.join("device.json"))
}

pub(crate) fn sync_meta_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(sync_root(app)?.join("sync-meta.json"))
}

pub(crate) fn favorites_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(sync_root(app)?.join("favorites"))
}

pub(crate) fn operations_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(favorites_root(app)?.join("operations"))
}

pub(crate) fn snapshot_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(favorites_root(app)?.join("snapshot.json"))
}
