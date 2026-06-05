use crate::domain::library::WebDavSyncConfig;
use crate::services::config_service::ConfigService;
use reqwest::{Client, Method};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

use super::constants::{KEYBOARD_DIR, KEYBOARD_USER_DIR};
use super::remote;

pub(crate) async fn sync_keyboard_profiles<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<(), String> {
    // 1. Ensure remote collections exist
    remote::ensure_collection(client, config, KEYBOARD_DIR).await?;
    remote::ensure_collection(client, config, KEYBOARD_USER_DIR).await?;

    // 2. Resolve local user keymap profiles directory
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "base path is not configured".to_string())?;
    let local_dir = PathBuf::from(&base_path)
        .join("config")
        .join("keyboard")
        .join("user");

    // 3. Ensure local directory exists
    if !local_dir.exists() {
        fs::create_dir_all(&local_dir).map_err(|e| format!("failed to create local keyboard directory: {}", e))?;
    }

    // 4. Scan local profiles
    let mut local_files = Vec::new();
    let entries = fs::read_dir(&local_dir).map_err(|e| format!("failed to read local keyboard directory: {}", e))?;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("json") {
            if let Some(name) = path.file_name().and_then(|s| s.to_str()) {
                local_files.push(name.to_string());
            }
        }
    }

    // 5. Scan remote profiles
    let remote_files = match super::library::list_files_in_dir(client, config, KEYBOARD_USER_DIR).await {
        Ok(files) => files,
        Err(err) => {
            log::warn!("Failed to list remote keyboard profiles: {}", err);
            Vec::new()
        }
    };
    let remote_files: Vec<String> = remote_files
        .into_iter()
        .filter(|name| name.ends_with(".json"))
        .collect();

    // 6. Gather all unique profiles to sync
    let mut all_files = HashSet::new();
    for f in &local_files {
        all_files.insert(f.clone());
    }
    for f in &remote_files {
        all_files.insert(f.clone());
    }

    // 7. Perform bi-directional sync with conflict resolution based on updatedAt
    for file_name in all_files {
        let local_path = local_dir.join(&file_name);
        let remote_path = format!("{}/{}", KEYBOARD_USER_DIR, file_name);

        let has_local = local_path.exists();
        let has_remote = remote_files.contains(&file_name);

        if has_local && !has_remote {
            upload_keymap_file(app, client, config, &local_path, &remote_path).await?;
        } else if !has_local && has_remote {
            download_keymap_file(client, config, &local_path, &remote_path).await?;
        } else if has_local && has_remote {
            let local_updated_at = read_local_profile_updated_at(&local_path)?;
            let remote_updated_at = read_remote_profile_updated_at(client, config, &remote_path).await?;

            if local_updated_at > remote_updated_at {
                upload_keymap_file(app, client, config, &local_path, &remote_path).await?;
            } else if remote_updated_at > local_updated_at {
                download_keymap_file(client, config, &local_path, &remote_path).await?;
            }
        }
    }

    Ok(())
}

fn read_local_profile_updated_at(path: &PathBuf) -> Result<String, String> {
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let header: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let updated_at = header.get("updatedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    Ok(updated_at)
}

async fn read_remote_profile_updated_at(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
) -> Result<String, String> {
    let response = remote::authorized_request(client, config, Method::GET, remote_path)
        .send()
        .await
        .map_err(|e| format!("failed to fetch remote keymap file header: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("failed to fetch remote keymap file: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("failed to read remote keymap file bytes: {e}"))?;
    
    let header: serde_json::Value = serde_json::from_slice(&bytes).map_err(|e| e.to_string())?;
    let updated_at = header.get("updatedAt")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    
    Ok(updated_at)
}

async fn upload_keymap_file<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    config: &WebDavSyncConfig,
    local_path: &PathBuf,
    remote_path: &str,
) -> Result<(), String> {
    log::info!("WebDAV keymap sync: Uploading keymap {:?} to {}", local_path, remote_path);
    let bytes_to_upload = fs::read(local_path).map_err(|e| e.to_string())?;
    
    let response = remote::authorized_request(client, config, Method::PUT, remote_path)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .body(bytes_to_upload)
        .send()
        .await
        .map_err(|e| format!("failed to upload keymap file {remote_path}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("failed to upload keymap file {remote_path}: HTTP {}", response.status()));
    }
    
    Ok(())
}

async fn download_keymap_file(
    client: &Client,
    config: &WebDavSyncConfig,
    local_path: &PathBuf,
    remote_path: &str,
) -> Result<(), String> {
    log::info!("WebDAV keymap sync: Downloading keymap from {} to {:?}", remote_path, local_path);
    let response = remote::authorized_request(client, config, Method::GET, remote_path)
        .send()
        .await
        .map_err(|e| format!("failed to download keymap file {remote_path}: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("failed to download keymap file {remote_path}: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("failed to read downloaded keymap file bytes: {e}"))?;

    if let Some(parent) = local_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    fs::write(local_path, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

pub(crate) async fn delete_webdav_keymap(
    config: &WebDavSyncConfig,
    filename: &str,
) -> Result<(), String> {
    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;

    let safe_filename = filename
        .chars()
        .filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_')
        .collect::<String>();
    let remote_path = format!("{}/{}.json", KEYBOARD_USER_DIR, safe_filename);

    let response = remote::authorized_request(&client, config, Method::DELETE, &remote_path)
        .send()
        .await
        .map_err(|e| format!("failed to delete remote keymap file {remote_path}: {e}"))?;

    let status = response.status();
    if status.is_success() || status == reqwest::StatusCode::NOT_FOUND {
        Ok(())
    } else {
        Err(format!(
            "failed to delete remote keymap file {remote_path}: HTTP {status}"
        ))
    }
}

