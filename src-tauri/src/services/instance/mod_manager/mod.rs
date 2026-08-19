pub mod dependency_resolver;
pub mod gamepad;
pub mod icon_storage;
pub mod installer;
pub mod jar_parser;
pub mod remote_fetcher;

pub use crate::domain::gamepad::{GamepadMeta, GamepadModMeta, GamepadModStatus};
pub use crate::domain::mod_cleanup::{
    ModFileNameCleanupFailure, ModFileNameCleanupItem, ModFileNameCleanupProgress,
    ModFileNameCleanupResult,
};
pub use crate::domain::mod_health::{
    ConflictPairInfo, DependencySummaryInfo, InstanceDependencyHealth, MissingDependencyInfo,
};
pub use crate::domain::mod_manifest::{
    ModCacheInfo, ModFileHash, ModFileState,
    ModManifestEntry, ModMetadata, ModScanProgress, ModSourceKind,
};

use crate::services::config_service::ConfigService;
use futures::stream::FuturesUnordered;
use futures::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager, Runtime};

// 数据模型
#[derive(Serialize, Deserialize, Clone, Default, sqlx::FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ModGlobalMetadataCacheRow {
    pub mod_id: String,
    pub curseforge_fingerprint: Option<i64>,
    pub modrinth_hash: Option<String>,
    pub curseforge_project_id: Option<String>,
    pub modrinth_project_id: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_rel_path: String,
    pub icon_source: Option<String>,
    pub aliases: Option<String>,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModSnapshot {
    pub id: String,
    pub timestamp: String,
    pub mod_count: usize,
    pub description: String,
}

pub struct ModManagerService;

impl ModManagerService {
    pub fn emit_mod_scan_progress<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        request_id: Option<&str>,
        mods: &[ModMetadata],
        complete: bool,
    ) {
        if request_id.is_none() {
            return;
        }

        let _ = app.emit(
            "instance-mods-scan-progress",
            ModScanProgress {
                instance_id: instance_id.to_string(),
                request_id: request_id.map(|value| value.to_string()),
                mods: mods.to_vec(),
                complete,
            },
        );
    }

    pub fn get_instance_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();
        Ok(PathBuf::from(base_path).join("instances").join(id))
    }

    pub fn get_game_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let instance_dir = Self::get_instance_dir(app, id)?;
        let mut game_dir = instance_dir.clone();
        let config_path = instance_dir.join("instance.json");

        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(cfg) =
                serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
            {
                if let Some(tp) = cfg.third_party_path {
                    game_dir = PathBuf::from(tp);
                }
            }
        }

        Ok(game_dir)
    }

    pub fn get_mods_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let mods_dir = Self::get_game_dir(app, id)?.join("mods");
        fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
        Ok(mods_dir)
    }

    pub async fn query_cached_metadata(
        pool: &sqlx::SqlitePool,
        mod_id: Option<&str>,
        cf_fingerprint: Option<u32>,
        mr_hash: Option<&str>,
        mr_project_id: Option<&str>,
        cf_project_id: Option<&str>,
        cache_key: Option<&str>,
    ) -> Option<ModGlobalMetadataCacheRow> {
        // 1. 优先通过 mod_id 匹配
        if let Some(id) = mod_id.filter(|s| !s.trim().is_empty()) {
            if let Ok(Some(row)) = sqlx::query_as::<_, ModGlobalMetadataCacheRow>(
                "SELECT mod_id, curseforge_fingerprint, modrinth_hash, curseforge_project_id, modrinth_project_id, name, description, icon_rel_path, icon_source, aliases, updated_at FROM mod_global_metadata_cache WHERE mod_id = ? LIMIT 1"
            )
            .bind(id)
            .fetch_optional(pool)
            .await {
                return Some(row);
            }
        }

        // 2. 通过 CF 指纹匹配
        if let Some(fp) = cf_fingerprint {
            if let Ok(Some(row)) = sqlx::query_as::<_, ModGlobalMetadataCacheRow>(
                "SELECT mod_id, curseforge_fingerprint, modrinth_hash, curseforge_project_id, modrinth_project_id, name, description, icon_rel_path, icon_source, aliases, updated_at FROM mod_global_metadata_cache WHERE curseforge_fingerprint = ? LIMIT 1"
            )
            .bind(fp as i64)
            .fetch_optional(pool)
            .await {
                return Some(row);
            }
        }

        // 3. 通过 Modrinth SHA1 匹配
        if let Some(hash) = mr_hash.filter(|s| !s.trim().is_empty()) {
            if let Ok(Some(row)) = sqlx::query_as::<_, ModGlobalMetadataCacheRow>(
                "SELECT mod_id, curseforge_fingerprint, modrinth_hash, curseforge_project_id, modrinth_project_id, name, description, icon_rel_path, icon_source, aliases, updated_at FROM mod_global_metadata_cache WHERE modrinth_hash = ? LIMIT 1"
            )
            .bind(hash)
            .fetch_optional(pool)
            .await {
                return Some(row);
            }
        }

        // 4. 通过 Modrinth project_id 匹配
        if let Some(pid) = mr_project_id.filter(|s| !s.trim().is_empty()) {
            if let Ok(Some(row)) = sqlx::query_as::<_, ModGlobalMetadataCacheRow>(
                "SELECT mod_id, curseforge_fingerprint, modrinth_hash, curseforge_project_id, modrinth_project_id, name, description, icon_rel_path, icon_source, aliases, updated_at FROM mod_global_metadata_cache WHERE modrinth_project_id = ? LIMIT 1"
            )
            .bind(pid)
            .fetch_optional(pool)
            .await {
                return Some(row);
            }
        }

        // 5. 通过 CurseForge project_id 匹配
        if let Some(pid) = cf_project_id.filter(|s| !s.trim().is_empty()) {
            if let Ok(Some(row)) = sqlx::query_as::<_, ModGlobalMetadataCacheRow>(
                "SELECT mod_id, curseforge_fingerprint, modrinth_hash, curseforge_project_id, modrinth_project_id, name, description, icon_rel_path, icon_source, aliases, updated_at FROM mod_global_metadata_cache WHERE curseforge_project_id = ? LIMIT 1"
            )
            .bind(pid)
            .fetch_optional(pool)
            .await {
                return Some(row);
            }
        }

        // 6. 回退查询旧版 global_mod_cache
        if let Some(key) = cache_key.filter(|s| !s.trim().is_empty()) {
            if let Ok(Some(row)) = sqlx::query_as::<_, crate::domain::mod_manifest::ModCacheInfo>(
                "SELECT name, description, icon_url FROM global_mod_cache WHERE cache_key = ? LIMIT 1"
            )
            .bind(key)
            .fetch_optional(pool)
            .await {
                if let Some(icon_rel_path) = row.icon_url {
                    return Some(ModGlobalMetadataCacheRow {
                        mod_id: key.to_string(),
                        curseforge_fingerprint: None,
                        modrinth_hash: None,
                        curseforge_project_id: None,
                        modrinth_project_id: None,
                        name: row.name,
                        description: row.description,
                        icon_rel_path,
                        icon_source: None,
                        aliases: None,
                        updated_at: 0,
                    });
                }
            }
        }

        None
    }

    pub async fn save_metadata_to_cache(
        pool: &sqlx::SqlitePool,
        mod_id: Option<&str>,
        cf_fingerprint: Option<u32>,
        mr_hash: Option<&str>,
        cf_project_id: Option<&str>,
        mr_project_id: Option<&str>,
        name: Option<&str>,
        description: Option<&str>,
        icon_rel_path: &str,
        icon_source: Option<&str>,
        cache_key: Option<&str>,
    ) {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        let effective_id = mod_id
            .filter(|s| !s.trim().is_empty())
            .map(|s| s.to_string())
            .or_else(|| cf_project_id.map(|p| format!("curseforge_{}", p)))
            .or_else(|| mr_project_id.map(|p| format!("modrinth_{}", p)))
            .or_else(|| cache_key.map(|k| k.to_string()));

        if let Some(id) = effective_id {
            let display_title = name.unwrap_or(&id);
            let mut auto_aliases = Vec::new();
            if let Some(m) = mod_id {
                auto_aliases.push(m.to_string());
            }
            if let Some(cf) = cf_project_id {
                auto_aliases.push(cf.to_string());
            }
            if let Some(mr) = mr_project_id {
                auto_aliases.push(mr.to_string());
            }
            if let Some(n) = name {
                auto_aliases.push(n.to_string());
            }
            if let Some(k) = cache_key {
                auto_aliases.push(k.to_string());
            }

            let aliases_json = serde_json::to_string(&auto_aliases).ok();

            let _ = sqlx::query::<sqlx::Sqlite>(
                r#"
                INSERT INTO mod_global_metadata_cache (
                    mod_id, curseforge_fingerprint, modrinth_hash,
                    curseforge_project_id, modrinth_project_id,
                    name, description, icon_rel_path, icon_source, aliases, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(mod_id) DO UPDATE SET
                    curseforge_fingerprint = COALESCE(excluded.curseforge_fingerprint, mod_global_metadata_cache.curseforge_fingerprint),
                    modrinth_hash = COALESCE(excluded.modrinth_hash, mod_global_metadata_cache.modrinth_hash),
                    curseforge_project_id = COALESCE(excluded.curseforge_project_id, mod_global_metadata_cache.curseforge_project_id),
                    modrinth_project_id = COALESCE(excluded.modrinth_project_id, mod_global_metadata_cache.modrinth_project_id),
                    name = COALESCE(excluded.name, mod_global_metadata_cache.name),
                    description = COALESCE(excluded.description, mod_global_metadata_cache.description),
                    icon_rel_path = excluded.icon_rel_path,
                    icon_source = COALESCE(excluded.icon_source, mod_global_metadata_cache.icon_source),
                    aliases = COALESCE(excluded.aliases, mod_global_metadata_cache.aliases),
                    updated_at = excluded.updated_at
                "#
            )
            .bind(&id)
            .bind(cf_fingerprint.map(|v| v as i64))
            .bind(mr_hash)
            .bind(cf_project_id)
            .bind(mr_project_id)
            .bind(name)
            .bind(description)
            .bind(icon_rel_path)
            .bind(icon_source)
            .bind(aliases_json)
            .bind(now)
            .execute(pool)
            .await;

            let _ = crate::services::db_service::DbService::save_mod_aliases(
                pool,
                &id,
                display_title,
                &auto_aliases,
                "metadata_sync",
            )
            .await;
        }

        if let Some(key) = cache_key {
            let _ = sqlx::query::<sqlx::Sqlite>(
                r#"
                INSERT INTO global_mod_cache (cache_key, name, description, icon_url, updated_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(cache_key) DO UPDATE SET
                    name = excluded.name,
                    description = excluded.description,
                    icon_url = excluded.icon_url,
                    updated_at = excluded.updated_at
                "#
            )
            .bind(key)
            .bind(name)
            .bind(description)
            .bind(icon_rel_path)
            .bind(now)
            .execute(pool)
            .await;
        }
    }

    // ================= 1. 读取并解析 Mods =================
    pub async fn get_mods<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        request_id: Option<String>,
    ) -> Result<Vec<ModMetadata>, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;

        let mut game_dir = instance_dir.clone();
        let config_path = instance_dir.join("instance.json");
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(cfg) =
                serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
            {
                if let Some(tp) = cfg.third_party_path {
                    game_dir = PathBuf::from(tp);
                }
            }
        }
        let mods_dir = game_dir.join("mods");
        let shared_mods_dir = icon_storage::IconStorage::get_shared_mods_dir(app)?;
        let icons_base_dir = shared_mods_dir.join("icons");

        fs::create_dir_all(&mods_dir).ok();
        fs::create_dir_all(&icons_base_dir).ok();

        // 获取 DB Pool 进行全局缓存查询
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let manifest_path = instance_dir.join("mod_manifest.json");
        if manifest_path.exists() {
            let _ = fs::remove_file(&manifest_path);
        }

        // 1. Read existing records from SQLite instance_mods
        let db_mods = crate::services::db_service::DbService::query_instance_mods(&pool, instance_id)
            .await
            .unwrap_or_default();
        let db_mod_map: std::collections::HashMap<String, crate::services::db_service::EnrichedInstanceModRow> =
            db_mods.into_iter().map(|m| (m.file_name.clone(), m)).collect();

        // 2. Read physical mods directory
        let mut actual_files = std::collections::HashMap::new();
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if file_name.ends_with(".jar") || file_name.ends_with(".jar.disabled") {
                        let is_enabled = !file_name.ends_with(".disabled");
                        let meta_res = fs::metadata(&path).ok();
                        let size = meta_res.as_ref().map(|m| m.len() as i64).unwrap_or(0);
                        let mtime = meta_res
                            .as_ref()
                            .and_then(|m| m.modified().ok())
                            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                            .map(|d| d.as_secs() as i64)
                            .unwrap_or(0);
                        actual_files.insert(file_name, (path, is_enabled, size, mtime));
                    }
                }
            }
        }

        // 3. Remove deleted records from DB
        let deleted_files: Vec<String> = db_mod_map
            .keys()
            .filter(|f| !actual_files.contains_key(*f))
            .cloned()
            .collect();
        if !deleted_files.is_empty() {
            let _ = crate::services::db_service::DbService::delete_instance_mods(&pool, instance_id, &deleted_files).await;
        }

        let mut tasks = Vec::new();
        let mut mods = Vec::new();
        let mut pending_fast_emit: Vec<ModMetadata> = Vec::new();
        let request_id_ref = request_id.as_deref();

        for (file_name, (path, is_enabled, file_size, modified_at)) in actual_files {
            let db_entry = db_mod_map.get(&file_name);
            let is_fast_path = match db_entry {
                Some(cached) => cached.modified_at == modified_at && cached.file_size == file_size,
                None => false,
            };

            if is_fast_path {
                let cached = db_entry.unwrap();
                let mut icon_absolute_path = None;
                let mut network_icon_url = None;

                if let Some(ref rel) = cached.icon_rel_path {
                    if rel.starts_with("http://") || rel.starts_with("https://") {
                        network_icon_url = Some(rel.clone());
                    } else if !rel.is_empty() {
                        let abs_path = shared_mods_dir.join(rel);
                        if abs_path.is_file() {
                            icon_absolute_path = Some(abs_path.to_string_lossy().replace('\\', "/"));
                        }
                    }
                }

                if icon_absolute_path.is_none() {
                    if let Some(ref mid) = cached.mod_id {
                        let trimmed = mid.trim();
                        if !trimmed.is_empty() {
                            if let Some(cached_path) = icon_storage::IconStorage::find_cached_icon_in_buckets(&icons_base_dir, trimmed) {
                                icon_absolute_path = Some(cached_path.to_string_lossy().replace('\\', "/"));
                            }
                        }
                    }
                }

                let cache_key = format!("local_{}", cached.mod_id.as_deref().unwrap_or(&file_name));
                let aliases = cached.aliases.as_deref().and_then(|s| serde_json::from_str(s).ok());

                let meta = ModMetadata {
                    file_name: file_name.clone(),
                    mod_id: cached.mod_id.clone(),
                    name: cached.name.clone(),
                    version: cached.version.clone(),
                    description: cached.description.clone(),
                    icon_absolute_path,
                    offline_jar_icon_absolute_path: None,
                    network_icon_url,
                    curseforge_fingerprint: cached.curseforge_fingerprint,
                    sha1: cached.sha1.clone(),
                    file_size: file_size.max(0) as u64,
                    is_enabled,
                    modified_at: modified_at.max(0) as u64,
                    cache_key: Some(cache_key),
                    manifest_entry: None,
                    dependencies: cached.dependencies.clone(),
                    aliases,
                    dependents_count: Some(cached.dependents_count),
                };

                mods.push(meta.clone());
                pending_fast_emit.push(meta);
                if pending_fast_emit.len() >= 16 {
                    Self::emit_mod_scan_progress(app, instance_id, request_id_ref, &pending_fast_emit, false);
                    pending_fast_emit.clear();
                }
                continue;
            }

            // SLOW PATH: Parsing changed or new mod
            let shared_mods_dir_clone = shared_mods_dir.clone();
            let icons_base_dir_clone = icons_base_dir.clone();
            let pool_clone = pool.clone();
            let path_clone = path.clone();
            let file_name_clone = file_name.clone();

            tasks.push(tokio::spawn(async move {
                let shared_mods_dir_for_blocking = shared_mods_dir_clone.clone();
                let (mut meta, mut extracted_icon_rel_path, bucket_dir) = tokio::task::spawn_blocking(move || {
                    let mut m = jar_parser::JarParser::parse_jar_meta(&path_clone);
                    m.is_enabled = is_enabled;
                    m.curseforge_fingerprint = remote_fetcher::RemoteFetcher::resolve_curseforge_fingerprint(None, &path_clone);

                    // Compute SHA1 for Modrinth hash matching
                    if let Ok(mut file) = std::fs::File::open(&path_clone) {
                        use sha1::Digest;
                        let mut hasher = sha1::Sha1::new();
                        let mut buffer = [0u8; 64 * 1024];
                        use std::io::Read;
                        while let Ok(n) = file.read(&mut buffer) {
                            if n == 0 { break; }
                            hasher.update(&buffer[..n]);
                        }
                        m.sha1 = Some(format!("{:x}", hasher.finalize()));
                    }

                    let cache_key = format!("local_{}", m.mod_id.as_deref().unwrap_or(&file_name_clone));
                    m.cache_key = Some(cache_key.clone());

                    let mut rel_path = None;
                    let mut icon_resolved = false;
                    let mut allocated_bucket = None;

                    if let Some(ref mod_id) = m.mod_id {
                        let trimmed = mod_id.trim();
                        if !trimmed.is_empty() {
                            if let Some(cached_path) = icon_storage::IconStorage::find_cached_icon_in_buckets(&icons_base_dir_clone, trimmed) {
                                m.icon_absolute_path = Some(cached_path.to_string_lossy().to_string());
                                if let Ok(rel) = cached_path.strip_prefix(&shared_mods_dir_for_blocking) {
                                    rel_path = Some(rel.to_string_lossy().replace('\\', "/"));
                                    if let Some(parent) = cached_path.parent() {
                                        allocated_bucket = Some(parent.to_path_buf());
                                    }
                                }
                                icon_resolved = true;
                            }
                        }
                    }

                    if !icon_resolved {
                        if let Some(cached_path) = icon_storage::IconStorage::find_cached_icon_in_buckets(&icons_base_dir_clone, &cache_key) {
                            m.icon_absolute_path = Some(cached_path.to_string_lossy().to_string());
                            if let Ok(rel) = cached_path.strip_prefix(&shared_mods_dir_for_blocking) {
                                rel_path = Some(rel.to_string_lossy().replace('\\', "/"));
                                if let Some(parent) = cached_path.parent() {
                                    allocated_bucket = Some(parent.to_path_buf());
                                }
                            }
                        }
                    }

                    let bucket_dir = allocated_bucket.unwrap_or_else(|| {
                        icon_storage::IconStorage::get_or_create_available_bucket(&icons_base_dir_clone)
                    });

                    (m, rel_path, bucket_dir)
                }).await.unwrap();

                let cached_row = Self::query_cached_metadata(
                    &pool_clone,
                    meta.mod_id.as_deref(),
                    meta.curseforge_fingerprint,
                    None,
                    None,
                    None,
                    meta.cache_key.as_deref(),
                ).await;

                if let Some(row) = cached_row {
                    if meta.name.is_none() {
                        meta.name = row.name;
                    }
                    if meta.description.is_none() {
                        meta.description = row.description;
                    }
                    if meta.icon_absolute_path.is_none() && !row.icon_rel_path.is_empty() {
                        if row.icon_rel_path.starts_with("http") {
                            meta.network_icon_url = Some(row.icon_rel_path);
                        } else {
                            let abs_path = shared_mods_dir_clone.join(&row.icon_rel_path);
                            if abs_path.is_file() {
                                meta.icon_absolute_path = Some(abs_path.to_string_lossy().replace('\\', "/"));
                                extracted_icon_rel_path = Some(row.icon_rel_path.clone());
                            }
                        }
                    }
                    if meta.aliases.is_none() && row.aliases.is_some() {
                        meta.aliases = row.aliases.as_deref().and_then(|s| serde_json::from_str(s).ok());
                    }
                }

                let meta_mod_id = meta.mod_id.clone();
                if let Some(ref mod_id) = meta_mod_id {
                    if meta.name.is_none() || meta.icon_absolute_path.is_none() {
                        let cache_key_str = meta.cache_key.clone().unwrap_or_else(|| format!("local_{}", mod_id));
                        let client = reqwest::Client::builder()
                            .timeout(std::time::Duration::from_secs(5))
                            .build()
                            .unwrap_or_default();
                        remote_fetcher::RemoteFetcher::fallback_api_metadata(
                            &client,
                            mod_id,
                            &cache_key_str,
                            &bucket_dir,
                            &shared_mods_dir_clone,
                            &mut meta,
                            &mut extracted_icon_rel_path,
                        ).await;
                    }
                }

                let db_icon_val = extracted_icon_rel_path.clone().or_else(|| meta.network_icon_url.clone());
                (file_name, is_enabled, file_size, modified_at, meta, db_icon_val)
            }));
        }

        if !pending_fast_emit.is_empty() {
            Self::emit_mod_scan_progress(app, instance_id, request_id_ref, &pending_fast_emit, false);
            pending_fast_emit.clear();
        }

        let mut new_instance_mods = Vec::new();
        let mut cache_updates = Vec::new();
        let mut pending_tasks = FuturesUnordered::new();

        for task in tasks {
            pending_tasks.push(task);
        }

        while let Some(res) = pending_tasks.next().await {
            if let Ok((f_name, is_en, f_size, m_time, meta, db_icon_val)) = res {
                new_instance_mods.push(crate::services::db_service::InstanceModDbRow {
                    instance_id: instance_id.to_string(),
                    file_name: f_name.clone(),
                    is_enabled: is_en,
                    file_size: f_size,
                    modified_at: m_time,
                    sha1: meta.sha1.clone(),
                    curseforge_fingerprint: meta.curseforge_fingerprint,
                    mod_id: meta.mod_id.clone(),
                    custom_display_name: None,
                    version: meta.version.clone(),
                    source_platform: None,
                    source_project_id: None,
                    source_file_id: None,
                });

                cache_updates.push((
                    meta.mod_id.clone(),
                    meta.curseforge_fingerprint,
                    meta.name.clone(),
                    meta.description.clone(),
                    db_icon_val,
                    meta.cache_key.clone(),
                ));

                mods.push(meta.clone());
                Self::emit_mod_scan_progress(app, instance_id, request_id_ref, &[meta], false);
            }
        }

        if !new_instance_mods.is_empty() {
            let _ = crate::services::db_service::DbService::upsert_instance_mods(&pool, instance_id, &new_instance_mods).await;
        }

        if !cache_updates.is_empty() {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64;
            if let Ok(mut tx) = pool.begin().await {
                for (mod_id_opt, cf_fp_opt, name_opt, desc_opt, icon_val_opt, cache_key_opt) in cache_updates {
                    if let Some(ref icon_rel) = icon_val_opt {
                        if let Some(ref mod_id) = mod_id_opt {
                            let _ = sqlx::query::<sqlx::Sqlite>(
                                r#"
                                INSERT INTO mod_global_metadata_cache (
                                    mod_id, curseforge_fingerprint,
                                    name, description, icon_rel_path, icon_source, updated_at
                                )
                                VALUES (?, ?, ?, ?, ?, 'local', ?)
                                ON CONFLICT(mod_id) DO UPDATE SET
                                    curseforge_fingerprint = COALESCE(excluded.curseforge_fingerprint, mod_global_metadata_cache.curseforge_fingerprint),
                                    name = COALESCE(excluded.name, mod_global_metadata_cache.name),
                                    description = COALESCE(excluded.description, mod_global_metadata_cache.description),
                                    icon_rel_path = excluded.icon_rel_path,
                                    updated_at = excluded.updated_at
                                "#
                            )
                            .bind(mod_id)
                            .bind(cf_fp_opt.map(|v| v as i64))
                            .bind(name_opt.as_deref())
                            .bind(desc_opt.as_deref())
                            .bind(icon_rel)
                            .bind(now)
                            .execute(&mut *tx)
                            .await;
                        }
                    }
                    if let Some(cache_key) = cache_key_opt {
                        let _ = sqlx::query::<sqlx::Sqlite>(
                            r#"
                            INSERT INTO global_mod_cache (cache_key, name, description, icon_url, updated_at)
                            VALUES (?, ?, ?, ?, ?)
                            ON CONFLICT(cache_key) DO UPDATE SET
                                name = excluded.name,
                                description = excluded.description,
                                icon_url = excluded.icon_url,
                                updated_at = excluded.updated_at
                            "#
                        )
                        .bind(cache_key)
                        .bind(name_opt)
                        .bind(desc_opt)
                        .bind(icon_val_opt)
                        .bind(now)
                        .execute(&mut *tx)
                        .await;
                    }
                }
                let _ = tx.commit().await;
            }
        }

        mods.sort_by(|a, b| {
            b.is_enabled
                .cmp(&a.is_enabled)
                .then_with(|| a.file_name.cmp(&b.file_name))
        });

        Self::emit_mod_scan_progress(app, instance_id, request_id_ref, &mods, true);

        Ok(mods)
    }

    pub async fn get_mod_manifest_cache<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<ModMetadata>, String> {
        let shared_mods_dir = icon_storage::IconStorage::get_shared_mods_dir(app)?;
        let icons_base_dir = shared_mods_dir.join("icons");
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();

        let rows = crate::services::db_service::DbService::query_instance_mods(&pool, instance_id)
            .await
            .map_err(|e| e.to_string())?;

        let mut mods = Vec::with_capacity(rows.len());
        for row in rows {
            let mut icon_absolute_path = None;
            let mut network_icon_url = None;

            if let Some(ref rel) = row.icon_rel_path {
                if rel.starts_with("http://") || rel.starts_with("https://") {
                    network_icon_url = Some(rel.clone());
                } else if !rel.is_empty() {
                    let abs_path = shared_mods_dir.join(rel);
                    if abs_path.is_file() {
                        icon_absolute_path = Some(abs_path.to_string_lossy().replace('\\', "/"));
                    }
                }
            }

            if icon_absolute_path.is_none() {
                if let Some(ref mid) = row.mod_id {
                    let trimmed = mid.trim();
                    if !trimmed.is_empty() {
                        if let Some(cached_path) = icon_storage::IconStorage::find_cached_icon_in_buckets(&icons_base_dir, trimmed) {
                            icon_absolute_path = Some(cached_path.to_string_lossy().replace('\\', "/"));
                        }
                    }
                }
            }

            let cache_key = format!("local_{}", row.mod_id.as_deref().unwrap_or(&row.file_name));
            let aliases = row.aliases.as_deref().and_then(|s| serde_json::from_str(s).ok());

            mods.push(ModMetadata {
                file_name: row.file_name,
                mod_id: row.mod_id,
                name: row.name,
                version: row.version,
                description: row.description,
                icon_absolute_path,
                offline_jar_icon_absolute_path: None,
                network_icon_url,
                curseforge_fingerprint: row.curseforge_fingerprint,
                sha1: row.sha1,
                file_size: row.file_size.max(0) as u64,
                is_enabled: row.is_enabled,
                modified_at: row.modified_at.max(0) as u64,
                cache_key: Some(cache_key),
                manifest_entry: None,
                dependencies: row.dependencies,
                aliases,
                dependents_count: Some(row.dependents_count),
            });
        }

        mods.sort_by(|a, b| {
            b.is_enabled
                .cmp(&a.is_enabled)
                .then_with(|| a.file_name.cmp(&b.file_name))
        });

        Ok(mods)
    }

    // ================= 门面转发方法 (Facade Delegation) =================

    pub async fn update_mod_cache<R: Runtime>(
        app: &AppHandle<R>,
        cache_key: &str,
        name: &str,
        desc: &str,
        icon_url: &str,
        mod_id: Option<&str>,
        curseforge_fingerprint: Option<u32>,
        modrinth_hash: Option<&str>,
        curseforge_project_id: Option<&str>,
        modrinth_project_id: Option<&str>,
    ) -> Result<Option<String>, String> {
        icon_storage::IconStorage::update_mod_cache(
            app,
            cache_key,
            name,
            desc,
            icon_url,
            mod_id,
            curseforge_fingerprint,
            modrinth_hash,
            curseforge_project_id,
            modrinth_project_id,
        )
        .await
    }

    pub async fn ensure_offline_jar_icon<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
    ) -> Result<Option<String>, String> {
        icon_storage::IconStorage::ensure_offline_jar_icon(app, instance_id, file_name).await
    }

    pub fn check_and_update_gamepad<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<bool, String> {
        gamepad::GamepadManager::check_and_update_gamepad(app, instance_id)
    }

    pub async fn check_gamepad_mod_status<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<GamepadModStatus, String> {
        gamepad::GamepadManager::check_gamepad_mod_status(app, instance_id, mc_version, loader_type)
            .await
    }

    pub async fn install_remote_mod<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        download_url: &str,
        file_name: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<(), String> {
        installer::ModInstaller::install_remote_mod(
            app,
            instance_id,
            download_url,
            file_name,
            mc_version,
            loader_type,
        )
        .await
    }

    pub async fn execute_mod_file_cleanup<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        items: Vec<ModFileNameCleanupItem>,
    ) -> Result<ModFileNameCleanupResult, String> {
        installer::ModInstaller::execute_mod_file_cleanup(app, instance_id, items).await
    }

    pub fn normalize_mod_identifier(id: &str) -> String {
        dependency_resolver::DependencyResolver::normalize_mod_identifier(id)
    }

    pub async fn get_instance_dependency_health<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<InstanceDependencyHealth, String> {
        dependency_resolver::DependencyResolver::get_instance_dependency_health(app, instance_id)
            .await
    }

    pub fn create_snapshot<R: Runtime>(
        _app: &AppHandle<R>,
        _instance_id: &str,
        _desc: &str,
    ) -> Result<ModSnapshot, String> {
        Ok(ModSnapshot {
            id: "".into(),
            timestamp: "".into(),
            mod_count: 0,
            description: "".into(),
        })
    }

    pub fn rollback_snapshot<R: Runtime>(
        _app: &AppHandle<R>,
        _instance_id: &str,
        _snapshot_id: &str,
    ) -> Result<(), String> {
        Ok(())
    }
}
