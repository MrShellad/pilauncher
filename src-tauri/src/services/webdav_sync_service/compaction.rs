use crate::domain::library::WebDavSyncConfig;
use reqwest::Client;
use std::fs;
use tauri::{AppHandle, Runtime};

use super::local_store;
use super::paths;
use super::remote;
use super::util;

pub(crate) async fn compact_operations<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    config: &WebDavSyncConfig,
    snapshot_timestamp: i64,
) -> Result<usize, String> {
    let mut compacted = 0usize;
    let local_operation_files = local_store::list_operation_files(app)?;
    for file_name in local_operation_files {
        let Some(timestamp) = util::operation_timestamp_from_file_name(&file_name) else {
            continue;
        };
        if timestamp > snapshot_timestamp {
            continue;
        }

        let path = paths::operations_dir(app)?.join(&file_name);
        if path.exists() {
            fs::remove_file(path).map_err(|error| error.to_string())?;
            compacted += 1;
        }
    }

    let remote_operation_files = remote::list_operation_files(client, config).await?;
    for file_name in remote_operation_files {
        let Some(timestamp) = util::operation_timestamp_from_file_name(&file_name) else {
            continue;
        };
        if timestamp > snapshot_timestamp {
            continue;
        }

        remote::delete_operation_file(client, config, &file_name).await?;
    }

    Ok(compacted)
}
