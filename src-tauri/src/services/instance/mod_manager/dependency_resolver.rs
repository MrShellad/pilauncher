use crate::domain::mod_health::{
    ConflictPairInfo, DependencySummaryInfo, InstanceDependencyHealth, MissingDependencyInfo,
};
use crate::services::db_service::DbService;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, Runtime};

pub struct DependencyResolver;

impl DependencyResolver {
    pub fn normalize_mod_identifier(id: &str) -> String {
        let mut clean = id.trim().to_lowercase();
        if clean.ends_with(".disabled") {
            clean = clean[..clean.len() - 9].to_string();
        }
        if clean.ends_with(".jar") {
            clean = clean[..clean.len() - 4].to_string();
        }
        if clean.ends_with(".zip") {
            clean = clean[..clean.len() - 4].to_string();
        }

        // Strip trailing version pattern like -1.20.1-1.0.0, +1.20.1, -v1.0.0, -11.1.106, etc.
        if let Ok(re) = regex::Regex::new(r#"[-_+v](?:[0-9]+\.)+[0-9]+.*$"#) {
            clean = re.replace(&clean, "").to_string();
        }

        // Strip loader prefixes / suffixes: -fabric, _fabric, -forge, _forge, -neoforge, _neoforge, -quilt, _quilt
        for suffix in ["-fabric", "_fabric", "-forge", "_forge", "-neoforge", "_neoforge", "-quilt", "_quilt"] {
            if clean.ends_with(suffix) {
                clean = clean[..clean.len() - suffix.len()].to_string();
            }
        }

        // Strip trailing version pattern again if loader was in middle
        if let Ok(re) = regex::Regex::new(r#"[-_+v][0-9].*$"#) {
            clean = re.replace(&clean, "").to_string();
        }

        for suffix in ["-fabric", "_fabric", "-forge", "_forge", "-neoforge", "_neoforge", "-quilt", "_quilt"] {
            if clean.ends_with(suffix) {
                clean = clean[..clean.len() - suffix.len()].to_string();
            }
        }

        // Remove all dashes '-', underscores '_', dots '.', spaces ' '
        clean = clean.replace(['-', '_', '.', ' '], "");

        // Strip trailing version tag if any like 'v2', '2' (e.g. clothconfig2 -> clothconfig)
        if clean.ends_with("v2") && clean.len() > 3 {
            clean = clean[..clean.len() - 2].to_string();
        } else if clean.ends_with('2') && clean.len() > 3 {
            clean = clean[..clean.len() - 1].to_string();
        }

        clean
    }

    pub async fn get_instance_dependency_health<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<InstanceDependencyHealth, String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();

        let mods = super::ModManagerService::get_mod_manifest_cache(app, instance_id).await?;

        // 1. Gather all mod_ids and candidate keys of installed mods
        let mut installed_mod_ids = Vec::new();
        let mut initial_candidate_keys = Vec::new();

        for m in &mods {
            let base_file = m.file_name.trim_end_matches(".disabled").trim_end_matches(".jar").to_lowercase();
            initial_candidate_keys.push(base_file);

            if let Some(ref mid) = m.mod_id {
                let mid_clean = mid.trim().to_lowercase();
                if !mid_clean.is_empty() {
                    installed_mod_ids.push(mid_clean.clone());
                    initial_candidate_keys.push(mid_clean);
                }
            }
            if let Some(ref name) = m.name {
                let name_clean = name.trim().to_lowercase();
                if !name_clean.is_empty() {
                    initial_candidate_keys.push(name_clean);
                }
            }
            if let Some(ref entry) = m.manifest_entry {
                if let Some(ref pid) = entry.source.project_id {
                    let pid_clean = pid.trim().to_lowercase();
                    if !pid_clean.is_empty() {
                        initial_candidate_keys.push(pid_clean);
                    }
                }
                for (_, matched) in &entry.matched_platforms {
                    if let Some(ref pid) = matched.project_id {
                        let pid_clean = pid.trim().to_lowercase();
                        if !pid_clean.is_empty() {
                            initial_candidate_keys.push(pid_clean);
                        }
                    }
                }
            }
        }
        installed_mod_ids.sort();
        installed_mod_ids.dedup();
        initial_candidate_keys.sort();
        initial_candidate_keys.dedup();

        // 2. Query SQLite metadata cache for cross-platform IDs and DB aliases
        let mut db_cross_platform_map: HashMap<String, (Option<String>, Option<String>, Option<String>)> = HashMap::new();
        if !installed_mod_ids.is_empty() {
            let placeholders = installed_mod_ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let query_str = format!(
                "SELECT mod_id, modrinth_project_id, curseforge_project_id, name FROM mod_global_metadata_cache WHERE LOWER(mod_id) IN ({})",
                placeholders
            );
            let mut sql_query = sqlx::query(&query_str);
            for mid in &installed_mod_ids {
                sql_query = sql_query.bind(mid);
            }
            if let Ok(rows) = sql_query.fetch_all(&pool).await {
                use sqlx::Row;
                for row in rows {
                    let mid: String = row.get("mod_id");
                    let mr_pid: Option<String> = row.get("modrinth_project_id");
                    let cf_pid: Option<String> = row.get("curseforge_project_id");
                    let name: Option<String> = row.get("name");
                    db_cross_platform_map.insert(mid.to_lowercase(), (mr_pid, cf_pid, name));
                }
            }
        }

        // Query all known aliases for installed mod IDs from SQLite mod_aliases table
        let db_aliases_by_mod_id = DbService::query_aliases_for_mod_ids(&pool, &installed_mod_ids)
            .await
            .unwrap_or_default();

        let db_alias_mappings = DbService::query_mod_aliases(&pool, &initial_candidate_keys)
            .await
            .unwrap_or_default();

        // 3. Build Multi-Key Index for all installed mods
        let mut installed_exact_to_files: HashMap<String, Vec<String>> = HashMap::new();
        let mut installed_norm_to_files: HashMap<String, Vec<String>> = HashMap::new();
        let mut all_source_identifiers = Vec::new();

        let mut register_installed_alias = |exact_key: &str, file_name: &str| {
            let exact_clean = exact_key.trim().to_lowercase();
            if exact_clean.is_empty() {
                return;
            }
            let files = installed_exact_to_files.entry(exact_clean.clone()).or_default();
            if !files.contains(&file_name.to_string()) {
                files.push(file_name.to_string());
            }

            let norm = Self::normalize_mod_identifier(&exact_clean);
            if !norm.is_empty() {
                let n_files = installed_norm_to_files.entry(norm).or_default();
                if !n_files.contains(&file_name.to_string()) {
                    n_files.push(file_name.to_string());
                }
            }
        };

        for m in &mods {
            let file_name = &m.file_name;
            let base_file = file_name.trim_end_matches(".disabled").trim_end_matches(".jar").to_lowercase();
            register_installed_alias(&base_file, file_name);

            if let Some(ref mid) = m.mod_id {
                let mid_clean = mid.trim().to_lowercase();
                if !mid_clean.is_empty() {
                    register_installed_alias(&mid_clean, file_name);
                    all_source_identifiers.push(mid_clean.clone());

                    // Inject DB aliases from mod_aliases
                    if let Some(aliases) = db_aliases_by_mod_id.get(&mid_clean) {
                        for a in aliases {
                            register_installed_alias(a, file_name);
                            all_source_identifiers.push(a.clone());
                        }
                    }

                    // Inject DB cross-platform project IDs from mod_global_metadata_cache
                    if let Some((mr_pid, cf_pid, db_name)) = db_cross_platform_map.get(&mid_clean) {
                        if let Some(ref pid) = mr_pid {
                            register_installed_alias(pid, file_name);
                            all_source_identifiers.push(pid.clone());
                        }
                        if let Some(ref pid) = cf_pid {
                            register_installed_alias(pid, file_name);
                            all_source_identifiers.push(pid.clone());
                        }
                        if let Some(ref name) = db_name {
                            register_installed_alias(name, file_name);
                        }
                    }
                }
            }

            if let Some(ref name) = m.name {
                register_installed_alias(name, file_name);
            }

            if let Some(ref entry) = m.manifest_entry {
                if let Some(ref pid) = entry.source.project_id {
                    let pid_clean = pid.trim().to_string();
                    if !pid_clean.is_empty() {
                        register_installed_alias(&pid_clean, file_name);
                        all_source_identifiers.push(pid_clean);
                    }
                }
                for (_, matched) in &entry.matched_platforms {
                    if let Some(ref pid) = matched.project_id {
                        let pid_clean = pid.trim().to_string();
                        if !pid_clean.is_empty() {
                            register_installed_alias(&pid_clean, file_name);
                            all_source_identifiers.push(pid_clean);
                        }
                    }
                }
            }

            if let Some(ref aliases) = m.aliases {
                for a in aliases {
                    register_installed_alias(a, file_name);
                    all_source_identifiers.push(a.clone());
                }
            }

            // Register any matching canonical aliases from db_alias_mappings
            if let Some((canon_id, canon_name)) = db_alias_mappings.get(&base_file) {
                register_installed_alias(canon_id, file_name);
                register_installed_alias(canon_name, file_name);
            }
        }

        all_source_identifiers.sort();
        all_source_identifiers.dedup();

        let forward_relations = DbService::query_mod_dependencies(&pool, &all_source_identifiers)
            .await
            .unwrap_or_default();

        let mut missing_dependencies: HashMap<String, Vec<MissingDependencyInfo>> = HashMap::new();
        let mut instance_dependents: HashMap<String, Vec<String>> = HashMap::new();
        let mut declared_dependencies: HashMap<String, Vec<DependencySummaryInfo>> = HashMap::new();
        let mut conflicts: Vec<ConflictPairInfo> = Vec::new();

        let is_system_dep = |id: &str| {
            let lower = id.to_lowercase();
            lower == "minecraft" || lower == "fabricloader" || lower == "quilt_loader" || lower == "java"
        };

        // 4. Pre-query SQLite mod_aliases and mod_global_metadata_cache for target Project IDs
        let mut target_ids_to_resolve = Vec::new();
        for rel in &forward_relations {
            let tgt_lower = rel.target_identifier.trim().to_lowercase();
            if !is_system_dep(&tgt_lower) && !installed_exact_to_files.contains_key(&tgt_lower) {
                target_ids_to_resolve.push(tgt_lower);
            }
        }
        target_ids_to_resolve.sort();
        target_ids_to_resolve.dedup();

        let mut target_alias_map = DbService::query_mod_aliases(&pool, &target_ids_to_resolve)
            .await
            .unwrap_or_default();

        let mut target_id_to_mod_id: HashMap<String, (String, String)> = HashMap::new();
        if !target_ids_to_resolve.is_empty() {
            let placeholders = target_ids_to_resolve.iter().map(|_| "?").collect::<Vec<_>>().join(",");
            let query_str = format!(
                "SELECT curseforge_project_id, modrinth_project_id, mod_id, name FROM mod_global_metadata_cache 
                 WHERE curseforge_project_id IN ({}) OR LOWER(modrinth_project_id) IN ({})",
                placeholders, placeholders
            );
            let mut sql_query = sqlx::query(&query_str);
            for id in &target_ids_to_resolve {
                sql_query = sql_query.bind(id);
            }
            for id in &target_ids_to_resolve {
                sql_query = sql_query.bind(id);
            }
            if let Ok(rows) = sql_query.fetch_all(&pool).await {
                use sqlx::Row;
                for row in rows {
                    let cf_pid: Option<String> = row.get("curseforge_project_id");
                    let mr_pid: Option<String> = row.get("modrinth_project_id");
                    let mid: String = row.get("mod_id");
                    let name: Option<String> = row.get("name");
                    let name_str = name.unwrap_or_else(|| mid.clone());

                    if let Some(cf) = cf_pid {
                        target_id_to_mod_id.insert(cf.trim().to_lowercase(), (mid.clone(), name_str.clone()));
                    }
                    if let Some(mr) = mr_pid {
                        target_id_to_mod_id.insert(mr.trim().to_lowercase(), (mid.clone(), name_str.clone()));
                    }
                }
            }
        }

        // Merge target alias mapping
        for (tgt_id, (canon_id, display_name)) in target_alias_map.drain() {
            target_id_to_mod_id.entry(tgt_id).or_insert((canon_id, display_name));
        }

        struct EvalDep {
            target_identifier: String,
            target_name_hint: Option<String>,
            relation_type: String,
            version_requirement: Option<String>,
            is_installed: bool,
            target_files: Option<Vec<String>>,
        }

        let mut file_dep_groups: HashMap<String, HashMap<String, EvalDep>> = HashMap::new();

        for rel in forward_relations {
            let src_lower = rel.source_identifier.trim().to_lowercase();
            let src_norm = Self::normalize_mod_identifier(&src_lower);
            let tgt_lower = rel.target_identifier.trim().to_lowercase();
            let tgt_norm = Self::normalize_mod_identifier(&tgt_lower);

            if is_system_dep(&tgt_lower) {
                continue;
            }

            // Find source files (by exact match or normalized match)
            let source_files = installed_exact_to_files.get(&src_lower)
                .or_else(|| installed_norm_to_files.get(&src_norm))
                .cloned()
                .unwrap_or_default();

            if source_files.is_empty() {
                continue;
            }

            // Resolve target mod_id and title from SQLite metadata and alias tables
            let mut target_name_hint = rel.target_name_hint.clone();
            let db_resolved = target_id_to_mod_id.get(&tgt_lower);
            if let Some((_resolved_mid, resolved_name)) = db_resolved {
                if target_name_hint.is_none() || target_name_hint.as_ref().map(|s| s.is_empty() || s.chars().all(|c| c.is_ascii_digit())).unwrap_or(false) {
                    target_name_hint = Some(resolved_name.clone());
                }
            }

            // Canonical key for grouping identical targets
            let canonical_target_key = if let Some((resolved_mid, _)) = db_resolved {
                Self::normalize_mod_identifier(resolved_mid)
            } else if let Some(ref hint) = target_name_hint {
                let h_norm = Self::normalize_mod_identifier(hint);
                if !h_norm.is_empty() && !h_norm.chars().all(|c| c.is_ascii_digit()) {
                    h_norm
                } else {
                    tgt_norm.clone()
                }
            } else {
                tgt_norm.clone()
            };

            // Find matching target installed files (exact -> normalized -> canonical DB resolved)
            let target_files = if let Some(files) = installed_exact_to_files.get(&tgt_lower) {
                Some(files.clone())
            } else if let Some(files) = installed_norm_to_files.get(&tgt_norm) {
                Some(files.clone())
            } else if let Some((resolved_mid, _)) = db_resolved {
                let r_lower = resolved_mid.to_lowercase();
                let r_norm = Self::normalize_mod_identifier(&r_lower);
                installed_exact_to_files.get(&r_lower)
                    .or_else(|| installed_norm_to_files.get(&r_norm))
                    .cloned()
            } else {
                None
            };

            let is_target_installed = target_files.is_some();

            for src_file in &source_files {
                let group = file_dep_groups.entry(src_file.clone()).or_default();
                if let Some(existing) = group.get_mut(&canonical_target_key) {
                    // Merge: if any alias is installed, the combined dependency is installed
                    if is_target_installed {
                        existing.is_installed = true;
                        if existing.target_files.is_none() {
                            existing.target_files = target_files.clone();
                        }
                    }
                    // Keep the most informative name hint
                    if existing.target_name_hint.is_none() || existing.target_name_hint.as_ref().map(|s| s.chars().all(|c| c.is_ascii_digit())).unwrap_or(false) {
                        if target_name_hint.is_some() {
                            existing.target_name_hint = target_name_hint.clone();
                        }
                    }
                    if existing.target_identifier.chars().all(|c| c.is_ascii_digit()) && !rel.target_identifier.chars().all(|c| c.is_ascii_digit()) {
                        existing.target_identifier = rel.target_identifier.clone();
                    }
                } else {
                    group.insert(canonical_target_key.clone(), EvalDep {
                        target_identifier: rel.target_identifier.clone(),
                        target_name_hint: target_name_hint.clone(),
                        relation_type: rel.relation_type.clone(),
                        version_requirement: rel.version_requirement.clone(),
                        is_installed: is_target_installed,
                        target_files: target_files.clone(),
                    });
                }
            }
        }

        // Build final deduplicated declared & missing dependencies
        for (src_file, group) in file_dep_groups {
            for (_canon_key, dep) in group {
                declared_dependencies.entry(src_file.clone()).or_default().push(DependencySummaryInfo {
                    target_identifier: dep.target_identifier.clone(),
                    target_name_hint: dep.target_name_hint.clone(),
                    relation_type: dep.relation_type.clone(),
                    is_installed_in_instance: dep.is_installed,
                });

                if dep.relation_type == "required" {
                    if !dep.is_installed {
                        missing_dependencies.entry(src_file.clone()).or_default().push(MissingDependencyInfo {
                            target_identifier: dep.target_identifier.clone(),
                            target_name_hint: dep.target_name_hint.clone(),
                            version_requirement: dep.version_requirement.clone(),
                            relation_type: dep.relation_type.clone(),
                        });
                    } else if let Some(ref tgt_files) = dep.target_files {
                        for tgt_file in tgt_files {
                            if tgt_file != &src_file {
                                let list = instance_dependents.entry(tgt_file.clone()).or_default();
                                if !list.contains(&src_file) {
                                    list.push(src_file.clone());
                                }
                            }
                        }
                    }
                } else if dep.relation_type == "incompatible" && dep.is_installed {
                    if let Some(ref tgt_files) = dep.target_files {
                        for tgt_file in tgt_files {
                            if tgt_file != &src_file {
                                conflicts.push(ConflictPairInfo {
                                    mod_a_file_name: src_file.clone(),
                                    mod_b_file_name: tgt_file.clone(),
                                    reason: dep.target_name_hint.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }

        Ok(InstanceDependencyHealth {
            missing_dependencies,
            instance_dependents,
            declared_dependencies,
            conflicts,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_mod_identifier() {
        assert_eq!(DependencyResolver::normalize_mod_identifier("cloth-config"), "clothconfig");
        assert_eq!(DependencyResolver::normalize_mod_identifier("cloth_config"), "clothconfig");
        assert_eq!(DependencyResolver::normalize_mod_identifier("cloth-config2"), "clothconfig");
        assert_eq!(DependencyResolver::normalize_mod_identifier("cloth-config-v2"), "clothconfig");
        assert_eq!(DependencyResolver::normalize_mod_identifier("cloth-config-fabric-11.1.106.jar"), "clothconfig");
        assert_eq!(DependencyResolver::normalize_mod_identifier("architectury-fabric"), "architectury");
        assert_eq!(DependencyResolver::normalize_mod_identifier("jei-1.20.1-forge-15.0.jar"), "jei");
        assert_eq!(DependencyResolver::normalize_mod_identifier("sodium-fabric.disabled"), "sodium");
    }
}
