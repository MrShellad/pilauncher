// src-tauri/src/services/db_service/game_session_repo.rs
use sqlx::{Row, SqlitePool};

use crate::domain::achievement::{CareerSummaryDto, GameSession, GameSessionDto};

pub async fn insert_session(
    pool: &SqlitePool,
    session: &GameSession,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO game_sessions (
            id, instance_id, world_name, player_uuid, player_name,
            started_at, ended_at, duration_secs, exit_code,
            new_advancements_count, summary_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&session.id)
    .bind(&session.instance_id)
    .bind(&session.world_name)
    .bind(&session.player_uuid)
    .bind(&session.player_name)
    .bind(session.started_at)
    .bind(session.ended_at)
    .bind(session.duration_secs)
    .bind(session.exit_code)
    .bind(session.new_advancements_count)
    .bind(&session.summary_json)
    .bind(session.created_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn query_instance_sessions(
    pool: &SqlitePool,
    instance_id: &str,
    limit: i64,
    offset: i64,
) -> Result<Vec<GameSessionDto>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT id, instance_id, world_name, player_uuid, player_name,
                started_at, ended_at, duration_secs, exit_code, new_advancements_count
         FROM game_sessions
         WHERE instance_id = ?
         ORDER BY started_at DESC
         LIMIT ? OFFSET ?",
    )
    .bind(instance_id)
    .bind(limit)
    .bind(offset)
    .fetch_all(pool)
    .await?;

    let mut sessions = Vec::with_capacity(rows.len());
    for row in rows {
        sessions.push(GameSessionDto {
            id: row.try_get("id")?,
            instance_id: row.try_get("instance_id")?,
            world_name: row.try_get("world_name")?,
            player_uuid: row.try_get("player_uuid")?,
            player_name: row.try_get("player_name")?,
            started_at: row.try_get("started_at")?,
            ended_at: row.try_get("ended_at")?,
            duration_secs: row.try_get("duration_secs")?,
            exit_code: row.try_get("exit_code")?,
            new_advancements_count: row.try_get("new_advancements_count")?,
        });
    }

    Ok(sessions)
}

pub async fn query_session_by_id(
    pool: &SqlitePool,
    session_id: &str,
) -> Result<Option<GameSessionDto>, sqlx::Error> {
    let row_opt = sqlx::query(
        "SELECT id, instance_id, world_name, player_uuid, player_name,
                started_at, ended_at, duration_secs, exit_code, new_advancements_count
         FROM game_sessions
         WHERE id = ?",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row_opt {
        Ok(Some(GameSessionDto {
            id: row.try_get("id")?,
            instance_id: row.try_get("instance_id")?,
            world_name: row.try_get("world_name")?,
            player_uuid: row.try_get("player_uuid")?,
            player_name: row.try_get("player_name")?,
            started_at: row.try_get("started_at")?,
            ended_at: row.try_get("ended_at")?,
            duration_secs: row.try_get("duration_secs")?,
            exit_code: row.try_get("exit_code")?,
            new_advancements_count: row.try_get("new_advancements_count")?,
        }))
    } else {
        Ok(None)
    }
}

pub async fn query_player_career_summary(
    pool: &SqlitePool,
    player_uuid: &str,
) -> Result<CareerSummaryDto, sqlx::Error> {
    let session_stats = sqlx::query(
        "SELECT 
            COALESCE(SUM(duration_secs), 0) AS total_playtime,
            COUNT(*) AS total_sessions,
            MAX(ended_at) AS last_played
         FROM game_sessions
         WHERE player_uuid = ?",
    )
    .bind(player_uuid)
    .fetch_one(pool)
    .await?;

    let total_playtime: i64 = session_stats.try_get("total_playtime")?;
    let total_sessions: i64 = session_stats.try_get("total_sessions")?;
    let last_played: Option<i64> = session_stats.try_get("last_played")?;

    let advancement_stats = sqlx::query(
        "SELECT 
            COUNT(DISTINCT advancement_id) AS total_unique,
            COUNT(DISTINCT CASE WHEN frame_type = 'challenge' THEN advancement_id END) AS total_challenges
         FROM instance_advancements
         WHERE player_uuid = ?",
    )
    .bind(player_uuid)
    .fetch_one(pool)
    .await?;

    let total_unique: i64 = advancement_stats.try_get("total_unique")?;
    let total_challenges: i64 = advancement_stats.try_get("total_challenges")?;

    Ok(CareerSummaryDto {
        total_playtime_secs: total_playtime,
        total_sessions_count: total_sessions,
        total_unique_advancements: total_unique,
        challenge_advancements_count: total_challenges,
        last_played_at: last_played,
    })
}
