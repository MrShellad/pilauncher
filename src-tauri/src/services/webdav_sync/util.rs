use crate::domain::library::{FavoriteOperation, FavoriteOperationAction};
use reqwest::Url;
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) fn validate_base_url(base_url: &str) -> Result<(), String> {
    let trimmed = base_url.trim();
    if trimmed.is_empty() {
        return Err("WebDAV address is empty".to_string());
    }

    let parsed = Url::parse(trimmed).map_err(|error| format!("invalid WebDAV URL: {error}"))?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("WebDAV address must start with http:// or https://".to_string());
    }

    Ok(())
}

pub(crate) fn normalize_legacy_timestamp(value: i64) -> i64 {
    if value.abs() < 10_000_000_000 {
        value.saturating_mul(1000)
    } else {
        value
    }
}

pub(crate) fn now_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as i64)
        .unwrap_or(0)
}

pub(crate) fn join_remote_url(base_url: &str, remote_path: &str) -> String {
    format!(
        "{}/{}",
        base_url.trim_end_matches('/'),
        remote_path.trim_start_matches('/')
    )
}

pub(crate) fn operation_is_newer(
    candidate: &FavoriteOperation,
    current: &FavoriteOperation,
) -> bool {
    candidate.timestamp > current.timestamp
        || (candidate.timestamp == current.timestamp
            && candidate.action == FavoriteOperationAction::Remove
            && current.action == FavoriteOperationAction::Add)
        || (candidate.timestamp == current.timestamp
            && candidate.action == current.action
            && candidate.op_id > current.op_id)
}

pub(crate) fn operation_file_name(operation: &FavoriteOperation) -> String {
    format!("op-{}-{}.json", operation.timestamp, operation.op_id)
}

pub(crate) fn operation_timestamp_from_file_name(file_name: &str) -> Option<i64> {
    file_name
        .strip_prefix("op-")?
        .split('-')
        .next()?
        .parse::<i64>()
        .ok()
}

pub(crate) fn legacy_operation_id(action: &str, target_id: &str, timestamp: i64) -> String {
    uuid::Uuid::new_v5(
        &uuid::Uuid::NAMESPACE_URL,
        format!("legacy-favorite:{action}:{target_id}:{timestamp}").as_bytes(),
    )
    .to_string()
}
