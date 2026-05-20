use crate::domain::library::{FavoriteOperation, FavoriteSnapshot, WebDavSyncConfig};
use regex::Regex;
use reqwest::{header, Client, Method, StatusCode};
use std::fs;
use tauri::{AppHandle, Runtime};

use super::constants::{FAVORITES_DIR, OPERATIONS_DIR, REMOTE_ROOT, SNAPSHOT_PATH};
use super::paths;
use super::util;

pub(crate) async fn ensure_layout(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<bool, String> {
    let mut remote_created = false;
    for remote_path in [REMOTE_ROOT, FAVORITES_DIR, OPERATIONS_DIR] {
        remote_created |= ensure_collection(client, config, remote_path).await?;
    }
    Ok(remote_created)
}

pub(crate) async fn ensure_collection(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
) -> Result<bool, String> {
    let method =
        Method::from_bytes(b"MKCOL").map_err(|error| format!("invalid MKCOL method: {error}"))?;
    let response = authorized_request(client, config, method, remote_path)
        .send()
        .await
        .map_err(|error| format!("failed to create WebDAV directory: {error}"))?;

    let status = response.status();
    if status.is_success() {
        return Ok(true);
    }
    if status == StatusCode::METHOD_NOT_ALLOWED || status == StatusCode::CONFLICT {
        return Ok(false);
    }

    Err(format!("failed to create WebDAV directory: HTTP {status}"))
}

pub(crate) async fn list_operation_files(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<Vec<String>, String> {
    let method = Method::from_bytes(b"PROPFIND")
        .map_err(|error| format!("invalid PROPFIND method: {error}"))?;
    let response = authorized_request(client, config, method, OPERATIONS_DIR)
        .header("Depth", "1")
        .send()
        .await
        .map_err(|error| format!("failed to list WebDAV operations: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to list WebDAV operations: HTTP {}",
            response.status()
        ));
    }

    let body = response
        .text()
        .await
        .map_err(|error| format!("failed to read WebDAV operation listing: {error}"))?;
    let href_pattern = Regex::new(r"(?i)<(?:[a-z0-9]+:)?href>([^<]+)</(?:[a-z0-9]+:)?href>")
        .map_err(|error| error.to_string())?;

    let mut file_names = href_pattern
        .captures_iter(&body)
        .filter_map(|captures| captures.get(1))
        .filter_map(|value| urlencoding::decode(value.as_str()).ok())
        .filter_map(|href| {
            href.trim_end_matches('/')
                .rsplit('/')
                .next()
                .map(|segment| segment.to_string())
        })
        .filter(|name| name.starts_with("op-") && name.ends_with(".json"))
        .collect::<Vec<_>>();
    file_names.sort();
    file_names.dedup();
    Ok(file_names)
}

pub(crate) async fn upload_operation_file<R: Runtime>(
    client: &Client,
    config: &WebDavSyncConfig,
    app: &AppHandle<R>,
    file_name: &str,
) -> Result<(), String> {
    let content = fs::read_to_string(paths::operations_dir(app)?.join(file_name))
        .map_err(|error| error.to_string())?;
    let response = authorized_request(
        client,
        config,
        Method::PUT,
        &format!("{OPERATIONS_DIR}/{file_name}"),
    )
    .header(header::CONTENT_TYPE, "application/json")
    .body(content)
    .send()
    .await
    .map_err(|error| format!("failed to upload WebDAV operation: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to upload WebDAV operation: HTTP {}",
            response.status()
        ));
    }

    Ok(())
}

pub(crate) async fn download_operation_file<R: Runtime>(
    client: &Client,
    config: &WebDavSyncConfig,
    app: &AppHandle<R>,
    file_name: &str,
) -> Result<(), String> {
    let response = authorized_request(
        client,
        config,
        Method::GET,
        &format!("{OPERATIONS_DIR}/{file_name}"),
    )
    .send()
    .await
    .map_err(|error| format!("failed to download WebDAV operation: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to download WebDAV operation: HTTP {}",
            response.status()
        ));
    }

    let content = response
        .text()
        .await
        .map_err(|error| format!("failed to read WebDAV operation: {error}"))?;
    serde_json::from_str::<FavoriteOperation>(&content)
        .map_err(|error| format!("invalid WebDAV favorite operation: {error}"))?;

    fs::write(paths::operations_dir(app)?.join(file_name), content)
        .map_err(|error| error.to_string())
}

pub(crate) async fn upload_snapshot(
    client: &Client,
    config: &WebDavSyncConfig,
    snapshot: &FavoriteSnapshot,
) -> Result<(), String> {
    let response = authorized_request(client, config, Method::PUT, SNAPSHOT_PATH)
        .header(header::CONTENT_TYPE, "application/json")
        .body(serde_json::to_string_pretty(snapshot).map_err(|error| error.to_string())?)
        .send()
        .await
        .map_err(|error| format!("failed to upload WebDAV snapshot: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to upload WebDAV snapshot: HTTP {}",
            response.status()
        ));
    }

    Ok(())
}

pub(crate) async fn download_snapshot(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<Option<FavoriteSnapshot>, String> {
    let response = authorized_request(client, config, Method::GET, SNAPSHOT_PATH)
        .send()
        .await
        .map_err(|error| format!("failed to read WebDAV snapshot: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to read WebDAV snapshot: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<FavoriteSnapshot>()
        .await
        .map(Some)
        .map_err(|error| format!("invalid WebDAV favorite snapshot: {error}"))
}

pub(crate) async fn delete_operation_file(
    client: &Client,
    config: &WebDavSyncConfig,
    file_name: &str,
) -> Result<(), String> {
    let response = authorized_request(
        client,
        config,
        Method::DELETE,
        &format!("{OPERATIONS_DIR}/{file_name}"),
    )
    .send()
    .await
    .map_err(|error| format!("failed to delete WebDAV operation: {error}"))?;

    if response.status().is_success() || response.status() == StatusCode::NOT_FOUND {
        return Ok(());
    }

    Err(format!(
        "failed to delete WebDAV operation: HTTP {}",
        response.status()
    ))
}

pub(crate) fn authorized_request(
    client: &Client,
    config: &WebDavSyncConfig,
    method: Method,
    remote_path: &str,
) -> reqwest::RequestBuilder {
    let request = client.request(method, util::join_remote_url(&config.base_url, remote_path));
    if config.username.trim().is_empty() && config.password.is_empty() {
        request
    } else {
        request.basic_auth(config.username.trim(), Some(config.password.clone()))
    }
}
