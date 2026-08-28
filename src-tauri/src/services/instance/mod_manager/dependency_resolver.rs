use crate::domain::mod_health::{
    ConflictPairInfo, DependencySummaryInfo, InstanceDependencyHealth, MissingDependencyInfo,
};
use crate::services::db_service::DbService;
use std::collections::HashMap;
use tauri::{AppHandle, Manager, Runtime};

pub struct DependencyResolver;

pub const SYSTEM_KEYWORDS: &[&str] = &[
    "minecraft", "fabricloader", "quiltloader", "quilt_loader", "forge_loader", "neoforge_loader",
    "java", "all", "v", "none", "null", ""
];

impl DependencyResolver {
    pub fn is_system_keyword(s: &str) -> bool {
        let clean = s.trim().to_lowercase();
        clean.is_empty() || SYSTEM_KEYWORDS.contains(&clean.as_str())
    }

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

        // Strip trailing version pattern again if loader was in middle (but not for curseforge_xxx or modrinth_xxx)
        if !clean.starts_with("curseforge") && !clean.starts_with("modrinth") {
            if let Ok(re) = regex::Regex::new(r#"[-_+v][0-9].*$"#) {
                clean = re.replace(&clean, "").to_string();
            }

            for suffix in ["-fabric", "_fabric", "-forge", "_forge", "-neoforge", "_neoforge", "-quilt", "_quilt"] {
                if clean.ends_with(suffix) {
                    clean = clean[..clean.len() - suffix.len()].to_string();
                }
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

        if Self::is_system_keyword(&clean) {
            return String::new();
        }

        clean
    }

    pub async fn get_instance_dependency_health<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<InstanceDependencyHealth, String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();

        let rows = DbService::query_instance_mods(&pool, instance_id)
            .await
            .map_err(|e| e.to_string())?;

        // 1. Build bidirectional canonical <-> alias maps from SQLite
        let mut alias_to_canon: HashMap<String, String> = HashMap::new();
        let mut canon_to_aliases: HashMap<String, std::collections::HashSet<String>> = HashMap::new();

        if let Ok(alias_rows) = sqlx::query_as::<_, (String, String, Option<String>)>(
            "SELECT alias, canonical_mod_id, display_name FROM mod_aliases"
        ).fetch_all(&pool).await {
            for (alias, canon, disp) in alias_rows {
                let a_low = alias.trim().to_lowercase();
                let c_low = canon.trim().to_lowercase();
                if Self::is_system_keyword(&a_low) || Self::is_system_keyword(&c_low) {
                    continue;
                }
                alias_to_canon.insert(a_low.clone(), c_low.clone());
                canon_to_aliases.entry(c_low.clone()).or_default().insert(a_low);
                if let Some(d) = disp {
                    let d_low = d.trim().to_lowercase();
                    if !Self::is_system_keyword(&d_low) {
                        canon_to_aliases.entry(c_low).or_default().insert(d_low);
                    }
                }
            }
        }

        if let Ok(meta_rows) = sqlx::query_as::<_, (String, Option<String>, Option<String>, Option<String>, Option<String>)>(
            "SELECT mod_id, curseforge_project_id, modrinth_project_id, name, aliases FROM mod_global_metadata_cache"
        ).fetch_all(&pool).await {
            for (mid, cf_pid, mr_pid, gname, galiases) in meta_rows {
                let mut keys = vec![Some(mid.clone()), cf_pid, mr_pid, gname];
                if let Some(ga) = galiases {
                    if let Ok(arr) = serde_json::from_str::<Vec<String>>(&ga) {
                        for a in arr {
                            keys.push(Some(a));
                        }
                    }
                }
                let valid_keys: Vec<String> = keys
                    .into_iter()
                    .flatten()
                    .map(|k| k.trim().to_lowercase())
                    .filter(|k| !Self::is_system_keyword(k))
                    .collect();

                if let Some(primary) = valid_keys.first().cloned() {
                    for k in &valid_keys {
                        alias_to_canon.entry(k.clone()).or_insert_with(|| primary.clone());
                        for other in &valid_keys {
                            canon_to_aliases.entry(k.clone()).or_default().insert(other.clone());
                        }
                    }
                }
            }
        }

        // 2. Build Multi-Key Index for all installed mods
        let mut installed_exact_to_files: HashMap<String, Vec<String>> = HashMap::new();
        let mut installed_norm_to_files: HashMap<String, Vec<String>> = HashMap::new();
        let mut all_source_identifiers = std::collections::HashSet::new();

        let mut register_installed_alias = |exact_key: &str, file_name: &str| {
            let exact_clean = exact_key.trim().to_lowercase();
            if Self::is_system_keyword(&exact_clean) {
                return;
            }
            let files = installed_exact_to_files.entry(exact_clean.clone()).or_default();
            if !files.contains(&file_name.to_string()) {
                files.push(file_name.to_string());
            }

            let norm = Self::normalize_mod_identifier(&exact_clean);
            if !norm.is_empty() && !Self::is_system_keyword(&norm) {
                let n_files = installed_norm_to_files.entry(norm).or_default();
                if !n_files.contains(&file_name.to_string()) {
                    n_files.push(file_name.to_string());
                }
            }
        };

        for r in &rows {
            let file_name = &r.file_name;
            let mut keys_to_expand = std::collections::HashSet::new();

            let base_file = file_name.trim_end_matches(".disabled").trim_end_matches(".jar").to_lowercase();
            keys_to_expand.insert(base_file.clone());
            all_source_identifiers.insert(base_file);

            if let Some(ref mid) = r.mod_id {
                let mid_clean = mid.trim().to_lowercase();
                if !Self::is_system_keyword(&mid_clean) {
                    keys_to_expand.insert(mid_clean.clone());
                    all_source_identifiers.insert(mid_clean);
                }
            }

            if let Some(ref pid) = r.source_project_id {
                let pid_clean = pid.trim().to_lowercase();
                if !Self::is_system_keyword(&pid_clean) {
                    keys_to_expand.insert(pid_clean.clone());
                    all_source_identifiers.insert(pid_clean);
                }
            }

            if let Some(ref name) = r.name {
                let name_clean = name.trim().to_lowercase();
                if !Self::is_system_keyword(&name_clean) {
                    keys_to_expand.insert(name_clean.clone());
                    all_source_identifiers.insert(name_clean);
                }
            }

            if let Some(ref aliases_str) = r.aliases {
                if let Ok(arr) = serde_json::from_str::<Vec<String>>(aliases_str) {
                    for a in arr {
                        let a_clean = a.trim().to_lowercase();
                        if !Self::is_system_keyword(&a_clean) {
                            keys_to_expand.insert(a_clean.clone());
                            all_source_identifiers.insert(a_clean);
                        }
                    }
                }
            }

            // Expand with all known aliases
            let initial_keys: Vec<String> = keys_to_expand.iter().cloned().collect();
            for k in initial_keys {
                if let Some(canon) = alias_to_canon.get(&k) {
                    if !Self::is_system_keyword(canon) {
                        keys_to_expand.insert(canon.clone());
                    }
                    if let Some(aliases) = canon_to_aliases.get(canon) {
                        for a in aliases {
                            if !Self::is_system_keyword(a) {
                                keys_to_expand.insert(a.clone());
                            }
                        }
                    }
                }
                if let Some(aliases) = canon_to_aliases.get(&k) {
                    for a in aliases {
                        if !Self::is_system_keyword(a) {
                            keys_to_expand.insert(a.clone());
                        }
                    }
                }
            }

            for k in keys_to_expand {
                register_installed_alias(&k, file_name);
                all_source_identifiers.insert(k);
            }
        }

        let all_src_vec: Vec<String> = all_source_identifiers.into_iter().collect();
        let mut forward_relations = DbService::query_mod_dependencies(&pool, &all_src_vec)
            .await
            .unwrap_or_default();

        for r in &rows {
            if let Some(ref deps) = r.dependencies {
                let src_id = r.mod_id.as_deref().unwrap_or(&r.file_name);
                for d in deps {
                    let d_clean = d.trim().to_lowercase();
                    if Self::is_system_keyword(&d_clean) {
                        continue;
                    }
                    if !forward_relations.iter().any(|rel| {
                        rel.source_identifier.eq_ignore_ascii_case(src_id)
                            && rel.target_identifier.eq_ignore_ascii_case(&d_clean)
                    }) {
                        forward_relations.push(crate::services::db_service::models::ModRelationRecord {
                            source_identifier: src_id.to_string(),
                            source_type: "mod_id".to_string(),
                            target_identifier: d.clone(),
                            target_type: "mod_id".to_string(),
                            relation_type: "required".to_string(),
                            version_requirement: None,
                            target_name_hint: None,
                            source_provider: "jar_metadata".to_string(),
                        });
                    }
                }
            }
        }

        let mut missing_dependencies: HashMap<String, Vec<MissingDependencyInfo>> = HashMap::new();
        let mut instance_dependents: HashMap<String, Vec<String>> = HashMap::new();
        let mut declared_dependencies: HashMap<String, Vec<DependencySummaryInfo>> = HashMap::new();
        let mut conflicts: Vec<ConflictPairInfo> = Vec::new();

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
            let tgt_lower = rel.target_identifier.trim().to_lowercase();
            if Self::is_system_keyword(&tgt_lower) {
                continue;
            }

            let src_lower = rel.source_identifier.trim().to_lowercase();
            let src_norm = Self::normalize_mod_identifier(&src_lower);
            let tgt_norm = Self::normalize_mod_identifier(&tgt_lower);

            // Find source files (by exact match or normalized match)
            let source_files = installed_exact_to_files.get(&src_lower)
                .or_else(|| {
                    if !src_norm.is_empty() {
                        installed_norm_to_files.get(&src_norm)
                    } else {
                        None
                    }
                })
                .cloned()
                .unwrap_or_default();

            if source_files.is_empty() {
                continue;
            }

            // Expand target aliases to check installation
            let mut target_candidate_keys = std::collections::HashSet::new();
            target_candidate_keys.insert(tgt_lower.clone());
            if !tgt_norm.is_empty() {
                target_candidate_keys.insert(tgt_norm.clone());
            }

            if let Some(canon) = alias_to_canon.get(&tgt_lower) {
                if !Self::is_system_keyword(canon) {
                    target_candidate_keys.insert(canon.clone());
                    let cn = Self::normalize_mod_identifier(canon);
                    if !cn.is_empty() {
                        target_candidate_keys.insert(cn);
                    }
                }
                if let Some(aliases) = canon_to_aliases.get(canon) {
                    for a in aliases {
                        if !Self::is_system_keyword(a) {
                            target_candidate_keys.insert(a.clone());
                            let an = Self::normalize_mod_identifier(a);
                            if !an.is_empty() {
                                target_candidate_keys.insert(an);
                            }
                        }
                    }
                }
            }
            if let Some(aliases) = canon_to_aliases.get(&tgt_lower) {
                for a in aliases {
                    if !Self::is_system_keyword(a) {
                        target_candidate_keys.insert(a.clone());
                        let an = Self::normalize_mod_identifier(a);
                        if !an.is_empty() {
                            target_candidate_keys.insert(an);
                        }
                    }
                }
            }

            let mut matched_target_files: Vec<String> = Vec::new();
            for tk in &target_candidate_keys {
                if let Some(files) = installed_exact_to_files.get(tk) {
                    for f in files {
                        if !matched_target_files.contains(f) {
                            matched_target_files.push(f.clone());
                        }
                    }
                }
                if let Some(files) = installed_norm_to_files.get(tk) {
                    for f in files {
                        if !matched_target_files.contains(f) {
                            matched_target_files.push(f.clone());
                        }
                    }
                }
            }

            let is_target_installed = !matched_target_files.is_empty();
            let target_files = if is_target_installed { Some(matched_target_files) } else { None };

            let target_name_hint = rel.target_name_hint.clone().or_else(|| {
                alias_to_canon.get(&tgt_lower).cloned()
            });

            let canonical_target_key = alias_to_canon.get(&tgt_lower)
                .cloned()
                .unwrap_or_else(|| if !tgt_norm.is_empty() { tgt_norm.clone() } else { tgt_lower.clone() });

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
