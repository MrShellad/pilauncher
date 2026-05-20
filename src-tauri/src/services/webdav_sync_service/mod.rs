mod compaction;
mod constants;
mod local_store;
mod migration;
mod models;
mod paths;
mod remote;
mod snapshot;
mod state;
mod util;

use crate::domain::library::{
    FavoriteOperation, FavoriteOperationAction, StarredItem, WebDavFavoriteSyncResult,
    WebDavSyncConfig,
};
use reqwest::Client;
use sqlx::SqlitePool;
use std::collections::HashSet;
use tauri::{AppHandle, Runtime};

use constants::{REMOTE_ROOT, SNAPSHOT_MAX_AGE_MILLIS, SNAPSHOT_OPERATION_THRESHOLD};

pub struct WebDavSyncService;

impl WebDavSyncService {
    pub async fn record_local_add_operation<R: Runtime>(
        app: &AppHandle<R>,
        item: &StarredItem,
        preferred_device_id: &str,
    ) -> Result<(), String> {
        local_store::ensure_local_layout(app)?;
        let device_id = local_store::ensure_device_id(app, preferred_device_id)?;
        let operation = FavoriteOperation {
            op_id: uuid::Uuid::new_v4().to_string(),
            target_id: item.id.clone(),
            action: FavoriteOperationAction::Add,
            timestamp: util::now_millis(),
            device_id,
            item: Some(item.clone()),
        };

        local_store::write_operation(app, &operation)
    }

    pub async fn record_local_remove_operation<R: Runtime>(
        app: &AppHandle<R>,
        item_id: &str,
        preferred_device_id: &str,
    ) -> Result<(), String> {
        local_store::ensure_local_layout(app)?;
        let device_id = local_store::ensure_device_id(app, preferred_device_id)?;
        let operation = FavoriteOperation {
            op_id: uuid::Uuid::new_v4().to_string(),
            target_id: item_id.to_string(),
            action: FavoriteOperationAction::Remove,
            timestamp: util::now_millis(),
            device_id,
            item: None,
        };

        local_store::write_operation(app, &operation)
    }

    pub async fn sync_favorites<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        config: &WebDavSyncConfig,
    ) -> Result<WebDavFavoriteSyncResult, String> {
        util::validate_base_url(&config.base_url)?;
        local_store::ensure_local_layout(app)?;

        let device_id = local_store::ensure_device_id(app, &config.device_id)?;
        state::ensure_local_state_covered_by_operations(app, pool, &device_id).await?;

        let client = Client::builder()
            .build()
            .map_err(|error| format!("failed to build WebDAV client: {error}"))?;

        let remote_created = remote::ensure_layout(&client, config).await?;
        let remote_snapshot = remote::download_snapshot(&client, config).await?;
        let local_snapshot = local_store::read_snapshot(app)?;
        let mut sync_meta = local_store::read_sync_meta(app)?;

        let selected_snapshot =
            snapshot::pick_newer_snapshot(local_snapshot.clone(), remote_snapshot.clone());
        if let Some(snapshot) = selected_snapshot.as_ref() {
            if local_snapshot
                .as_ref()
                .map(|local| snapshot.last_timestamp > local.last_timestamp)
                .unwrap_or(true)
            {
                local_store::write_snapshot(app, snapshot)?;
            }

            if sync_meta.favorites.last_snapshot_timestamp < snapshot.last_timestamp {
                sync_meta.favorites.last_snapshot_timestamp = snapshot.last_timestamp;
                sync_meta.favorites.last_snapshot_at = util::now_millis();
            }
        }

        let mut remote_operation_files = remote::list_operation_files(&client, config).await?;
        if remote_operation_files.is_empty() {
            migration::migrate_legacy_remote_document_if_present(app, &client, config).await?;
            remote_operation_files = remote::list_operation_files(&client, config).await?;
        }
        let local_operation_files = local_store::list_operation_files(app)?;

        let remote_file_set = remote_operation_files
            .iter()
            .cloned()
            .collect::<HashSet<_>>();
        let local_file_set = local_operation_files
            .iter()
            .cloned()
            .collect::<HashSet<_>>();

        let mut uploaded_operations = 0usize;
        for file_name in local_operation_files {
            if remote_file_set.contains(&file_name) {
                continue;
            }
            remote::upload_operation_file(&client, config, app, &file_name).await?;
            uploaded_operations += 1;
        }

        let mut downloaded_operations = 0usize;
        for file_name in remote_operation_files {
            if local_file_set.contains(&file_name) {
                continue;
            }
            remote::download_operation_file(&client, config, app, &file_name).await?;
            downloaded_operations += 1;
        }

        let operations = local_store::load_operations(app)?;
        let winners = snapshot::resolve_latest_operations(selected_snapshot.as_ref(), &operations);
        let merged_favorites = state::apply_operation_state(pool, &winners).await?;
        let newest_snapshot_timestamp = selected_snapshot
            .as_ref()
            .map(|snapshot| snapshot.last_timestamp)
            .unwrap_or(0);
        let operations_since_snapshot = operations
            .iter()
            .filter(|operation| operation.timestamp > newest_snapshot_timestamp)
            .count();
        let snapshot_age = util::now_millis().saturating_sub(sync_meta.favorites.last_snapshot_at);
        let should_compact = selected_snapshot.is_none()
            || operations_since_snapshot >= SNAPSHOT_OPERATION_THRESHOLD
            || sync_meta.favorites.last_snapshot_at <= 0
            || snapshot_age >= SNAPSHOT_MAX_AGE_MILLIS;

        let mut snapshot_updated = false;
        let mut compacted_operations = 0usize;
        if should_compact {
            let snapshot = snapshot::write_local_snapshot(app, &winners)?;
            remote::upload_snapshot(&client, config, &snapshot).await?;
            compacted_operations =
                compaction::compact_operations(app, &client, config, snapshot.last_timestamp)
                    .await?;
            sync_meta.favorites.last_snapshot_at = util::now_millis();
            sync_meta.favorites.last_snapshot_timestamp = snapshot.last_timestamp;
            snapshot_updated = true;
        } else if let Some(snapshot) = selected_snapshot.as_ref() {
            let remote_is_older = remote_snapshot
                .as_ref()
                .map(|remote| snapshot.last_timestamp > remote.last_timestamp)
                .unwrap_or(true);
            if remote_is_older {
                remote::upload_snapshot(&client, config, snapshot).await?;
            }
        }

        sync_meta.favorites.last_sync_at = util::now_millis();
        local_store::write_sync_meta(app, &sync_meta)?;

        Ok(WebDavFavoriteSyncResult {
            remote_root: util::join_remote_url(&config.base_url, REMOTE_ROOT),
            remote_created,
            uploaded_operations,
            downloaded_operations,
            merged_favorites,
            total_operations: operations.len(),
            snapshot_updated,
            compacted_operations,
        })
    }
}
