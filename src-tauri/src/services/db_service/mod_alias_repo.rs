use sqlx::SqlitePool;
use std::collections::HashMap;

pub async fn save_mod_aliases(
    pool: &SqlitePool,
    canonical_mod_id: &str,
    display_name: &str,
    aliases: &[String],
    source: &str,
) -> Result<(), sqlx::Error> {
    let clean_canonical = canonical_mod_id.trim().to_lowercase();
    if clean_canonical.is_empty() || aliases.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();

    for raw_alias in aliases {
        let clean_alias = raw_alias.trim().to_lowercase();
        if clean_alias.is_empty() {
            continue;
        }

        sqlx::query(
            "INSERT INTO mod_aliases (alias, canonical_mod_id, display_name, source, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(alias) DO UPDATE SET
                canonical_mod_id = excluded.canonical_mod_id,
                display_name = excluded.display_name,
                source = excluded.source,
                updated_at = excluded.updated_at;",
        )
        .bind(&clean_alias)
        .bind(&clean_canonical)
        .bind(display_name)
        .bind(source)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn query_mod_aliases(
    pool: &SqlitePool,
    aliases: &[String],
) -> Result<HashMap<String, (String, String)>, sqlx::Error> {
    if aliases.is_empty() {
        return Ok(HashMap::new());
    }

    let mut clean_list: Vec<String> = aliases
        .iter()
        .map(|a| a.trim().to_lowercase())
        .filter(|a| !a.is_empty())
        .collect();
    clean_list.sort();
    clean_list.dedup();

    if clean_list.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders = clean_list.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT alias, canonical_mod_id, display_name FROM mod_aliases WHERE alias IN ({})",
        placeholders
    );

    let mut query = sqlx::query_as::<_, (String, String, String)>(&sql);
    for a in &clean_list {
        query = query.bind(a);
    }

    let rows = query.fetch_all(pool).await?;
    let mut map = HashMap::new();
    for (alias, canonical_id, name) in rows {
        map.insert(alias, (canonical_id, name));
    }

    Ok(map)
}

pub async fn query_aliases_for_mod_ids(
    pool: &SqlitePool,
    mod_ids: &[String],
) -> Result<HashMap<String, Vec<String>>, sqlx::Error> {
    if mod_ids.is_empty() {
        return Ok(HashMap::new());
    }

    let mut clean_list: Vec<String> = mod_ids
        .iter()
        .map(|m| m.trim().to_lowercase())
        .filter(|m| !m.is_empty())
        .collect();
    clean_list.sort();
    clean_list.dedup();

    if clean_list.is_empty() {
        return Ok(HashMap::new());
    }

    let placeholders = clean_list.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT alias, canonical_mod_id FROM mod_aliases WHERE canonical_mod_id IN ({})",
        placeholders
    );

    let mut query = sqlx::query_as::<_, (String, String)>(&sql);
    for m in &clean_list {
        query = query.bind(m);
    }

    let rows = query.fetch_all(pool).await?;
    let mut map: HashMap<String, Vec<String>> = HashMap::new();
    for (alias, canonical_id) in rows {
        map.entry(canonical_id).or_default().push(alias);
    }

    Ok(map)
}
