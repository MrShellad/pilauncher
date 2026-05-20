// src-tauri/src/services/instance/listing.rs
use crate::domain::instance::{InstanceConfig, InstanceItem};
use crate::error::AppResult;
use crate::services::instance::binding::InstanceBindingService;
use crate::services::instance::tag::InstanceTagService;
use sqlx::{Row, SqlitePool};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

pub struct InstanceListingService;

impl InstanceListingService {
    const INITIAL_SCAN_META_KEY: &'static str = "instance_listing_disk_scan_v1";

    pub async fn get_all<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        force_refresh: bool,
    ) -> AppResult<Vec<InstanceItem>> {
        let base_dir = Self::base_dir(app)?;

        if force_refresh {
            Self::sync_from_disk(pool, &base_dir).await?;
            Self::mark_initial_scan_complete(pool).await?;
            return Self::load_from_db(pool, &base_dir).await;
        }

        let cached = Self::load_from_db(pool, &base_dir).await?;
        if !cached.is_empty() || Self::has_completed_initial_scan(pool).await? {
            return Ok(cached);
        }

        Self::sync_from_disk(pool, &base_dir).await?;
        Self::mark_initial_scan_complete(pool).await?;
        Self::load_from_db(pool, &base_dir).await
    }

    pub async fn get_compatible<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        game_versions: Vec<String>,
        loaders: Vec<String>,
        ignore_loader: bool,
    ) -> AppResult<Vec<InstanceItem>> {
        let all_instances = Self::get_all(app, pool, false).await?;

        Ok(all_instances
            .into_iter()
            .filter(|inst| {
                let matches_gv = game_versions.contains(&inst.version);
                let inst_loader = inst.loader.to_lowercase();
                let matches_loader = ignore_loader
                    || loaders.is_empty()
                    || loaders
                        .iter()
                        .any(|loader| loader.to_lowercase() == inst_loader);

                matches_gv && matches_loader
            })
            .collect())
    }

    fn base_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Base data directory is not configured",
                )
            })?;

        Ok(PathBuf::from(base_path_str))
    }

    async fn load_from_db(pool: &SqlitePool, base_dir: &Path) -> AppResult<Vec<InstanceItem>> {
        let rows = sqlx::query(
            "SELECT
                id,
                name,
                mc_version,
                loader_type,
                icon_path,
                COALESCE(playtime_secs, 0) AS playtime_secs,
                last_played_at,
                COALESCE(is_favorite, 0) AS is_favorite,
                created_at
             FROM instances
             ORDER BY
                CASE
                    WHEN last_played_at IS NULL OR trim(last_played_at) = '' THEN 1
                    ELSE 0
                END ASC,
                last_played_at DESC,
                created_at DESC,
                name COLLATE NOCASE ASC",
        )
        .fetch_all(pool)
        .await?;

        let instance_ids = rows
            .iter()
            .map(|row| row.get::<String, _>("id"))
            .collect::<Vec<_>>();
        let tags_by_instance =
            InstanceTagService::get_tags_for_instances(pool, &instance_ids).await?;
        let instances_root = base_dir.join("instances");

        Ok(rows
            .into_iter()
            .map(|row| {
                let id: String = row.get("id");
                let tags = tags_by_instance.get(&id).cloned().unwrap_or_default();
                let icon_path = row.try_get::<Option<String>, _>("icon_path").ok().flatten();

                InstanceItem {
                    cover_path: Self::resolve_db_cover(&instances_root, &id, icon_path.as_deref()),
                    id,
                    name: row.get("name"),
                    version: row.get("mc_version"),
                    loader: row
                        .try_get::<Option<String>, _>("loader_type")
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "vanilla".to_string()),
                    play_time: row.get::<i64, _>("playtime_secs") as f64,
                    last_played: row
                        .try_get::<Option<String>, _>("last_played_at")
                        .ok()
                        .flatten()
                        .unwrap_or_else(|| "Never played".to_string()),
                    gamepad: None,
                    tags: if tags.is_empty() { None } else { Some(tags) },
                    is_favorite: Some(row.get::<i64, _>("is_favorite") != 0),
                    created_at: row
                        .try_get::<Option<String>, _>("created_at")
                        .ok()
                        .flatten()
                        .unwrap_or_default(),
                }
            })
            .collect())
    }

    async fn sync_from_disk(pool: &SqlitePool, base_dir: &Path) -> AppResult<()> {
        let instances_dir = base_dir.join("instances");
        if !instances_dir.exists() {
            Self::cleanup_stale_db_instances(pool, &[]).await?;
            return Ok(());
        }

        let mut on_disk_ids = Vec::new();
        for entry in fs::read_dir(&instances_dir)? {
            let path = entry?.path();
            if !path.is_dir() {
                continue;
            }

            let id = match path.file_name().and_then(|value| value.to_str()) {
                Some(value) if !value.is_empty() => value.to_string(),
                _ => continue,
            };

            let manifest_path = path.join("instance.json");
            let Ok(content) = fs::read_to_string(manifest_path) else {
                continue;
            };
            let Ok(mut config) = serde_json::from_str::<InstanceConfig>(&content) else {
                continue;
            };

            config.id = id.clone();
            InstanceBindingService::upsert_instance(pool, &config).await?;
            on_disk_ids.push(id);
        }

        Self::cleanup_stale_db_instances(pool, &on_disk_ids).await
    }

    async fn cleanup_stale_db_instances(
        pool: &SqlitePool,
        on_disk_ids: &[String],
    ) -> AppResult<()> {
        let db_instance_ids: Vec<String> = sqlx::query_scalar("SELECT id FROM instances")
            .fetch_all(pool)
            .await?;

        for id in db_instance_ids {
            if !on_disk_ids.iter().any(|disk_id| disk_id == &id) {
                InstanceBindingService::delete_instance_records(pool, &id).await?;
            }
        }

        Ok(())
    }

    async fn has_completed_initial_scan(pool: &SqlitePool) -> AppResult<bool> {
        let value: Option<String> = sqlx::query_scalar("SELECT value FROM app_meta WHERE key = ?")
            .bind(Self::INITIAL_SCAN_META_KEY)
            .fetch_optional(pool)
            .await?;

        Ok(value.as_deref() == Some("1"))
    }

    async fn mark_initial_scan_complete(pool: &SqlitePool) -> AppResult<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO app_meta (key, value)
             VALUES (?, '1')",
        )
        .bind(Self::INITIAL_SCAN_META_KEY)
        .execute(pool)
        .await?;

        Ok(())
    }

    fn resolve_db_cover(
        instances_root: &Path,
        instance_id: &str,
        icon_path: Option<&str>,
    ) -> Option<String> {
        let icon_path = icon_path?.trim();
        if icon_path.is_empty() {
            return None;
        }

        let path = PathBuf::from(icon_path);
        let resolved = if path.is_absolute() {
            path
        } else {
            instances_root.join(instance_id).join(path)
        };

        Some(resolved.to_string_lossy().to_string())
    }

    #[allow(dead_code)]
    fn resolve_cover(root: &Path) -> Option<String> {
        let extensions = ["png", "jpg", "jpeg", "webp"];

        let piconfig = root.join("piconfig");
        for ext in extensions {
            let cover_file = piconfig.join(format!("cover.{}", ext));
            if cover_file.exists() {
                return Some(cover_file.to_string_lossy().to_string());
            }
        }

        for ext in extensions {
            let instance_file = root.join(format!("instance.{}", ext));
            if instance_file.exists() {
                return Some(instance_file.to_string_lossy().to_string());
            }
        }

        let screen_dir = root.join("screenshots");
        if let Ok(mut entries) = fs::read_dir(screen_dir) {
            if let Some(Ok(entry)) = entries.next() {
                return Some(entry.path().to_string_lossy().to_string());
            }
        }

        None
    }
}
