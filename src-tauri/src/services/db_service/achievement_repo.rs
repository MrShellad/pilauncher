// src-tauri/src/services/db_service/achievement_repo.rs
use sqlx::{Row, SqlitePool};

use crate::domain::achievement::{
    AdvancementItemDto, AdvancementMetadataCache, InstanceAdvancement,
};

pub async fn upsert_advancements(
    pool: &SqlitePool,
    items: &[InstanceAdvancement],
) -> Result<(), sqlx::Error> {
    if items.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    for item in items {
        sqlx::query(
            "INSERT INTO instance_advancements (
                id, instance_id, world_name, player_uuid, advancement_id,
                frame_type, session_id, unlocked_at, is_first_career_unlock,
                criteria_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(instance_id, world_name, player_uuid, advancement_id) DO UPDATE SET
                frame_type = excluded.frame_type,
                session_id = COALESCE(instance_advancements.session_id, excluded.session_id),
                unlocked_at = excluded.unlocked_at,
                criteria_json = excluded.criteria_json",
        )
        .bind(&item.id)
        .bind(&item.instance_id)
        .bind(&item.world_name)
        .bind(&item.player_uuid)
        .bind(&item.advancement_id)
        .bind(&item.frame_type)
        .bind(&item.session_id)
        .bind(item.unlocked_at)
        .bind(item.is_first_career_unlock)
        .bind(&item.criteria_json)
        .bind(item.created_at)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn is_advancement_unlocked_career(
    pool: &SqlitePool,
    player_uuid: &str,
    advancement_id: &str,
) -> Result<bool, sqlx::Error> {
    let exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(
            SELECT 1 FROM instance_advancements 
            WHERE player_uuid = ? AND advancement_id = ?
        )",
    )
    .bind(player_uuid)
    .bind(advancement_id)
    .fetch_one(pool)
    .await?;

    Ok(exists > 0)
}

pub async fn query_instance_advancements(
    pool: &SqlitePool,
    instance_id: &str,
    world_name: &str,
    player_uuid: &str,
) -> Result<Vec<AdvancementItemDto>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT 
            COALESCE(m.advancement_id, a.advancement_id) AS advancement_id,
            COALESCE(m.namespace, '') AS namespace,
            m.parent_id,
            COALESCE(m.title, a.advancement_id) AS title,
            m.description,
            COALESCE(m.icon_rel_path, '') AS icon_rel_path,
            COALESCE(m.frame_type, a.frame_type, 'task') AS frame_type,
            a.unlocked_at,
            (a.unlocked_at IS NOT NULL) AS is_completed,
            COALESCE(a.is_first_career_unlock, 0) AS is_first_career_unlock,
            a.criteria_json
         FROM instance_advancements a
         LEFT JOIN advancement_metadata_cache m ON a.advancement_id = m.advancement_id
         WHERE a.instance_id = ? AND a.world_name = ? AND a.player_uuid = ?
         ORDER BY a.unlocked_at DESC",
    )
    .bind(instance_id)
    .bind(world_name)
    .bind(player_uuid)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(rows.len());
    for row in rows {
        let criteria_json: Option<String> = row.try_get("criteria_json")?;
        let criteria_data = criteria_json
            .as_deref()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());

        result.push(AdvancementItemDto {
            advancement_id: row.try_get("advancement_id")?,
            namespace: row.try_get("namespace")?,
            parent_id: row.try_get("parent_id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            icon_rel_path: row.try_get("icon_rel_path")?,
            frame_type: row.try_get("frame_type")?,
            unlocked_at: row.try_get("unlocked_at")?,
            is_completed: row.try_get("is_completed")?,
            is_first_career_unlock: row.try_get("is_first_career_unlock")?,
            criteria_data,
        });
    }

    Ok(result)
}

pub async fn query_session_advancements(
    pool: &SqlitePool,
    session_id: &str,
) -> Result<Vec<AdvancementItemDto>, sqlx::Error> {
    let rows = sqlx::query(
        "SELECT 
            a.advancement_id,
            COALESCE(m.namespace, '') AS namespace,
            m.parent_id,
            COALESCE(m.title, a.advancement_id) AS title,
            m.description,
            COALESCE(m.icon_rel_path, '') AS icon_rel_path,
            COALESCE(m.frame_type, a.frame_type, 'task') AS frame_type,
            a.unlocked_at,
            1 AS is_completed,
            a.is_first_career_unlock,
            a.criteria_json
         FROM instance_advancements a
         LEFT JOIN advancement_metadata_cache m ON a.advancement_id = m.advancement_id
         WHERE a.session_id = ?
         ORDER BY a.unlocked_at DESC",
    )
    .bind(session_id)
    .fetch_all(pool)
    .await?;

    let mut result = Vec::with_capacity(rows.len());
    for row in rows {
        let criteria_json: Option<String> = row.try_get("criteria_json")?;
        let criteria_data = criteria_json
            .as_deref()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok());

        result.push(AdvancementItemDto {
            advancement_id: row.try_get("advancement_id")?,
            namespace: row.try_get("namespace")?,
            parent_id: row.try_get("parent_id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            icon_rel_path: row.try_get("icon_rel_path")?,
            frame_type: row.try_get("frame_type")?,
            unlocked_at: row.try_get("unlocked_at")?,
            is_completed: true,
            is_first_career_unlock: row.try_get("is_first_career_unlock")?,
            criteria_data,
        });
    }

    Ok(result)
}

pub async fn upsert_metadata_cache(
    pool: &SqlitePool,
    items: &[AdvancementMetadataCache],
) -> Result<(), sqlx::Error> {
    if items.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;

    for item in items {
        sqlx::query(
            "INSERT INTO advancement_metadata_cache (
                advancement_id, namespace, parent_id, title, description,
                frame_type, icon_rel_path, source_type, source_hash, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(advancement_id) DO UPDATE SET
                namespace = excluded.namespace,
                parent_id = excluded.parent_id,
                title = excluded.title,
                description = excluded.description,
                frame_type = excluded.frame_type,
                icon_rel_path = excluded.icon_rel_path,
                source_type = excluded.source_type,
                source_hash = excluded.source_hash,
                updated_at = excluded.updated_at",
        )
        .bind(&item.advancement_id)
        .bind(&item.namespace)
        .bind(&item.parent_id)
        .bind(&item.title)
        .bind(&item.description)
        .bind(&item.frame_type)
        .bind(&item.icon_rel_path)
        .bind(&item.source_type)
        .bind(&item.source_hash)
        .bind(item.updated_at)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn query_metadata_cache_by_id(
    pool: &SqlitePool,
    advancement_id: &str,
) -> Result<Option<AdvancementMetadataCache>, sqlx::Error> {
    let row_opt = sqlx::query(
        "SELECT advancement_id, namespace, parent_id, title, description,
                frame_type, icon_rel_path, source_type, source_hash, updated_at
         FROM advancement_metadata_cache
         WHERE advancement_id = ?",
    )
    .bind(advancement_id)
    .fetch_optional(pool)
    .await?;

    if let Some(row) = row_opt {
        Ok(Some(AdvancementMetadataCache {
            advancement_id: row.try_get("advancement_id")?,
            namespace: row.try_get("namespace")?,
            parent_id: row.try_get("parent_id")?,
            title: row.try_get("title")?,
            description: row.try_get("description")?,
            frame_type: row.try_get("frame_type")?,
            icon_rel_path: row.try_get("icon_rel_path")?,
            source_type: row.try_get("source_type")?,
            source_hash: row.try_get("source_hash")?,
            updated_at: row.try_get("updated_at")?,
        }))
    } else {
        Ok(None)
    }
}
