use crate::domain::mod_manifest::ModCacheInfo;
use crate::services::config_service::ConfigService;
use serde_json::Value;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModCacheUpdateItem {
    pub cache_key: String,
    pub name: String,
    pub desc: String,
    pub icon_url: String,
    pub mod_id: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
    pub modrinth_hash: Option<String>,
    pub curseforge_project_id: Option<String>,
    pub modrinth_project_id: Option<String>,
}

pub struct IconStorage;

impl IconStorage {
    pub fn get_shared_mods_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base_path_str = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();
        let dir = PathBuf::from(base_path_str).join("shared_mods");
        fs::create_dir_all(&dir).ok();
        Ok(dir)
    }

    pub fn find_cached_icon_in_buckets(icons_base_dir: &Path, name: &str) -> Option<PathBuf> {
        if let Ok(entries) = fs::read_dir(icons_base_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    for ext in &["png", "jpg", "jpeg", "gif", "webp"] {
                        let candidate = path.join(format!("{}.{}", name, ext));
                        if candidate.exists() {
                            return Some(candidate);
                        }
                    }
                }
            }
        }
        None
    }

    pub fn get_or_create_available_bucket(icons_base_dir: &Path) -> PathBuf {
        let mut index = 0;
        loop {
            let bucket_name = format!("{}", index);
            let bucket_dir = icons_base_dir.join(&bucket_name);
            if !bucket_dir.exists() {
                let _ = fs::create_dir_all(&bucket_dir);
                return bucket_dir;
            }
            if let Ok(entries) = fs::read_dir(&bucket_dir) {
                let file_count = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_file())
                    .count();
                if file_count < 50 {
                    return bucket_dir;
                }
            }
            index += 1;
        }
    }

    pub async fn download_icon_to_path(
        client: &reqwest::Client,
        url: &str,
        target_path: &Path,
    ) -> bool {
        if let Ok(resp) = client.get(url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if let Some(parent) = target_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    if tokio::fs::write(target_path, bytes).await.is_ok() {
                        return true;
                    }
                }
            }
        }
        false
    }

    pub async fn download_icon_to_bucket(
        client: &reqwest::Client,
        url: &str,
        bucket_dir: &Path,
        cache_key: &str,
    ) -> Option<String> {
        let ext = Path::new(url)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("png");
        let ext = if ext.len() > 4 || ext.contains('?') {
            "png"
        } else {
            ext
        };
        let target = bucket_dir.join(format!("{}.{}", cache_key, ext));
        if Self::download_icon_to_path(client, url, &target).await {
            Some(target.to_string_lossy().replace('\\', "/"))
        } else {
            None
        }
    }

    #[allow(dead_code)]
    pub fn extract_icon_to_shared(
        jar_path: &Path,
        icons_dir: &Path,
        cache_key: &str,
    ) -> Option<String> {
        let _file_name = jar_path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        if let Ok(file) = File::open(jar_path) {
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                let mut icon_path_in_jar = None;

                // 1. Fabric 解析
                if let Ok(mut mod_json) = archive.by_name("fabric.mod.json") {
                    let mut contents = String::new();
                    if mod_json.read_to_string(&mut contents).is_ok() {
                        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                            if let Some(icon) = json["icon"].as_str() {
                                icon_path_in_jar = Some(icon.to_string());
                            }
                        }
                    }
                }

                // 2. Forge / NeoForge 解析
                if icon_path_in_jar.is_none() {
                    for toml_path in ["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
                        if let Ok(mut mod_toml) = archive.by_name(toml_path) {
                            let mut contents = String::new();
                            if mod_toml.read_to_string(&mut contents).is_ok() {
                                if let Ok(logo_re) =
                                    regex::Regex::new(r#"logoFile\s*=\s*(?:"|')([^"']+)(?:"|')"#)
                                {
                                    if let Some(caps) = logo_re.captures(&contents) {
                                        icon_path_in_jar = Some(caps[1].to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. mcmod.info 解析
                if icon_path_in_jar.is_none() {
                    if let Ok(mut mcmod_info) = archive.by_name("mcmod.info") {
                        let mut contents = String::new();
                        if mcmod_info.read_to_string(&mut contents).is_ok() {
                            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                                let mods = if json.is_array() {
                                    json.as_array()
                                } else {
                                    json["modList"].as_array()
                                };
                                if let Some(mods_arr) = mods {
                                    if let Some(first_mod) = mods_arr.first() {
                                        if let Some(logo) = first_mod["logoFile"].as_str() {
                                            if !logo.is_empty() {
                                                icon_path_in_jar = Some(logo.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Default Fallbacks
                if icon_path_in_jar.is_none() {
                    let fallbacks = ["pack.png", "logo.png", "icon.png", "assets/icon.png"];
                    for f in fallbacks {
                        if archive.by_name(f).is_ok() {
                            icon_path_in_jar = Some(f.to_string());
                            break;
                        }
                    }
                }

                if let Some(icon_path) = icon_path_in_jar {
                    let clean_path = icon_path.trim_start_matches('/');
                    if let Ok(mut icon_file) = archive.by_name(clean_path) {
                        let ext = Path::new(&clean_path)
                            .extension()
                            .unwrap_or_default()
                            .to_string_lossy()
                            .to_string();
                        let ext = if ext.is_empty() {
                            "png".to_string()
                        } else {
                            ext
                        };
                        let target = icons_dir.join(format!("{}.{}", cache_key, ext));

                        let _ = std::fs::create_dir_all(icons_dir);

                        if let Ok(mut out_file) = File::create(&target) {
                            if std::io::copy(&mut icon_file, &mut out_file).is_ok() {
                                return Some(target.to_string_lossy().replace('\\', "/"));
                            }
                        }
                    }
                }
            }
        }
        None
    }

    pub async fn update_mod_cache_batch<R: Runtime>(
        app: &AppHandle<R>,
        items: Vec<ModCacheUpdateItem>,
    ) -> Result<std::collections::HashMap<String, Option<String>>, String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let shared_mods_dir_res = Self::get_shared_mods_dir(app);
        let mut results = std::collections::HashMap::new();

        if items.is_empty() {
            return Ok(results);
        }

        let shared_mods_dir = shared_mods_dir_res.ok();
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .unwrap_or_default();

        // 1. 处理所有图标下载/本地路径解析
        let mut prepared_items = Vec::with_capacity(items.len());
        for item in items {
            let mut final_icon_url = item.icon_url.clone();
            let mut cached_icon_path = None;

            if (item.icon_url.starts_with("http://") || item.icon_url.starts_with("https://"))
                && shared_mods_dir.is_some()
            {
                let s_dir = shared_mods_dir.as_ref().unwrap();
                // 1. Try finding in DB global_mod_cache first
                if let Ok(Some(row)) = sqlx::query_as::<_, ModCacheInfo>(
                    "SELECT name, description, icon_url FROM global_mod_cache WHERE cache_key = ?",
                )
                .bind(&item.cache_key)
                .fetch_optional(&db.pool)
                .await
                {
                    if let Some(rel) = row.icon_url.filter(|value| value.starts_with("icons/")) {
                        let existing_path = s_dir.join(&rel);
                        if existing_path.is_file()
                            && fs::metadata(&existing_path)
                                .map(|meta| meta.len() > 0)
                                .unwrap_or(false)
                        {
                            cached_icon_path =
                                Some(existing_path.to_string_lossy().replace('\\', "/"));
                            final_icon_url = rel;
                        }
                    }
                }

                // 2. If not found, try querying mod_global_metadata_cache
                if cached_icon_path.is_none() {
                    if let Some(row) = super::ModManagerService::query_cached_metadata(
                        &db.pool,
                        item.mod_id.as_deref(),
                        item.curseforge_fingerprint,
                        item.modrinth_hash.as_deref(),
                        item.modrinth_project_id.as_deref(),
                        item.curseforge_project_id.as_deref(),
                        Some(&item.cache_key),
                    )
                    .await
                    {
                        if !row.icon_rel_path.is_empty() && !row.icon_rel_path.starts_with("http") {
                            let existing_path = s_dir.join(&row.icon_rel_path);
                            if existing_path.is_file()
                                && fs::metadata(&existing_path)
                                    .map(|meta| meta.len() > 0)
                                    .unwrap_or(false)
                            {
                                cached_icon_path =
                                    Some(existing_path.to_string_lossy().replace('\\', "/"));
                                final_icon_url = row.icon_rel_path;
                            }
                        }
                    }
                }

                // 3. If still not cached, download into bucket
                if cached_icon_path.is_none() {
                    let icons_base_dir = s_dir.join("icons");
                    let bucket_dir = Self::get_or_create_available_bucket(&icons_base_dir);
                    let icon_filename_key = item.mod_id.as_deref().unwrap_or(&item.cache_key);
                    if let Some(abs_path_str) = Self::download_icon_to_bucket(
                        &client,
                        &item.icon_url,
                        &bucket_dir,
                        icon_filename_key,
                    )
                    .await
                    {
                        cached_icon_path = Some(abs_path_str.clone());
                        let abs_path = std::path::Path::new(&abs_path_str);
                        if let Ok(rel) = abs_path.strip_prefix(s_dir) {
                            final_icon_url = rel.to_string_lossy().replace('\\', "/");
                        }
                    }
                }
            }

            results.insert(item.cache_key.clone(), cached_icon_path);
            prepared_items.push((item, final_icon_url));
        }

        // 2. 批量事务写入 SQLite
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64;

        if let Ok(mut tx) = db.pool.begin().await {
            for (item, final_icon_url) in prepared_items {
                let (inferred_mod_id, cf_pid, mr_pid, icon_source) =
                    if let Some(stripped) = item.cache_key.strip_prefix("modrinth_") {
                        (
                            item.mod_id.as_deref(),
                            item.curseforge_project_id.as_deref(),
                            Some(stripped),
                            Some("modrinth"),
                        )
                    } else if let Some(stripped) = item.cache_key.strip_prefix("curseforge_") {
                        (
                            item.mod_id.as_deref(),
                            Some(stripped),
                            item.modrinth_project_id.as_deref(),
                            Some("curseforge"),
                        )
                    } else if let Some(stripped) = item.cache_key.strip_prefix("local_") {
                        (
                            Some(stripped),
                            item.curseforge_project_id.as_deref(),
                            item.modrinth_project_id.as_deref(),
                            None,
                        )
                    } else {
                        (
                            item.mod_id.as_deref(),
                            item.curseforge_project_id.as_deref(),
                            item.modrinth_project_id.as_deref(),
                            None,
                        )
                    };

                let effective_id = inferred_mod_id
                    .filter(|s| !s.trim().is_empty())
                    .map(|s| s.to_string())
                    .or_else(|| cf_pid.map(|p| format!("curseforge_{}", p)))
                    .or_else(|| mr_pid.map(|p| format!("modrinth_{}", p)))
                    .or_else(|| Some(item.cache_key.clone()));

                if let Some(id) = effective_id {
                    let display_title = if !item.name.is_empty() {
                        item.name.as_str()
                    } else {
                        id.as_str()
                    };
                    let mut auto_aliases = Vec::new();
                    if let Some(m) = inferred_mod_id {
                        auto_aliases.push(m.to_string());
                    }
                    if let Some(cf) = cf_pid {
                        auto_aliases.push(cf.to_string());
                    }
                    if let Some(mr) = mr_pid {
                        auto_aliases.push(mr.to_string());
                    }
                    if !item.name.is_empty() {
                        auto_aliases.push(item.name.clone());
                    }
                    auto_aliases.push(item.cache_key.clone());

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
                            icon_rel_path = CASE
                                WHEN excluded.icon_rel_path <> '' THEN excluded.icon_rel_path
                                ELSE mod_global_metadata_cache.icon_rel_path
                            END,
                            icon_source = COALESCE(excluded.icon_source, mod_global_metadata_cache.icon_source),
                            aliases = COALESCE(excluded.aliases, mod_global_metadata_cache.aliases),
                            updated_at = excluded.updated_at
                        "#
                    )
                    .bind(&id)
                    .bind(item.curseforge_fingerprint.map(|v| v as i64))
                    .bind(item.modrinth_hash.as_deref())
                    .bind(cf_pid)
                    .bind(mr_pid)
                    .bind(&item.name)
                    .bind(&item.desc)
                    .bind(&final_icon_url)
                    .bind(icon_source)
                    .bind(aliases_json)
                    .bind(now)
                    .execute(&mut *tx)
                    .await;

                    let _ = crate::services::db_service::mod_alias_repo::save_mod_aliases_tx(
                        &mut *tx,
                        &id,
                        display_title,
                        &auto_aliases,
                        "metadata_sync",
                    )
                    .await;
                }

                let _ = sqlx::query::<sqlx::Sqlite>(
                    r#"
                    INSERT INTO global_mod_cache (cache_key, name, description, icon_url, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(cache_key) DO UPDATE SET
                        name = excluded.name,
                        description = excluded.description,
                        icon_url = excluded.icon_url,
                        updated_at = excluded.updated_at
                    "#,
                )
                .bind(&item.cache_key)
                .bind(&item.name)
                .bind(&item.desc)
                .bind(&final_icon_url)
                .bind(now)
                .execute(&mut *tx)
                .await;
            }

            let _ = tx.commit().await;
        }

        Ok(results)
    }

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
        let db = app.state::<crate::services::db_service::AppDatabase>();

        let mut final_icon_url = icon_url.to_string();
        let mut cached_icon_path = None;

        if icon_url.starts_with("http://") || icon_url.starts_with("https://") {
            if let Ok(shared_mods_dir) = Self::get_shared_mods_dir(app) {
                // 1. Try finding in DB global_mod_cache first
                if let Ok(Some(row)) = sqlx::query_as::<_, ModCacheInfo>(
                    "SELECT name, description, icon_url FROM global_mod_cache WHERE cache_key = ?",
                )
                .bind(cache_key)
                .fetch_optional(&db.pool)
                .await
                {
                    if let Some(rel) = row.icon_url.filter(|value| value.starts_with("icons/")) {
                        let existing_path = shared_mods_dir.join(&rel);
                        if existing_path.is_file()
                            && fs::metadata(&existing_path)
                                .map(|meta| meta.len() > 0)
                                .unwrap_or(false)
                        {
                            cached_icon_path =
                                Some(existing_path.to_string_lossy().replace('\\', "/"));
                            final_icon_url = rel;
                        }
                    }
                }

                // 2. If not found, try querying mod_global_metadata_cache
                if cached_icon_path.is_none() {
                    if let Some(row) = super::ModManagerService::query_cached_metadata(
                        &db.pool,
                        mod_id,
                        curseforge_fingerprint,
                        modrinth_hash,
                        modrinth_project_id,
                        curseforge_project_id,
                        Some(cache_key),
                    ).await {
                        if !row.icon_rel_path.is_empty() && !row.icon_rel_path.starts_with("http") {
                            let existing_path = shared_mods_dir.join(&row.icon_rel_path);
                            if existing_path.is_file()
                                && fs::metadata(&existing_path)
                                .map(|meta| meta.len() > 0)
                                .unwrap_or(false)
                            {
                                cached_icon_path =
                                    Some(existing_path.to_string_lossy().replace('\\', "/"));
                                final_icon_url = row.icon_rel_path;
                            }
                        }
                    }
                }

                // 3. If still not cached, download into bucket
                if cached_icon_path.is_none() {
                    let icons_base_dir = shared_mods_dir.join("icons");
                    let bucket_dir = Self::get_or_create_available_bucket(&icons_base_dir);
                    let client = reqwest::Client::builder()
                        .timeout(std::time::Duration::from_secs(5))
                        .build()
                        .unwrap_or_default();
                    let icon_filename_key = mod_id.unwrap_or(cache_key);
                    if let Some(abs_path_str) =
                        Self::download_icon_to_bucket(&client, icon_url, &bucket_dir, icon_filename_key)
                            .await
                    {
                        cached_icon_path = Some(abs_path_str.clone());
                        let abs_path = std::path::Path::new(&abs_path_str);
                        if let Ok(rel) = abs_path.strip_prefix(&shared_mods_dir) {
                            final_icon_url = rel.to_string_lossy().replace('\\', "/");
                        }
                    }
                }
            }
        }

        let (inferred_mod_id, cf_pid, mr_pid, icon_source) = if let Some(stripped) = cache_key.strip_prefix("modrinth_") {
            (mod_id, curseforge_project_id, Some(stripped), Some("modrinth"))
        } else if let Some(stripped) = cache_key.strip_prefix("curseforge_") {
            (mod_id, Some(stripped), modrinth_project_id, Some("curseforge"))
        } else if let Some(stripped) = cache_key.strip_prefix("local_") {
            (Some(stripped), curseforge_project_id, modrinth_project_id, None)
        } else {
            (mod_id, curseforge_project_id, modrinth_project_id, None)
        };

        super::ModManagerService::save_metadata_to_cache(
            &db.pool,
            inferred_mod_id,
            curseforge_fingerprint,
            modrinth_hash,
            cf_pid,
            mr_pid,
            Some(name),
            Some(desc),
            &final_icon_url,
            icon_source,
            Some(cache_key),
        )
        .await;

        Ok(cached_icon_path)
    }

    pub fn extract_icon_to_bucket(
        archive_or_dir_path: &Path,
        icons_base_dir: &Path,
        cache_key: &str,
    ) -> Option<PathBuf> {
        if let Some(cached) = Self::find_cached_icon_in_buckets(icons_base_dir, cache_key) {
            return Some(cached);
        }

        let bucket_dir = Self::get_or_create_available_bucket(icons_base_dir);
        let target_path = bucket_dir.join(format!("{}.png", cache_key));

        if super::jar_parser::JarParser::extract_icon_to_path(archive_or_dir_path, &target_path) {
            Some(target_path)
        } else {
            None
        }
    }

    pub async fn ensure_offline_resource_icon<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
        file_name: &str,
    ) -> Result<Option<String>, String> {
        let instance_dir = super::ModManagerService::get_instance_dir(app, instance_id)?;
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

        let safe_file_name = Path::new(file_name)
            .file_name()
            .ok_or_else(|| "invalid resource file name".to_string())?
            .to_string_lossy()
            .to_string();
        let mut item_path = game_dir.join(folder_name).join(&safe_file_name);
        if !item_path.exists() {
            if folder_name == "shaderpacks" {
                let alt = game_dir.join("shaders").join(&safe_file_name);
                if alt.exists() {
                    item_path = alt;
                }
            } else if folder_name == "resourcepacks" {
                let alt = game_dir.join("texturepacks").join(&safe_file_name);
                if alt.exists() {
                    item_path = alt;
                }
            }
        }
        if !item_path.exists() {
            return Ok(None);
        }

        let clean_name = safe_file_name
            .trim_end_matches(".disabled")
            .trim_end_matches(".zip")
            .trim_end_matches(".jar")
            .to_string();

        let shared_mods_dir = Self::get_shared_mods_dir(app)?;
        let icons_base_dir = shared_mods_dir.join("icons");

        // 1. 检查分桶缓存
        if let Some(cached_path) = Self::find_cached_icon_in_buckets(&icons_base_dir, &clean_name) {
            return Ok(Some(cached_path.to_string_lossy().replace('\\', "/")));
        }

        // 2. 检查旧 offline 目录缓存
        let legacy_offline = icons_base_dir.join("offline").join(format!("{}.png", clean_name));
        if legacy_offline.is_file()
            && fs::metadata(&legacy_offline)
                .map(|m| m.len() > 0)
                .unwrap_or(false)
        {
            return Ok(Some(legacy_offline.to_string_lossy().replace('\\', "/")));
        }

        // 3. 解压并存储至可用分桶
        let icons_base_dir_clone = icons_base_dir.clone();
        let clean_name_clone = clean_name.clone();
        let path_clone = item_path.clone();

        let extracted_opt = tokio::task::spawn_blocking(move || {
            Self::extract_icon_to_bucket(&path_clone, &icons_base_dir_clone, &clean_name_clone)
        })
        .await
        .map_err(|e| e.to_string())?;

        if let Some(target_path) = extracted_opt {
            Ok(Some(target_path.to_string_lossy().replace('\\', "/")))
        } else {
            Ok(None)
        }
    }

    pub async fn ensure_offline_jar_icon<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
    ) -> Result<Option<String>, String> {
        Self::ensure_offline_resource_icon(app, instance_id, "mods", file_name).await
    }
}
