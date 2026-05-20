use crate::domain::library::{FavoriteOperation, FavoriteOperationAction, FavoriteSnapshot};
use std::collections::HashMap;
use tauri::{AppHandle, Runtime};

use super::constants::FAVORITE_SNAPSHOT_VERSION;
use super::local_store;
use super::util;

pub(crate) fn resolve_latest_operations(
    snapshot: Option<&FavoriteSnapshot>,
    operations: &[FavoriteOperation],
) -> HashMap<String, FavoriteOperation> {
    let mut winners = HashMap::<String, FavoriteOperation>::new();
    if let Some(snapshot) = snapshot {
        for operation in snapshot_states(snapshot) {
            winners.insert(operation.target_id.clone(), operation);
        }
    }

    for operation in operations {
        let should_replace = match winners.get(&operation.target_id) {
            Some(current) => util::operation_is_newer(operation, current),
            None => true,
        };

        if should_replace {
            winners.insert(operation.target_id.clone(), operation.clone());
        }
    }

    winners
}

pub(crate) fn snapshot_states(snapshot: &FavoriteSnapshot) -> Vec<FavoriteOperation> {
    if !snapshot.states.is_empty() {
        return snapshot.states.clone();
    }

    snapshot
        .favorites
        .iter()
        .map(|item| {
            let timestamp = util::normalize_legacy_timestamp(item.updated_at.max(item.created_at));
            FavoriteOperation {
                op_id: util::legacy_operation_id("snapshot-add", &item.id, timestamp),
                target_id: item.id.clone(),
                action: FavoriteOperationAction::Add,
                timestamp,
                device_id: "snapshot".to_string(),
                item: Some(item.clone()),
            }
        })
        .collect()
}

pub(crate) fn write_local_snapshot<R: Runtime>(
    app: &AppHandle<R>,
    winners: &HashMap<String, FavoriteOperation>,
) -> Result<FavoriteSnapshot, String> {
    let mut favorites = winners
        .values()
        .filter(|operation| operation.action == FavoriteOperationAction::Add)
        .filter_map(|operation| operation.item.clone())
        .collect::<Vec<_>>();
    favorites.sort_by(|left, right| right.updated_at.cmp(&left.updated_at));

    let mut states = winners.values().cloned().collect::<Vec<_>>();
    states.sort_by(|left, right| {
        left.target_id
            .cmp(&right.target_id)
            .then_with(|| left.timestamp.cmp(&right.timestamp))
            .then_with(|| left.op_id.cmp(&right.op_id))
    });

    let snapshot = FavoriteSnapshot {
        version: FAVORITE_SNAPSHOT_VERSION,
        favorites,
        states,
        last_timestamp: winners
            .values()
            .map(|operation| operation.timestamp)
            .max()
            .unwrap_or(0),
    };

    local_store::write_snapshot(app, &snapshot)?;
    Ok(snapshot)
}

pub(crate) fn pick_newer_snapshot(
    local: Option<FavoriteSnapshot>,
    remote: Option<FavoriteSnapshot>,
) -> Option<FavoriteSnapshot> {
    match (local, remote) {
        (Some(local), Some(remote)) => {
            if remote.last_timestamp > local.last_timestamp {
                Some(remote)
            } else {
                Some(local)
            }
        }
        (Some(local), None) => Some(local),
        (None, Some(remote)) => Some(remote),
        (None, None) => None,
    }
}
