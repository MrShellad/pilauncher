use crate::domain::library::{FavoriteOperation, FavoriteOperationAction, WebDavSyncConfig};
use reqwest::{Client, Method, StatusCode};
use std::collections::HashSet;
use tauri::{AppHandle, Runtime};

use super::constants::LEGACY_FAVORITES_FILE;
use super::local_store;
use super::models::LegacyFavoriteSyncDocument;
use super::remote;
use super::util;

pub(crate) async fn migrate_legacy_remote_document_if_present<R: Runtime>(
    app: &AppHandle<R>,
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<(), String> {
    let response = remote::authorized_request(client, config, Method::GET, LEGACY_FAVORITES_FILE)
        .send()
        .await
        .map_err(|error| format!("failed to read legacy WebDAV favorites: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(());
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to read legacy WebDAV favorites: HTTP {}",
            response.status()
        ));
    }

    let document = response
        .json::<LegacyFavoriteSyncDocument>()
        .await
        .map_err(|error| format!("invalid legacy WebDAV favorites document: {error}"))?;
    let existing_op_ids = local_store::load_operations(app)?
        .into_iter()
        .map(|operation| operation.op_id)
        .collect::<HashSet<_>>();

    for item in document.starred_items {
        let timestamp = util::normalize_legacy_timestamp(item.updated_at.max(item.created_at));
        let op_id = util::legacy_operation_id("add", &item.id, timestamp);
        if existing_op_ids.contains(&op_id) {
            continue;
        }

        local_store::write_operation(
            app,
            &FavoriteOperation {
                op_id,
                target_id: item.id.clone(),
                action: FavoriteOperationAction::Add,
                timestamp,
                device_id: "legacy-remote".to_string(),
                item: Some(item),
            },
        )?;
    }

    for tombstone in document.tombstones {
        let timestamp = util::normalize_legacy_timestamp(tombstone.deleted_at);
        let op_id = util::legacy_operation_id("remove", &tombstone.item_id, timestamp);
        if existing_op_ids.contains(&op_id) {
            continue;
        }

        local_store::write_operation(
            app,
            &FavoriteOperation {
                op_id,
                target_id: tombstone.item_id,
                action: FavoriteOperationAction::Remove,
                timestamp,
                device_id: "legacy-remote".to_string(),
                item: None,
            },
        )?;
    }

    Ok(())
}
