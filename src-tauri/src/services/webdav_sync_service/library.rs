use crate::domain::library::WebDavSyncConfig;
use crate::services::config_service::ConfigService;
use crate::services::library_service::LibraryService;
use regex::Regex;
use reqwest::{Client, Method, StatusCode};
use sqlx::SqlitePool;
use std::collections::HashSet;
use std::fs::{self, File};
use std::io::{Cursor, Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use super::constants::{LIBRARY_DIR, LIBRARY_RESOURCEPACKS_DIR, LIBRARY_SHADERS_DIR};
use super::{paths, remote};

pub(crate) async fn list_files_in_dir(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_dir: &str,
) -> Result<Vec<String>, String> {
    let method = Method::from_bytes(b"PROPFIND")
        .map_err(|error| format!("invalid PROPFIND method: {error}"))?;
    let response = remote::authorized_request(client, config, method, remote_dir)
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| format!("failed to list WebDAV files in {remote_dir}: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(Vec::new());
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to list WebDAV files in {remote_dir}: HTTP {}",
            response.status()
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read WebDAV files listing: {error}"))?;
    let href_pattern = Regex::new(r"(?i)<(?:[a-z0-9]+:)?href>([^<]+)</(?:[a-z0-9]+:)?href>")
        .map_err(|error| error.to_string())?;

    let mut file_names = Vec::new();
    for captures in href_pattern.captures_iter(&body) {
        if let Some(val) = captures.get(1) {
            if let Ok(decoded) = urlencoding::decode(val.as_str()) {
                let trimmed = decoded.trim_end_matches('/');
                if trimmed.ends_with(remote_dir) {
                    continue;
                }
                if let Some(segment) = trimmed.rsplit('/').next() {
                    if !segment.is_empty() {
                        file_names.push(segment.to_string());
                    }
                }
            }
        }
    }
    file_names.sort();
    file_names.dedup();
    Ok(file_names)
}

fn zip_dir(src_dir: &Path, dst_zip: &Path) -> Result<(), String> {
    let file = File::create(dst_zip).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut entries = WalkDir::new(src_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.path().cmp(right.path()));

    for entry in entries {
        let path = entry.path();
        let relative_path = match path.strip_prefix(src_dir) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let archive_name = relative_path.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            zip.add_directory(format!("{}/", archive_name.trim_end_matches('/')), options)
                .map_err(|error| error.to_string())?;
            continue;
        }

        zip.start_file(&archive_name, options)
            .map_err(|error| error.to_string())?;
        let mut source = File::open(path).map_err(|error| error.to_string())?;
        let mut buffer = Vec::new();
        source
            .read_to_end(&mut buffer)
            .map_err(|error| error.to_string())?;
        zip.write_all(&buffer).map_err(|error| error.to_string())?;
    }

    zip.finish().map_err(|error| error.to_string())?;
    Ok(())
}

fn unzip_dir(src_bytes: &[u8], dst_dir: &Path) -> Result<(), String> {
    if dst_dir.exists() {
        fs::remove_dir_all(dst_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(dst_dir).map_err(|error| error.to_string())?;

    let mut archive = ZipArchive::new(Cursor::new(src_bytes)).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let enclosed_name = entry
            .enclosed_name()
            .ok_or_else(|| "library zip archive contains an invalid path".to_string())?
            .to_path_buf();
        let target = dst_dir.join(enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|error| error.to_string())?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let mut file = File::create(&target).map_err(|error| error.to_string())?;
            let mut buffer = Vec::new();
            entry
                .read_to_end(&mut buffer)
                .map_err(|error| error.to_string())?;
            file.write_all(&buffer).map_err(|error| error.to_string())?;
        }
    }
    Ok(())
}

fn scan_local_dir_names(dir: &Path) -> Result<Vec<String>, String> {
    if !dir.exists() {
        return Ok(Vec::new());
    }
    let mut names = Vec::new();
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            if let Ok(name) = entry.file_name().into_string() {
                names.push(name);
            }
        }
    }
    Ok(names)
}

pub(crate) async fn sync_library_files<R: Runtime>(
    app: &AppHandle<R>,
    pool: &SqlitePool,
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<(), String> {
    // 1. Ensure remote layouts
    remote::ensure_collection(client, config, LIBRARY_DIR).await?;
    remote::ensure_collection(client, config, LIBRARY_SHADERS_DIR).await?;
    remote::ensure_collection(client, config, LIBRARY_RESOURCEPACKS_DIR).await?;

    // 2. Fetch active starred items from DB
    let starred_items = LibraryService::get_starred_items(pool)
        .await
        .map_err(|e| format!("failed to query starred items: {e}"))?;

    let mut active_shaders = HashSet::new();
    let mut active_resourcepacks = HashSet::new();

    for item in &starred_items {
        if item.source == "custom" {
            if let Ok(snapshot_val) = serde_json::from_str::<serde_json::Value>(&item.snapshot) {
                if let Some(file_name) = snapshot_val.get("fileName").and_then(|v| v.as_str()) {
                    if item.r#type == "shader" {
                        active_shaders.insert(file_name.to_string());
                    } else if item.r#type == "resourcepack" {
                        active_resourcepacks.insert(file_name.to_string());
                    }
                }
            }
        }
    }

    // 3. Resolve local directories
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "base path is not configured".to_string())?;
    let library_base = PathBuf::from(&base_path)
        .join("shared_mods")
        .join("library");
    let local_shaders_dir = library_base.join("shaders");
    let local_resourcepacks_dir = library_base.join("resourcepacks");

    fs::create_dir_all(&local_shaders_dir).map_err(|e| e.to_string())?;
    fs::create_dir_all(&local_resourcepacks_dir).map_err(|e| e.to_string())?;

    // 4. Fetch WebDAV remote files
    let remote_shaders = list_files_in_dir(client, config, LIBRARY_SHADERS_DIR).await?;
    let remote_resourcepacks = list_files_in_dir(client, config, LIBRARY_RESOURCEPACKS_DIR).await?;

    let remote_shaders_set: HashSet<String> = remote_shaders.into_iter().collect();
    let remote_resourcepacks_set: HashSet<String> = remote_resourcepacks.into_iter().collect();

    // 5. Scan local files/folders
    let local_shaders = scan_local_dir_names(&local_shaders_dir)?;
    let local_resourcepacks = scan_local_dir_names(&local_resourcepacks_dir)?;

    let local_shaders_set: HashSet<String> = local_shaders.into_iter().collect();
    let local_resourcepacks_set: HashSet<String> = local_resourcepacks.into_iter().collect();

    // 6. Perform dual-sync for Shaders
    sync_folder_files(
        app,
        client,
        config,
        &local_shaders_dir,
        LIBRARY_SHADERS_DIR,
        &active_shaders,
        &local_shaders_set,
        &remote_shaders_set,
    )
    .await?;

    // 7. Perform dual-sync for Resource Packs
    sync_folder_files(
        app,
        client,
        config,
        &local_resourcepacks_dir,
        LIBRARY_RESOURCEPACKS_DIR,
        &active_resourcepacks,
        &local_resourcepacks_set,
        &remote_resourcepacks_set,
    )
    .await?;

    Ok(())
}

async fn sync_folder_files<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    config: &WebDavSyncConfig,
    local_dir: &Path,
    remote_dir: &str,
    active_set: &HashSet<String>,
    local_set: &HashSet<String>,
    remote_set: &HashSet<String>,
) -> Result<(), String> {
    // A. For each active custom item, sync upload or download
    for file_name in active_set {
        let local_path = local_dir.join(file_name);
        let remote_path = format!("{remote_dir}/{file_name}");

        let has_local = local_set.contains(file_name);
        let has_remote = remote_set.contains(file_name);

        if has_local && !has_remote {
            // Upload to remote
            log::info!(
                "WebDAV library sync: Uploading {} to {}",
                file_name,
                remote_path
            );
            let bytes_to_upload = if local_path.is_dir() {
                // Zip it first into a temp file
                let temp_zip =
                    paths::sync_root(app)?.join(format!("lib-upload-{}.zip", uuid::Uuid::new_v4()));
                zip_dir(&local_path, &temp_zip)?;
                let data = fs::read(&temp_zip).map_err(|e| e.to_string())?;
                let _ = fs::remove_file(&temp_zip); // Clean up immediately
                data
            } else {
                fs::read(&local_path).map_err(|e| e.to_string())?
            };

            let response = remote::authorized_request(client, config, Method::PUT, &remote_path)
                .header(reqwest::header::CONTENT_TYPE, "application/octet-stream")
                .body(bytes_to_upload)
                .send()
                .await
                .map_err(|e| format!("failed to upload {file_name}: {e}"))?;

            if !response.status().is_success() {
                return Err(format!(
                    "failed to upload {file_name}: HTTP {}",
                    response.status()
                ));
            }
        } else if !has_local && has_remote {
            // Download from remote
            log::info!(
                "WebDAV library sync: Downloading {} from {}",
                file_name,
                remote_path
            );
            let response = remote::authorized_request(client, config, Method::GET, &remote_path)
                .send()
                .await
                .map_err(|e| format!("failed to download {file_name}: {e}"))?;

            if !response.status().is_success() {
                return Err(format!(
                    "failed to download {file_name}: HTTP {}",
                    response.status()
                ));
            }

            let bytes = response
                .bytes()
                .await
                .map_err(|e| format!("failed to read downloaded bytes for {file_name}: {e}"))?
                .to_vec();

            // Determine if directory or file based on filename ending with .zip
            let is_zip_file = file_name.to_lowercase().ends_with(".zip");
            if is_zip_file {
                // Write as a normal file
                if let Some(parent) = local_path.parent() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                fs::write(&local_path, bytes).map_err(|e| e.to_string())?;
            } else {
                // Restore as folder using unzip
                unzip_dir(&bytes, &local_path)?;
            }
        }
    }

    // B. Clean up local files/folders that are no longer starred (deleted on other device)
    for file_name in local_set {
        if !active_set.contains(file_name) {
            let local_path = local_dir.join(file_name);
            log::info!(
                "WebDAV library sync: Cleaning up local path {:?}",
                local_path
            );
            if local_path.is_dir() {
                let _ = fs::remove_dir_all(&local_path);
            } else {
                let _ = fs::remove_file(&local_path);
            }
        }
    }

    // C. Clean up remote files on WebDAV that are no longer starred anywhere
    for file_name in remote_set {
        if !active_set.contains(file_name) {
            let remote_path = format!("{remote_dir}/{file_name}");
            log::info!(
                "WebDAV library sync: Cleaning up remote WebDAV path {}",
                remote_path
            );
            let response = remote::authorized_request(client, config, Method::DELETE, &remote_path)
                .send()
                .await
                .map_err(|e| format!("failed to delete remote file {remote_path}: {e}"))?;

            if response.status() != StatusCode::NOT_FOUND && !response.status().is_success() {
                return Err(format!(
                    "failed to delete remote file {file_name}: HTTP {}",
                    response.status()
                ));
            }
        }
    }

    Ok(())
}
