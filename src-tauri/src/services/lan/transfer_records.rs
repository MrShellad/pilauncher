use crate::domain::lan::{TransferProgressEvent, TransferRecord};
use crate::services::db_service::AppDatabase;
use sqlx::Row;
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Clone)]
pub struct TransferRecordUpsert<'a> {
    pub transfer_id: &'a str,
    pub direction: &'a str,
    pub sender_device_id: &'a str,
    pub sender_device: &'a str,
    pub receiver_device_id: &'a str,
    pub receiver_device: &'a str,
    pub remote_device_id: &'a str,
    pub remote_device_name: &'a str,
    pub remote_username: &'a str,
    pub transfer_type: &'a str,
    pub name: &'a str,
    pub size: i64,
    pub status: String,
    pub error_message: Option<String>,
    pub mark_completed: bool,
}

fn row_to_transfer_record(row: &sqlx::sqlite::SqliteRow) -> Result<TransferRecord, String> {
    let created_at = row
        .try_get::<String, _>("created_ts")
        .unwrap_or_else(|_| "0".to_string())
        .parse::<i64>()
        .unwrap_or(0);

    let completed_at = row
        .try_get::<Option<String>, _>("completed_ts")
        .ok()
        .flatten()
        .and_then(|value| value.parse::<i64>().ok());

    Ok(TransferRecord {
        transfer_id: row.try_get("transfer_uuid").map_err(|e| e.to_string())?,
        direction: row.try_get("direction").map_err(|e| e.to_string())?,
        remote_device_id: row.try_get("remote_device_id").map_err(|e| e.to_string())?,
        remote_device_name: row.try_get("remote_device_name").map_err(|e| e.to_string())?,
        remote_username: row
            .try_get::<Option<String>, _>("remote_username")
            .unwrap_or_default()
            .unwrap_or_default(),
        transfer_type: row.try_get("type").map_err(|e| e.to_string())?,
        name: row.try_get("name").map_err(|e| e.to_string())?,
        size: row.try_get("size").unwrap_or(0_i64),
        status: row.try_get("status").map_err(|e| e.to_string())?,
        error_message: row.try_get::<Option<String>, _>("error_message").unwrap_or_default(),
        created_at,
        completed_at,
    })
}

pub async fn upsert_transfer_record<R: Runtime>(
    app: &AppHandle<R>,
    db: &AppDatabase,
    payload: TransferRecordUpsert<'_>,
) -> Result<TransferRecord, String> {
    let existing = sqlx::query("SELECT id FROM transfers WHERE transfer_uuid = $1 LIMIT 1")
        .bind(payload.transfer_id)
        .fetch_optional(&db.pool)
        .await
        .map_err(|e| format!("Failed to query transfer record: {}", e))?;

    if let Some(row) = existing {
        let record_id: i64 = row.try_get("id").map_err(|e| e.to_string())?;
        sqlx::query(
            "UPDATE transfers
             SET sender_device_id = $1,
                 sender_device = $2,
                 receiver_device_id = $3,
                 receiver_device = $4,
                 remote_device_id = $5,
                 remote_device_name = $6,
                 remote_username = $7,
                 type = $8,
                 name = $9,
                 size = $10,
                 status = $11,
                 error_message = $12,
                 completed_at = CASE WHEN $13 THEN CURRENT_TIMESTAMP ELSE completed_at END
             WHERE id = $14",
        )
        .bind(payload.sender_device_id)
        .bind(payload.sender_device)
        .bind(payload.receiver_device_id)
        .bind(payload.receiver_device)
        .bind(payload.remote_device_id)
        .bind(payload.remote_device_name)
        .bind(payload.remote_username)
        .bind(payload.transfer_type)
        .bind(payload.name)
        .bind(payload.size)
        .bind(&payload.status)
        .bind(payload.error_message.as_deref().unwrap_or(""))
        .bind(payload.mark_completed)
        .bind(record_id)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to update transfer record: {}", e))?;
    } else {
        sqlx::query(
            "INSERT INTO transfers (
                transfer_uuid,
                direction,
                sender_device_id,
                sender_device,
                receiver_device_id,
                receiver_device,
                remote_device_id,
                remote_device_name,
                remote_username,
                type,
                name,
                size,
                status,
                error_message,
                created_at,
                completed_at
             )
             VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                CURRENT_TIMESTAMP,
                CASE WHEN $15 THEN CURRENT_TIMESTAMP ELSE NULL END
             )",
        )
        .bind(payload.transfer_id)
        .bind(payload.direction)
        .bind(payload.sender_device_id)
        .bind(payload.sender_device)
        .bind(payload.receiver_device_id)
        .bind(payload.receiver_device)
        .bind(payload.remote_device_id)
        .bind(payload.remote_device_name)
        .bind(payload.remote_username)
        .bind(payload.transfer_type)
        .bind(payload.name)
        .bind(payload.size)
        .bind(&payload.status)
        .bind(payload.error_message.as_deref().unwrap_or(""))
        .bind(payload.mark_completed)
        .execute(&db.pool)
        .await
        .map_err(|e| format!("Failed to insert transfer record: {}", e))?;
    }

    let record = fetch_transfer_record_by_uuid(db, payload.transfer_id).await?;
    let _ = app.emit("lan-transfer-record-updated", &record);
    Ok(record)
}

pub async fn fetch_transfer_record_by_uuid(
    db: &AppDatabase,
    transfer_id: &str,
) -> Result<TransferRecord, String> {
    let row = sqlx::query(
        "SELECT transfer_uuid, direction, remote_device_id, remote_device_name, remote_username,
                type, name, size, status, error_message,
                strftime('%s', created_at) AS created_ts,
                CASE WHEN completed_at IS NOT NULL THEN strftime('%s', completed_at) END AS completed_ts
         FROM transfers
         WHERE transfer_uuid = $1
         LIMIT 1",
    )
    .bind(transfer_id)
    .fetch_one(&db.pool)
    .await
    .map_err(|e| format!("Failed to fetch transfer record: {}", e))?;

    row_to_transfer_record(&row)
}

pub async fn fetch_transfer_history(
    db: &AppDatabase,
    remote_device_id: Option<&str>,
) -> Result<Vec<TransferRecord>, String> {
    let rows = if let Some(device_id) = remote_device_id {
        sqlx::query(
            "SELECT transfer_uuid, direction, remote_device_id, remote_device_name, remote_username,
                    type, name, size, status, error_message,
                    strftime('%s', created_at) AS created_ts,
                    CASE WHEN completed_at IS NOT NULL THEN strftime('%s', completed_at) END AS completed_ts
             FROM transfers
             WHERE remote_device_id = $1
             ORDER BY created_at ASC",
        )
        .bind(device_id)
        .fetch_all(&db.pool)
        .await
        .map_err(|e| format!("Failed to fetch transfer history: {}", e))?
    } else {
        sqlx::query(
            "SELECT transfer_uuid, direction, remote_device_id, remote_device_name, remote_username,
                    type, name, size, status, error_message,
                    strftime('%s', created_at) AS created_ts,
                    CASE WHEN completed_at IS NOT NULL THEN strftime('%s', completed_at) END AS completed_ts
             FROM transfers
             ORDER BY created_at ASC",
        )
        .fetch_all(&db.pool)
        .await
        .map_err(|e| format!("Failed to fetch transfer history: {}", e))?
    };

    rows.iter().map(row_to_transfer_record).collect()
}

pub fn emit_transfer_progress<R: Runtime>(
    app: &AppHandle<R>,
    payload: &TransferProgressEvent,
) {
    let _ = app.emit("lan-transfer-progress", payload);
}
