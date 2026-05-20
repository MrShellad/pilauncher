use crate::error::AppResult;
use sqlx::{QueryBuilder, Row, Sqlite, SqlitePool};

pub struct InstanceTagService;

impl InstanceTagService {
    pub fn normalize_tags(tags: &[String]) -> Vec<String> {
        let mut normalized_tags = Vec::new();

        for tag in tags {
            let normalized = tag.split_whitespace().collect::<Vec<_>>().join(" ");
            if !normalized.is_empty() && !normalized_tags.contains(&normalized) {
                normalized_tags.push(normalized);
            }
        }

        normalized_tags
    }

    pub async fn set_instance_tags(
        pool: &SqlitePool,
        instance_id: &str,
        tags: &[String],
    ) -> AppResult<Vec<String>> {
        let normalized_tags = Self::normalize_tags(tags);
        let mut tx = pool.begin().await?;

        sqlx::query("DELETE FROM instance_tags WHERE instance_id = ?")
            .bind(instance_id)
            .execute(&mut *tx)
            .await?;

        for (index, tag) in normalized_tags.iter().enumerate() {
            sqlx::query(
                "INSERT INTO tags (name)
                 VALUES (?)
                 ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
            )
            .bind(tag)
            .execute(&mut *tx)
            .await?;

            let tag_id: i64 = sqlx::query_scalar("SELECT id FROM tags WHERE name = ?")
                .bind(tag)
                .fetch_one(&mut *tx)
                .await?;

            sqlx::query(
                "INSERT INTO instance_tags (instance_id, tag_id, sort_order)
                 VALUES (?, ?, ?)
                 ON CONFLICT(instance_id, tag_id) DO UPDATE SET sort_order = excluded.sort_order",
            )
            .bind(instance_id)
            .bind(tag_id)
            .bind(index as i64)
            .execute(&mut *tx)
            .await?;
        }

        Self::cleanup_orphan_tags_in_tx(&mut tx).await?;
        tx.commit().await?;

        Ok(normalized_tags)
    }

    pub async fn get_instance_tags(pool: &SqlitePool, instance_id: &str) -> AppResult<Vec<String>> {
        let rows = sqlx::query(
            "SELECT t.name AS name
             FROM instance_tags it
             JOIN tags t ON t.id = it.tag_id
             WHERE it.instance_id = ?
             ORDER BY it.sort_order ASC, t.name ASC",
        )
        .bind(instance_id)
        .fetch_all(pool)
        .await?;

        Ok(rows.into_iter().map(|row| row.get("name")).collect())
    }

    pub async fn get_tags_for_instances(
        pool: &SqlitePool,
        instance_ids: &[String],
    ) -> AppResult<std::collections::HashMap<String, Vec<String>>> {
        let mut tags_by_instance = std::collections::HashMap::new();
        if instance_ids.is_empty() {
            return Ok(tags_by_instance);
        }

        let mut query = QueryBuilder::<Sqlite>::new(
            "SELECT it.instance_id AS instance_id, t.name AS name
             FROM instance_tags it
             JOIN tags t ON t.id = it.tag_id
             WHERE it.instance_id IN (",
        );
        let mut separated = query.separated(", ");
        for instance_id in instance_ids {
            separated.push_bind(instance_id);
        }
        separated.push_unseparated(
            ")
             ORDER BY it.instance_id ASC, it.sort_order ASC, t.name ASC",
        );

        let rows = query.build().fetch_all(pool).await?;
        for row in rows {
            let instance_id: String = row.get("instance_id");
            let tag: String = row.get("name");
            tags_by_instance
                .entry(instance_id)
                .or_insert_with(Vec::new)
                .push(tag);
        }

        Ok(tags_by_instance)
    }

    pub async fn cleanup_orphan_tags(pool: &SqlitePool) -> AppResult<()> {
        sqlx::query(
            "DELETE FROM tags
             WHERE NOT EXISTS (
                 SELECT 1 FROM instance_tags
                 WHERE instance_tags.tag_id = tags.id
             )",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn cleanup_orphan_tags_in_tx(
        tx: &mut sqlx::Transaction<'_, sqlx::Sqlite>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "DELETE FROM tags
             WHERE NOT EXISTS (
                 SELECT 1 FROM instance_tags
                 WHERE instance_tags.tag_id = tags.id
             )",
        )
        .execute(&mut **tx)
        .await?;

        Ok(())
    }
}
