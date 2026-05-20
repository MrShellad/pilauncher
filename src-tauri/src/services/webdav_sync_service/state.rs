use crate::domain::library::{FavoriteOperation, FavoriteOperationAction, FavoriteTombstone};
use crate::services::library_service::LibraryService;
use sqlx::SqlitePool;
use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, Runtime};

use super::local_store;
use super::snapshot;
use super::util;

pub(crate) async fn ensure_local_state_covered_by_operations<R: Runtime>(
    app: &AppHandle<R>,
    pool: &SqlitePool,
    device_id: &str,
) -> Result<(), String> {
    let existing_operations = local_store::load_operations(app)?;
    let mut covered_targets = existing_operations
        .iter()
        .map(|operation| operation.target_id.clone())
        .collect::<HashSet<_>>();
    if let Some(snapshot) = local_store::read_snapshot(app)? {
        covered_targets.extend(
            snapshot::snapshot_states(&snapshot)
                .into_iter()
                .map(|operation| operation.target_id),
        );
    }

    let local_items = LibraryService::get_starred_items(pool)
        .await
        .map_err(|error| error.to_string())?;
    let local_tombstones = LibraryService::get_favorite_tombstones(pool)
        .await
        .map_err(|error| error.to_string())?;

    for item in local_items {
        if covered_targets.contains(&item.id) {
            continue;
        }

        local_store::write_operation(
            app,
            &FavoriteOperation {
                op_id: uuid::Uuid::new_v4().to_string(),
                target_id: item.id.clone(),
                action: FavoriteOperationAction::Add,
                timestamp: util::normalize_legacy_timestamp(item.updated_at.max(item.created_at)),
                device_id: device_id.to_string(),
                item: Some(item),
            },
        )?;
    }

    for tombstone in local_tombstones {
        if covered_targets.contains(&tombstone.item_id) {
            continue;
        }

        local_store::write_operation(
            app,
            &FavoriteOperation {
                op_id: uuid::Uuid::new_v4().to_string(),
                target_id: tombstone.item_id,
                action: FavoriteOperationAction::Remove,
                timestamp: util::normalize_legacy_timestamp(tombstone.deleted_at),
                device_id: device_id.to_string(),
                item: None,
            },
        )?;
    }

    Ok(())
}

pub(crate) async fn apply_operation_state(
    pool: &SqlitePool,
    winners: &HashMap<String, FavoriteOperation>,
) -> Result<usize, String> {
    let mut merged_favorites = 0usize;

    for operation in winners.values() {
        match operation.action {
            FavoriteOperationAction::Add => {
                let item = operation.item.as_ref().ok_or_else(|| {
                    format!(
                        "favorite add operation {} is missing item payload",
                        operation.op_id
                    )
                })?;
                LibraryService::save_starred_item(pool, item)
                    .await
                    .map_err(|error| error.to_string())?;
                merged_favorites += 1;
            }
            FavoriteOperationAction::Remove => {
                LibraryService::apply_favorite_tombstone(
                    pool,
                    &FavoriteTombstone {
                        item_id: operation.target_id.clone(),
                        deleted_at: operation.timestamp,
                    },
                )
                .await
                .map_err(|error| error.to_string())?;
            }
        }
    }

    Ok(merged_favorites)
}
