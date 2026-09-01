use crate::domain::mod_manifest::ModMetadata;
use crate::services::config_service::ConfigService;
use crate::services::db_service::{
    models::{ModPlatformMatchBatchItem, ModRelationRecord},
    DbService,
};
use crate::services::instance::mod_manager::ModCacheUpdateItem;
use std::collections::{HashMap, HashSet};
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};

pub struct ModCloudSync;

fn version_relation_key(platform: &str, file_id: &str) -> Option<String> {
    let platform = platform.trim().to_lowercase();
    let file_id = file_id.trim().to_lowercase();
    (!platform.is_empty() && !file_id.is_empty())
        .then(|| format!("version:{platform}:{file_id}"))
}

impl ModCloudSync {
    pub async fn sync_instance_mods_cloud_metadata<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        force: bool,
        global_platform: Option<String>,
        curseforge_key: Option<String>,
        target_file_names: Option<&[String]>,
    ) -> Result<Vec<ModMetadata>, String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .build()
            .map_err(|e| e.to_string())?;

        let mut rows = DbService::query_instance_mods(&pool, instance_id)
            .await
            .map_err(|e| e.to_string())?;
        if let Some(file_names) = target_file_names.filter(|file_names| !file_names.is_empty()) {
            let wanted: HashSet<&str> = file_names.iter().map(String::as_str).collect();
            rows.retain(|row| wanted.contains(row.file_name.as_str()));
        }
        let current_version_keys: Vec<String> = rows
            .iter()
            .filter_map(|row| {
                version_relation_key(
                    row.source_platform.as_deref().unwrap_or_default(),
                    row.source_file_id.as_deref().unwrap_or_default(),
                )
            })
            .collect();
        let known_version_keys: HashSet<String> = DbService::query_mod_dependencies(
            &pool,
            &current_version_keys,
        )
        .await
        .unwrap_or_default()
        .into_iter()
        .filter(|relation| relation.source_type == "version_id")
        .map(|relation| relation.source_identifier.to_lowercase())
        .collect();
        // Keep dependency declarations single-source per archive. Explicit choices use
        // only that platform; auto tries Modrinth first and uses CurseForge only for files
        // that Modrinth did not identify.
        let selected_platform = match global_platform.as_deref().map(str::trim) {
            Some("modrinth") => "modrinth",
            Some("curseforge") => "curseforge",
            _ => "auto",
        };

        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        let shared_mods_dir = PathBuf::from(&base_path).join("shared_mods");
        let _icons_base_dir = shared_mods_dir.join("icons");

        // 1. 筛选需要进行 Modrinth SHA1 匹配的条目
        let sha1_mods: Vec<_> = if selected_platform != "curseforge" {
            rows
            .iter()
            .filter(|r| {
                if let Some(ref sha1) = r.sha1 {
                    if !sha1.trim().is_empty() {
                        return force
                            || r.source_platform.as_deref() != Some("modrinth")
                            || r.source_file_id.is_none()
                            || !version_relation_key("modrinth", r.source_file_id.as_deref().unwrap_or_default())
                                .is_some_and(|key| known_version_keys.contains(&key));
                    }
                }
                false
            })
            .collect()
        } else {
            Vec::new()
        };

        // 2. 读取 CurseForge 密钥。实际待查询条目会在 Modrinth 结果返回后再确定，
        //    这样 auto 不会将两个平台的依赖声明混合到同一个 Mod 上。
        let cf_api_key = curseforge_key
            .or_else(|| std::env::var("VITE_CURSEFORGE_API_KEY").ok())
            .or_else(|| std::env::var("CURSEFORGE_API_KEY").ok())
            .or_else(|| option_env!("CURSEFORGE_API_KEY").map(|s| s.to_string()))
            .or_else(|| option_env!("VITE_CURSEFORGE_API_KEY").map(|s| s.to_string()));

        let mut platform_updates: Vec<ModPlatformMatchBatchItem> = Vec::new();
        let mut cache_items: Vec<ModCacheUpdateItem> = Vec::new();
        let mut pending_relations: Vec<ModRelationRecord> = Vec::new();
        let mut modrinth_matched_files = HashSet::new();

        // ==========================================
        // 1. Modrinth 批量哈希查询与项目拉取
        // ==========================================
        if !sha1_mods.is_empty() {
            let hashes: Vec<String> = sha1_mods
                .iter()
                .filter_map(|r| r.sha1.clone())
                .collect();

            if let Ok(resp) = client
                .post("https://api.modrinth.com/v2/version_files")
                .json(&serde_json::json!({
                    "hashes": hashes,
                    "algorithm": "sha1"
                }))
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(match_map) = resp.json::<HashMap<String, serde_json::Value>>().await {
                        let mut project_ids_to_fetch = HashSet::new();

                        for (_hash, version) in &match_map {
                            if let Some(pid) = version["project_id"].as_str() {
                                project_ids_to_fetch.insert(pid.to_string());
                            }
                            if let Some(deps) = version["dependencies"].as_array() {
                                for d in deps {
                                    if let Some(d_pid) = d["project_id"].as_str() {
                                        project_ids_to_fetch.insert(d_pid.to_string());
                                    }
                                }
                            }
                        }

                        // 批量拉取 Modrinth 项目详情
                        let mut mr_projects_map: HashMap<String, serde_json::Value> = HashMap::new();
                        if !project_ids_to_fetch.is_empty() {
                            let ids_vec: Vec<String> = project_ids_to_fetch.into_iter().collect();
                            let ids_json = serde_json::to_string(&ids_vec).unwrap_or_default();
                            let url = format!("https://api.modrinth.com/v2/projects?ids={}", urlencoding::encode(&ids_json));
                            if let Ok(p_resp) = client.get(&url).send().await {
                                if p_resp.status().is_success() {
                                    if let Ok(p_list) = p_resp.json::<Vec<serde_json::Value>>().await {
                                        for p in p_list {
                                            if let Some(id) = p["id"].as_str() {
                                                mr_projects_map.insert(id.to_string(), p);
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        for r in &sha1_mods {
                            let sha1_str = r.sha1.as_deref().unwrap_or_default();
                            if let Some(version) = match_map.get(sha1_str) {
                                modrinth_matched_files.insert(r.file_name.clone());
                                let project_id = version["project_id"].as_str().unwrap_or_default();
                                let file_id = version["id"].as_str().unwrap_or_default();
                                let version_number = version["version_number"].as_str();

                                // Dependencies belong to a published file, not to every
                                // version of the project. Store an authoritative marker even
                                // when this version declares no dependencies so stale relations
                                // from older versions cannot be used as a fallback.
                                let relation_source = version_relation_key("modrinth", file_id);

                                platform_updates.push(ModPlatformMatchBatchItem {
                                    file_name: r.file_name.clone(),
                                    source_platform: Some("modrinth".to_string()),
                                    source_project_id: Some(project_id.to_string()),
                                    source_file_id: Some(file_id.to_string()),
                                    version: version_number.map(|s| s.to_string()),
                                });

                                if let Some(project) = mr_projects_map.get(project_id) {
                                    let title = project["title"].as_str().unwrap_or(&r.file_name);
                                    let desc = project["description"].as_str().unwrap_or("");
                                    let icon_url = project["icon_url"].as_str().unwrap_or("");

                                    cache_items.push(ModCacheUpdateItem {
                                        cache_key: format!("modrinth_{}", project_id),
                                        name: title.to_string(),
                                        desc: desc.to_string(),
                                        icon_url: icon_url.to_string(),
                                        mod_id: r.mod_id.clone(),
                                        curseforge_fingerprint: r.curseforge_fingerprint,
                                        modrinth_hash: Some(sha1_str.to_string()),
                                        curseforge_project_id: None,
                                        modrinth_project_id: Some(project_id.to_string()),
                                        refresh_icon: force,
                                    });
                                }

                                if let Some(ref source_identifier) = relation_source {
                                    pending_relations.push(ModRelationRecord {
                                        source_identifier: source_identifier.clone(),
                                        source_type: "version_id".to_string(),
                                        target_identifier: "__version_metadata__".to_string(),
                                        target_type: "metadata".to_string(),
                                        relation_type: "metadata".to_string(),
                                        version_requirement: None,
                                        target_name_hint: None,
                                        source_provider: "modrinth".to_string(),
                                    });
                                }

                                if let (Some(source_identifier), Some(deps)) =
                                    (relation_source.as_ref(), version["dependencies"].as_array())
                                {
                                    for d in deps {
                                        if let Some(d_pid) = d["project_id"].as_str() {
                                            let dep_type = d["dependency_type"].as_str().unwrap_or("required");
                                            pending_relations.push(ModRelationRecord {
                                                source_identifier: source_identifier.clone(),
                                                source_type: "version_id".to_string(),
                                                target_identifier: d_pid.to_string(),
                                                target_type: "modrinth".to_string(),
                                                relation_type: dep_type.to_string(),
                                                version_requirement: d["version_id"].as_str().map(|s| s.to_string()),
                                                target_name_hint: mr_projects_map.get(d_pid).and_then(|p| p["title"].as_str()).map(|s| s.to_string()),
                                                source_provider: "modrinth".to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // ==========================================
        // 2. CurseForge 批量指纹查询与项目拉取
        // ==========================================
        let cf_mods: Vec<_> = if selected_platform != "modrinth" && cf_api_key.is_some() {
            rows.iter()
                .filter(|row| {
                    if selected_platform == "auto" && modrinth_matched_files.contains(&row.file_name) {
                        return false;
                    }
                    let Some(fingerprint) = row.curseforge_fingerprint else {
                        return false;
                    };
                    fingerprint > 0
                        && (force
                            || row.source_platform.as_deref() != Some("curseforge")
                            || row.source_file_id.is_none()
                            || !version_relation_key(
                                "curseforge",
                                row.source_file_id.as_deref().unwrap_or_default(),
                            )
                            .is_some_and(|key| known_version_keys.contains(&key)))
                })
                .collect()
        } else {
            Vec::new()
        };
        if !cf_mods.is_empty() {
            if let Some(ref key) = cf_api_key {
                let fingerprints: Vec<u32> = cf_mods
                    .iter()
                    .filter_map(|r| r.curseforge_fingerprint)
                    .collect();

                if let Ok(resp) = client
                    .post("https://api.curseforge.com/v1/mods/fingerprints")
                    .header("x-api-key", key)
                    .json(&serde_json::json!({
                        "fingerprints": fingerprints
                    }))
                    .send()
                    .await
                {
                    if resp.status().is_success() {
                        if let Ok(cf_json) = resp.json::<serde_json::Value>().await {
                            if let Some(matches) = cf_json["data"]["exactMatches"].as_array() {
                                let mut cf_project_ids_to_fetch = HashSet::new();
                                let mut match_by_fp: HashMap<u32, serde_json::Value> = HashMap::new();

                                for m in matches {
                                    if let Some(fp) = m["id"].as_i64() {
                                        let file = &m["file"];
                                        match_by_fp.insert(fp as u32, file.clone());
                                        if let Some(mod_id_num) = file["modId"].as_i64() {
                                            cf_project_ids_to_fetch.insert(mod_id_num);
                                        }
                                    }
                                }

                                // 批量拉取 CurseForge 项目详情
                                let mut cf_projects_map: HashMap<i64, serde_json::Value> = HashMap::new();
                                if !cf_project_ids_to_fetch.is_empty() {
                                    let ids_vec: Vec<i64> = cf_project_ids_to_fetch.into_iter().collect();
                                    if let Ok(p_resp) = client
                                        .post("https://api.curseforge.com/v1/mods")
                                        .header("x-api-key", key)
                                        .json(&serde_json::json!({
                                            "modIds": ids_vec
                                        }))
                                        .send()
                                        .await
                                    {
                                        if p_resp.status().is_success() {
                                            if let Ok(p_json) = p_resp.json::<serde_json::Value>().await {
                                                if let Some(data) = p_json["data"].as_array() {
                                                    for p in data {
                                                        if let Some(id) = p["id"].as_i64() {
                                                            cf_projects_map.insert(id, p.clone());
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }

                                for r in &cf_mods {
                                    if let Some(fp) = r.curseforge_fingerprint {
                                        if let Some(file) = match_by_fp.get(&fp) {
                                            let mod_id_num = file["modId"].as_i64().unwrap_or(0);
                                            let file_id_num = file["id"].as_i64().unwrap_or(0);
                                            let display_name = file["displayName"].as_str();
                                            let relation_source = (file_id_num > 0)
                                                .then(|| version_relation_key("curseforge", &file_id_num.to_string()))
                                                .flatten();

                                            platform_updates.push(ModPlatformMatchBatchItem {
                                                file_name: r.file_name.clone(),
                                                source_platform: Some("curseforge".to_string()),
                                                source_project_id: Some(mod_id_num.to_string()),
                                                source_file_id: Some(file_id_num.to_string()),
                                                version: display_name.map(|s| s.to_string()),
                                            });

                                            if let Some(project) = cf_projects_map.get(&mod_id_num) {
                                                let title = project["name"].as_str().unwrap_or(&r.file_name);
                                                let summary = project["summary"].as_str().unwrap_or("");
                                                let icon_url = project["logo"]["thumbnailUrl"]
                                                    .as_str()
                                                    .or_else(|| project["logo"]["url"].as_str())
                                                    .unwrap_or("");

                                                cache_items.push(ModCacheUpdateItem {
                                                    cache_key: format!("curseforge_{}", mod_id_num),
                                                    name: title.to_string(),
                                                    desc: summary.to_string(),
                                                    icon_url: icon_url.to_string(),
                                                    mod_id: r.mod_id.clone(),
                                                    curseforge_fingerprint: Some(fp),
                                                    modrinth_hash: r.sha1.clone(),
                                                    curseforge_project_id: Some(mod_id_num.to_string()),
                                                    modrinth_project_id: None,
                                                    refresh_icon: force,
                                                });
                                            }

                                            if let Some(source_identifier) = relation_source {
                                                pending_relations.push(ModRelationRecord {
                                                    source_identifier: source_identifier.clone(),
                                                    source_type: "version_id".to_string(),
                                                    target_identifier: "__version_metadata__".to_string(),
                                                    target_type: "metadata".to_string(),
                                                    relation_type: "metadata".to_string(),
                                                    version_requirement: None,
                                                    target_name_hint: None,
                                                    source_provider: "curseforge".to_string(),
                                                });

                                                if let Some(dependencies) = file["dependencies"].as_array() {
                                                    for dependency in dependencies {
                                                        let Some(target_id) = dependency["modId"].as_i64() else {
                                                            continue;
                                                        };
                                                        let relation_type = match dependency["relationType"].as_i64() {
                                                            Some(3) => "required",
                                                            Some(5) => "incompatible",
                                                            Some(2) => "optional",
                                                            _ => "embedded",
                                                        };
                                                        pending_relations.push(ModRelationRecord {
                                                            source_identifier: source_identifier.clone(),
                                                            source_type: "version_id".to_string(),
                                                            target_identifier: target_id.to_string(),
                                                            target_type: "curseforge".to_string(),
                                                            relation_type: relation_type.to_string(),
                                                            version_requirement: None,
                                                            target_name_hint: None,
                                                            source_provider: "curseforge".to_string(),
                                                        });
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        // A provider project link and a provider archive match are different levels of
        // certainty. The latter can disappear when a jar is repacked or an old file is removed,
        // but the former is still enough to refresh display metadata. Do this only for files
        // without a fresh exact match, and honour an explicitly selected platform.
        let exact_matched_files: HashSet<&str> = platform_updates
            .iter()
            .map(|update| update.file_name.as_str())
            .collect();

        let linked_modrinth: Vec<_> = rows
            .iter()
            .filter(|row| !exact_matched_files.contains(row.file_name.as_str()))
            .filter(|_| selected_platform != "curseforge")
            .filter_map(|row| {
                (row.source_platform.as_deref()?.trim().eq_ignore_ascii_case("modrinth"))
                    .then_some((row, row.source_project_id.as_deref()?.trim()))
                    .filter(|(_, project_id)| !project_id.is_empty())
            })
            .collect();
        if !linked_modrinth.is_empty() {
            let project_ids: HashSet<&str> = linked_modrinth
                .iter()
                .map(|(_, project_id)| *project_id)
                .collect();
            let ids_json = serde_json::to_string(&project_ids.into_iter().collect::<Vec<_>>())
                .unwrap_or_default();
            let url = format!(
                "https://api.modrinth.com/v2/projects?ids={}",
                urlencoding::encode(&ids_json)
            );
            if let Ok(response) = client.get(url).send().await {
                if response.status().is_success() {
                    if let Ok(projects) = response.json::<Vec<serde_json::Value>>().await {
                        let project_map: HashMap<String, serde_json::Value> = projects
                            .into_iter()
                            .filter_map(|project| {
                                let id = project["id"].as_str()?.to_string();
                                Some((id, project))
                            })
                            .collect();
                        for (row, project_id) in linked_modrinth {
                            if let Some(project) = project_map.get(project_id) {
                                cache_items.push(ModCacheUpdateItem {
                                    cache_key: format!("modrinth_{project_id}"),
                                    name: project["title"].as_str().unwrap_or(&row.file_name).to_string(),
                                    desc: project["description"].as_str().unwrap_or_default().to_string(),
                                    icon_url: project["icon_url"].as_str().unwrap_or_default().to_string(),
                                    mod_id: row.mod_id.clone(),
                                    curseforge_fingerprint: row.curseforge_fingerprint,
                                    modrinth_hash: row.sha1.clone(),
                                    curseforge_project_id: None,
                                    modrinth_project_id: Some(project_id.to_string()),
                                    refresh_icon: force,
                                });
                            }
                        }
                    }
                }
            }
        }

        let linked_curseforge: Vec<_> = rows
            .iter()
            .filter(|row| !exact_matched_files.contains(row.file_name.as_str()))
            .filter(|_| selected_platform != "modrinth")
            .filter_map(|row| {
                let project_id = row.source_project_id.as_deref()?.trim().parse::<i64>().ok()?;
                (row.source_platform.as_deref()?.trim().eq_ignore_ascii_case("curseforge")
                    && project_id > 0)
                    .then_some((row, project_id))
            })
            .collect();
        if !linked_curseforge.is_empty() {
            if let Some(key) = cf_api_key.as_deref() {
                let project_ids: HashSet<i64> = linked_curseforge
                    .iter()
                    .map(|(_, project_id)| *project_id)
                    .collect();
                if let Ok(response) = client
                    .post("https://api.curseforge.com/v1/mods")
                    .header("x-api-key", key)
                    .json(&serde_json::json!({ "modIds": project_ids.into_iter().collect::<Vec<_>>() }))
                    .send()
                    .await
                {
                    if response.status().is_success() {
                        if let Ok(json) = response.json::<serde_json::Value>().await {
                            let project_map: HashMap<i64, serde_json::Value> = json["data"]
                                .as_array()
                                .into_iter()
                                .flatten()
                                .filter_map(|project| project["id"].as_i64().map(|id| (id, project.clone())))
                                .collect();
                            for (row, project_id) in linked_curseforge {
                                if let Some(project) = project_map.get(&project_id) {
                                    cache_items.push(ModCacheUpdateItem {
                                        cache_key: format!("curseforge_{project_id}"),
                                        name: project["name"].as_str().unwrap_or(&row.file_name).to_string(),
                                        desc: project["summary"].as_str().unwrap_or_default().to_string(),
                                        icon_url: project["logo"]["thumbnailUrl"]
                                            .as_str()
                                            .or_else(|| project["logo"]["url"].as_str())
                                            .unwrap_or_default()
                                            .to_string(),
                                        mod_id: row.mod_id.clone(),
                                        curseforge_fingerprint: row.curseforge_fingerprint,
                                        modrinth_hash: row.sha1.clone(),
                                        curseforge_project_id: Some(project_id.to_string()),
                                        modrinth_project_id: None,
                                        refresh_icon: force,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // ==========================================
        // 3. 批量持久化到 SQLite 数据库与图标下载
        // ==========================================
        if !cache_items.is_empty() {
            let _ = super::icon_storage::IconStorage::update_mod_cache_batch(app, cache_items).await;
        }

        if !platform_updates.is_empty() {
            let _ = DbService::update_mod_platform_matches_batch(&pool, instance_id, &platform_updates).await;
        }

        if !pending_relations.is_empty() {
            let _ = DbService::save_mod_relations(&pool, &pending_relations).await;
        }

        // 4. Cloud sync has already updated SQLite. Do not parse every JAR again just to
        // build a response for a targeted request; that turned one-mod re-identification
        // into a global scan and could trigger fallback metadata work for other mods.
        let mut synced_mods = super::ModManagerService::get_mod_manifest_cache(app, instance_id).await?;
        if let Some(file_names) = target_file_names.filter(|file_names| !file_names.is_empty()) {
            let wanted: HashSet<&str> = file_names.iter().map(String::as_str).collect();
            synced_mods.retain(|mod_meta| wanted.contains(mod_meta.file_name.as_str()));
        }
        Ok(synced_mods)
    }
}
