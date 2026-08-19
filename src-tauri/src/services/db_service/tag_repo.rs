use sqlx::SqlitePool;

pub async fn replace_instance_tag_rows(
    pool: &SqlitePool,
    instance_id: &str,
    tags: &[String],
) -> Result<(), sqlx::Error> {
    let mut normalized_tags = Vec::new();
    for tag in tags {
        let normalized = tag.split_whitespace().collect::<Vec<_>>().join(" ");
        if !normalized.is_empty() && !normalized_tags.contains(&normalized) {
            normalized_tags.push(normalized);
        }
    }

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

    tx.commit().await?;
    Ok(())
}
