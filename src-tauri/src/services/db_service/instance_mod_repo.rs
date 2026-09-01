use sqlx::SqlitePool;

use super::models::{EnrichedInstanceModRow, InstanceModDbRow, RawInstanceModQueryResult};
use super::mod_relation_repo::{query_mod_dependencies, query_mod_dependents};

fn version_relation_key(platform: Option<&str>, file_id: Option<&str>) -> Option<String> {
    let platform = platform?.trim().to_lowercase();
    let file_id = file_id?.trim().to_lowercase();
    (!platform.is_empty() && !file_id.is_empty())
        .then(|| format!("version:{platform}:{file_id}"))
}

pub async fn query_instance_mods(
    pool: &SqlitePool,
    instance_id: &str,
) -> Result<Vec<EnrichedInstanceModRow>, sqlx::Error> {
    let raw_rows = sqlx::query_as::<_, RawInstanceModQueryResult>(
        "SELECT 
            im.file_name, im.is_enabled, im.file_size, im.modified_at, im.sha1, im.curseforge_fingerprint,
            im.mod_id, g.name AS name, im.version,
            g.description, g.icon_rel_path, g.icon_source, g.aliases,
            im.source_platform, im.source_project_id, im.source_file_id
         FROM instance_mods im
         LEFT JOIN mod_global_metadata_cache g ON im.mod_id = g.mod_id
         WHERE im.instance_id = ?
         ORDER BY im.is_enabled DESC, im.file_name ASC;"
    )
    .bind(instance_id)
    .fetch_all(pool)
    .await?;

    if raw_rows.is_empty() {
        return Ok(Vec::new());
    }

    // 收集当前实例中所有的标识符，批量走索引查询关系表
    let mut instance_all_identifiers = std::collections::HashSet::new();
    for r in &raw_rows {
        if let Some(ref mid) = r.mod_id {
            let trimmed = mid.trim().to_lowercase();
            if !trimmed.is_empty() {
                instance_all_identifiers.insert(trimmed);
            }
        }
        let fn_trim = r.file_name.trim().to_lowercase();
        if !fn_trim.is_empty() {
            instance_all_identifiers.insert(fn_trim);
        }
        if let Some(ref pid) = r.source_project_id {
            let pid_trim = pid.trim().to_lowercase();
            if !pid_trim.is_empty() {
                instance_all_identifiers.insert(pid_trim);
            }
        }
        if let Some(version_key) = version_relation_key(
            r.source_platform.as_deref(),
            r.source_file_id.as_deref(),
        ) {
            instance_all_identifiers.insert(version_key);
        }
        if let Some(ref aliases_str) = r.aliases {
            if let Ok(arr) = serde_json::from_str::<Vec<String>>(aliases_str) {
                for a in arr {
                    let a_clean = a.trim().to_lowercase();
                    if !a_clean.is_empty() {
                        instance_all_identifiers.insert(a_clean);
                    }
                }
            }
        }
    }

    let identifiers_vec: Vec<String> = instance_all_identifiers.iter().cloned().collect();
    let forward_relations = query_mod_dependencies(pool, &identifiers_vec).await.unwrap_or_default();
    let reverse_relations = query_mod_dependents(pool, &identifiers_vec).await.unwrap_or_default();
    let version_relation_sources: std::collections::HashSet<String> = forward_relations
        .iter()
        .filter(|rel| rel.source_type == "version_id")
        .map(|rel| rel.source_identifier.to_lowercase())
        .collect();

    // 1. 构建前向必需依赖映射: source_id -> Vec<target_id>
    let mut forward_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for rel in forward_relations {
        if rel.relation_type == "required" {
            forward_map.entry(rel.source_identifier.to_lowercase()).or_default().push(rel.target_identifier);
        }
    }

    // 2. 构建反向附属映射: target_id -> Set of source_identifiers (仅限本实例已安装的 mod)
    let mut reverse_map: std::collections::HashMap<String, std::collections::HashSet<String>> = std::collections::HashMap::new();
    for rel in reverse_relations {
        let src_lower = rel.source_identifier.to_lowercase();
        if rel.relation_type == "required" && instance_all_identifiers.contains(&src_lower) {
            reverse_map.entry(rel.target_identifier.to_lowercase()).or_default().insert(src_lower);
        }
    }

    let result = raw_rows
        .into_iter()
        .map(|r| {
            let mut deps = Vec::new();
            let mut matched_dependents = std::collections::HashSet::new();

            let version_key = version_relation_key(
                r.source_platform.as_deref(),
                r.source_file_id.as_deref(),
            );
            let has_version_metadata = version_key
                .as_ref()
                .is_some_and(|key| version_relation_sources.contains(key));
            let mut keys = if has_version_metadata {
                version_key.map(Some).into_iter().collect()
            } else {
                vec![
                    r.mod_id.as_deref().map(|s| s.trim().to_lowercase()),
                    Some(r.file_name.trim().to_lowercase()),
                    r.source_project_id.as_deref().map(|s| s.trim().to_lowercase()),
                ]
            };
            if !has_version_metadata {
                if let Some(ref aliases_str) = r.aliases {
                    if let Ok(arr) = serde_json::from_str::<Vec<String>>(aliases_str) {
                        for a in arr {
                            let a_clean = a.trim().to_lowercase();
                            if !a_clean.is_empty() {
                                keys.push(Some(a_clean));
                            }
                        }
                    }
                }
            }

            for k in keys.into_iter().flatten() {
                let lower_k = k.trim().to_lowercase();
                if let Some(targets) = forward_map.get(&lower_k) {
                    for t in targets {
                        if !deps.contains(t) {
                            deps.push(t.clone());
                        }
                    }
                }
                if let Some(srcs) = reverse_map.get(&lower_k) {
                    for s in srcs {
                        matched_dependents.insert(s.clone());
                    }
                }
            }

            let dependents_count = matched_dependents.len() as i64;
            let dependencies = if deps.is_empty() { None } else { Some(deps) };

            EnrichedInstanceModRow {
                instance_id: instance_id.to_string(),
                file_name: r.file_name,
                is_enabled: r.is_enabled,
                file_size: r.file_size,
                modified_at: r.modified_at,
                sha1: r.sha1,
                curseforge_fingerprint: r.curseforge_fingerprint.map(|v| v as u32),
                mod_id: r.mod_id,
                name: r.name,
                version: r.version,
                description: r.description,
                icon_rel_path: r.icon_rel_path,
                icon_source: r.icon_source,
                aliases: r.aliases,
                source_platform: r.source_platform,
                source_project_id: r.source_project_id,
                source_file_id: r.source_file_id,
                dependents_count,
                dependencies,
            }
        })
        .collect();

    Ok(result)
}

pub async fn upsert_instance_mods(
    pool: &SqlitePool,
    instance_id: &str,
    mods: &[InstanceModDbRow],
) -> Result<(), sqlx::Error> {
    if mods.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();

    for m in mods {
        sqlx::query(
            "INSERT INTO instance_mods (
                instance_id, file_name, is_enabled, file_size, modified_at,
                sha1, curseforge_fingerprint, mod_id, version,
                source_platform, source_project_id, source_file_id, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(instance_id, file_name) DO UPDATE SET
                is_enabled = excluded.is_enabled,
                file_size = excluded.file_size,
                modified_at = excluded.modified_at,
                sha1 = COALESCE(excluded.sha1, instance_mods.sha1),
                curseforge_fingerprint = COALESCE(excluded.curseforge_fingerprint, instance_mods.curseforge_fingerprint),
                mod_id = COALESCE(excluded.mod_id, instance_mods.mod_id),
                version = COALESCE(excluded.version, instance_mods.version),
                source_platform = COALESCE(excluded.source_platform, instance_mods.source_platform),
                source_project_id = COALESCE(excluded.source_project_id, instance_mods.source_project_id),
                source_file_id = COALESCE(excluded.source_file_id, instance_mods.source_file_id),
                updated_at = excluded.updated_at;"
        )
        .bind(instance_id)
        .bind(&m.file_name)
        .bind(m.is_enabled)
        .bind(m.file_size)
        .bind(m.modified_at)
        .bind(&m.sha1)
        .bind(m.curseforge_fingerprint.map(|v| v as i64))
        .bind(&m.mod_id)
        .bind(&m.version)
        .bind(&m.source_platform)
        .bind(&m.source_project_id)
        .bind(&m.source_file_id)
        .bind(now)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}

pub async fn delete_instance_mods(
    pool: &SqlitePool,
    instance_id: &str,
    file_names: &[String],
) -> Result<(), sqlx::Error> {
    if file_names.is_empty() {
        return Ok(());
    }

    let placeholders = file_names.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "DELETE FROM instance_mods WHERE instance_id = ? AND file_name IN ({})",
        placeholders
    );

    let mut query = sqlx::query(&sql).bind(instance_id);
    for f in file_names {
        query = query.bind(f);
    }

    query.execute(pool).await?;
    Ok(())
}

pub async fn toggle_instance_mod(
    pool: &SqlitePool,
    instance_id: &str,
    old_file_name: &str,
    new_file_name: &str,
    is_enabled: bool,
) -> Result<(), sqlx::Error> {
    let now = chrono::Utc::now().timestamp();
    sqlx::query(
        "UPDATE instance_mods 
         SET file_name = ?, is_enabled = ?, updated_at = ?
         WHERE instance_id = ? AND file_name = ?;"
    )
    .bind(new_file_name)
    .bind(is_enabled)
    .bind(now)
    .bind(instance_id)
    .bind(old_file_name)
    .execute(pool)
    .await?;

    Ok(())
}

/// Applies a filesystem rename batch in one transaction. The caller performs the actual
/// renames first and only passes successful pairs, so SQLite cannot become the slowest step of
/// a large cascading disable.
pub async fn toggle_instance_mods_batch(
    pool: &SqlitePool,
    instance_id: &str,
    toggled: &[(String, String)],
    is_enabled: bool,
) -> Result<(), sqlx::Error> {
    if toggled.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();
    for (old_file_name, new_file_name) in toggled {
        sqlx::query(
            "UPDATE instance_mods
             SET file_name = ?, is_enabled = ?, updated_at = ?
             WHERE instance_id = ? AND file_name = ?;",
        )
        .bind(new_file_name)
        .bind(is_enabled)
        .bind(now)
        .bind(instance_id)
        .bind(old_file_name)
        .execute(&mut *tx)
        .await?;
    }
    tx.commit().await?;
    Ok(())
}

pub async fn update_mod_platform_matches_batch(
    pool: &SqlitePool,
    instance_id: &str,
    updates: &[super::models::ModPlatformMatchBatchItem],
) -> Result<(), sqlx::Error> {
    if updates.is_empty() {
        return Ok(());
    }

    let mut tx = pool.begin().await?;
    let now = chrono::Utc::now().timestamp();

    for item in updates {
        sqlx::query(
            "UPDATE instance_mods 
             SET source_platform = COALESCE(?, source_platform),
                 source_project_id = COALESCE(?, source_project_id),
                 source_file_id = COALESCE(?, source_file_id),
                 version = COALESCE(?, version),
                 updated_at = ?
             WHERE instance_id = ? AND file_name = ?;"
        )
        .bind(&item.source_platform)
        .bind(&item.source_project_id)
        .bind(&item.source_file_id)
        .bind(&item.version)
        .bind(now)
        .bind(instance_id)
        .bind(&item.file_name)
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(())
}
