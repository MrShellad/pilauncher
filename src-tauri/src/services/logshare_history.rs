use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use uuid::Uuid;

pub const DEFAULT_LOGSHARE_TTL_SECONDS: i64 = 7_776_000;

#[derive(Debug, Clone)]
pub struct NewLogShareHistory {
    pub log_id: String,
    pub log_type: String,
    pub url: String,
    pub raw_url: Option<String>,
    pub token: String,
}

#[derive(Debug, Clone, Deserialize, Serialize, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct LogShareHistoryRecord {
    pub uuid: String,
    pub log_id: String,
    pub log_type: String,
    pub url: String,
    pub raw_url: Option<String>,
    #[serde(skip_serializing)]
    pub token: String,
    pub created_at: i64,
    pub expires_at: i64,
}

pub struct LogShareHistoryService;

impl LogShareHistoryService {
    pub async fn list(pool: &SqlitePool) -> Result<Vec<LogShareHistoryRecord>, sqlx::Error> {
        sqlx::query_as::<_, LogShareHistoryRecord>(
            "SELECT uuid, log_id, log_type, url, raw_url, token, created_at, expires_at
             FROM logshare_history
             ORDER BY created_at DESC",
        )
        .fetch_all(pool)
        .await
    }

    pub async fn get(
        pool: &SqlitePool,
        uuid: &str,
    ) -> Result<Option<LogShareHistoryRecord>, sqlx::Error> {
        sqlx::query_as::<_, LogShareHistoryRecord>(
            "SELECT uuid, log_id, log_type, url, raw_url, token, created_at, expires_at
             FROM logshare_history
             WHERE uuid = ?
             LIMIT 1",
        )
        .bind(uuid)
        .fetch_optional(pool)
        .await
    }

    pub async fn save(
        pool: &SqlitePool,
        input: NewLogShareHistory,
    ) -> Result<LogShareHistoryRecord, sqlx::Error> {
        let now = Utc::now().timestamp();
        let record = LogShareHistoryRecord {
            uuid: Uuid::new_v4().to_string(),
            log_id: input.log_id,
            log_type: normalize_log_type(&input.log_type),
            url: input.url,
            raw_url: input.raw_url,
            token: input.token,
            created_at: now,
            expires_at: now + DEFAULT_LOGSHARE_TTL_SECONDS,
        };

        sqlx::query(
            "INSERT INTO logshare_history (
                uuid, log_id, log_type, url, raw_url, token, created_at, expires_at
             ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&record.uuid)
        .bind(&record.log_id)
        .bind(&record.log_type)
        .bind(&record.url)
        .bind(&record.raw_url)
        .bind(&record.token)
        .bind(record.created_at)
        .bind(record.expires_at)
        .execute(pool)
        .await?;

        Ok(record)
    }

    pub async fn delete_local(pool: &SqlitePool, uuid: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM logshare_history WHERE uuid = ?")
            .bind(uuid)
            .execute(pool)
            .await?;

        Ok(())
    }
}

fn normalize_log_type(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return "game".to_string();
    }

    trimmed.chars().take(64).collect()
}
