use sqlx::SqlitePool;

use super::models::ModRelationRecord;

pub async fn save_mod_relations(
    pool: &SqlitePool,
    relations: &[ModRelationRecord],
) -> Result<(), sqlx::Error> {
    if relations.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();

    for rel in relations {
        let src_id = if rel.source_type == "mod_id" {
            rel.source_identifier.trim().to_lowercase()
        } else {
            rel.source_identifier.trim().to_string()
        };
        let tgt_id = if rel.target_type == "mod_id" {
            rel.target_identifier.trim().to_lowercase()
        } else {
            rel.target_identifier.trim().to_string()
        };

        if src_id.is_empty() || tgt_id.is_empty() || src_id == tgt_id {
            continue;
        }

        sqlx::query(
            "INSERT INTO mod_relations (
                source_identifier, source_type, target_identifier, target_type,
                relation_type, version_requirement, target_name_hint, source_provider, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (source_identifier, target_identifier, relation_type) DO UPDATE SET
                target_type = excluded.target_type,
                version_requirement = COALESCE(excluded.version_requirement, mod_relations.version_requirement),
                target_name_hint = COALESCE(excluded.target_name_hint, mod_relations.target_name_hint),
                source_provider = excluded.source_provider,
                updated_at = excluded.updated_at;",
        )
        .bind(&src_id)
        .bind(&rel.source_type)
        .bind(&tgt_id)
        .bind(&rel.target_type)
        .bind(&rel.relation_type)
        .bind(&rel.version_requirement)
        .bind(&rel.target_name_hint)
        .bind(&rel.source_provider)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn query_mod_dependencies(
    pool: &SqlitePool,
    identifiers: &[String],
) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
    if identifiers.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = identifiers.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT source_identifier, source_type, target_identifier, target_type,
                relation_type, version_requirement, target_name_hint, source_provider
         FROM mod_relations
         WHERE source_identifier IN ({})",
        placeholders
    );

    let mut query = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, String)>(&sql);
    for id in identifiers {
        query = query.bind(id.trim().to_lowercase());
    }

    let rows = query.fetch_all(pool).await?;
    let result = rows
        .into_iter()
        .map(|(src_id, src_type, tgt_id, tgt_type, rel_type, ver, hint, prov)| ModRelationRecord {
            source_identifier: src_id,
            source_type: src_type,
            target_identifier: tgt_id,
            target_type: tgt_type,
            relation_type: rel_type,
            version_requirement: ver,
            target_name_hint: hint,
            source_provider: prov,
        })
        .collect();

    Ok(result)
}

pub async fn query_mod_dependents(
    pool: &SqlitePool,
    identifiers: &[String],
) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
    if identifiers.is_empty() {
        return Ok(Vec::new());
    }

    let placeholders = identifiers.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT source_identifier, source_type, target_identifier, target_type,
                relation_type, version_requirement, target_name_hint, source_provider
         FROM mod_relations
         WHERE target_identifier IN ({})",
        placeholders
    );

    let mut query = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, String)>(&sql);
    for id in identifiers {
        query = query.bind(id.trim().to_lowercase());
    }

    let rows = query.fetch_all(pool).await?;
    let result = rows
        .into_iter()
        .map(|(src_id, src_type, tgt_id, tgt_type, rel_type, ver, hint, prov)| ModRelationRecord {
            source_identifier: src_id,
            source_type: src_type,
            target_identifier: tgt_id,
            target_type: tgt_type,
            relation_type: rel_type,
            version_requirement: ver,
            target_name_hint: hint,
            source_provider: prov,
        })
        .collect();

    Ok(result)
}
