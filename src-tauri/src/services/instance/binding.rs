use crate::domain::instance::{InstanceBindingState, InstanceConfig, ServerBinding};
use crate::error::AppResult;
use crate::services::config_service::ConfigService;
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub struct InstanceBindingService;

impl InstanceBindingService {
    pub fn instance_config_path<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        Ok(PathBuf::from(base_path)
            .join("instances")
            .join(instance_id)
            .join("instance.json"))
    }

    pub fn load_instance_config<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<InstanceConfig, String> {
        let config_path = Self::instance_config_path(app, instance_id)?;
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }

    pub fn write_instance_config<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        config: &InstanceConfig,
    ) -> Result<(), String> {
        let config_path = Self::instance_config_path(app, instance_id)?;
        let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
        fs::write(config_path, content).map_err(|e| e.to_string())
    }

    pub async fn upsert_instance(pool: &SqlitePool, config: &InstanceConfig) -> AppResult<()> {
        sqlx::query(
            "INSERT INTO instances (
                id,
                name,
                mc_version,
                loader_type,
                loader_version,
                java_path,
                min_memory,
                max_memory,
                icon_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                mc_version = excluded.mc_version,
                loader_type = excluded.loader_type,
                loader_version = excluded.loader_version,
                java_path = excluded.java_path,
                min_memory = excluded.min_memory,
                max_memory = excluded.max_memory,
                icon_path = excluded.icon_path,
                updated_at = CURRENT_TIMESTAMP",
        )
        .bind(&config.id)
        .bind(&config.name)
        .bind(&config.mc_version)
        .bind(&config.loader.r#type)
        .bind(&config.loader.version)
        .bind(&config.java.path)
        .bind(config.memory.min as i64)
        .bind(config.memory.max as i64)
        .bind(config.cover_image.as_deref())
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn upsert_instance_from_disk<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<InstanceConfig> {
        let config = Self::load_instance_config(app, instance_id)
            .map_err(crate::error::AppError::Generic)?;
        Self::upsert_instance(pool, &config).await?;
        Ok(config)
    }

    pub async fn replace_binding_for_instance(
        pool: &SqlitePool,
        instance_id: &str,
        server_binding: &ServerBinding,
        auto_join: bool,
    ) -> AppResult<ServerBinding> {
        let address = server_binding.ip.trim();
        let resolved_name = if server_binding.name.trim().is_empty() {
            address.to_string()
        } else {
            server_binding.name.trim().to_string()
        };

        let existing_row = sqlx::query(
            "SELECT id FROM servers WHERE lower(address) = lower(?) AND port = ? LIMIT 1",
        )
        .bind(address)
        .bind(server_binding.port as i64)
        .fetch_optional(pool)
        .await?;

        let server_id = if let Some(row) = existing_row {
            let id: String = row.get("id");
            sqlx::query("UPDATE servers SET name = ?, address = ?, port = ? WHERE id = ?")
                .bind(&resolved_name)
                .bind(address)
                .bind(server_binding.port as i64)
                .bind(&id)
                .execute(pool)
                .await?;
            id
        } else {
            let requested_id = server_binding.uuid.trim();
            let can_reuse_requested_id = if requested_id.is_empty() {
                false
            } else {
                sqlx::query("SELECT 1 FROM servers WHERE id = ? LIMIT 1")
                    .bind(requested_id)
                    .fetch_optional(pool)
                    .await?
                    .is_none()
            };

            let server_id = if can_reuse_requested_id {
                requested_id.to_string()
            } else {
                uuid::Uuid::new_v4().to_string()
            };

            sqlx::query(
                "INSERT INTO servers (id, name, address, port, icon_base64, hide_address)
                 VALUES (?, ?, ?, ?, NULL, 0)",
            )
            .bind(&server_id)
            .bind(&resolved_name)
            .bind(address)
            .bind(server_binding.port as i64)
            .execute(pool)
            .await?;
            server_id
        };

        let mut tx = pool.begin().await?;
        sqlx::query("DELETE FROM instance_servers WHERE instance_id = ?")
            .bind(instance_id)
            .execute(&mut *tx)
            .await?;
        sqlx::query(
            "INSERT INTO instance_servers (instance_id, server_id, is_primary, sort_order)
             VALUES (?, ?, ?, 0)",
        )
        .bind(instance_id)
        .bind(&server_id)
        .bind(if auto_join { 1i64 } else { 0i64 })
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;

        Self::cleanup_orphan_servers(pool).await?;

        Ok(ServerBinding {
            uuid: server_id,
            name: resolved_name,
            ip: address.to_string(),
            port: server_binding.port,
        })
    }

    pub async fn clear_bindings_for_instance(
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<()> {
        sqlx::query("DELETE FROM instance_servers WHERE instance_id = ?")
            .bind(instance_id)
            .execute(pool)
            .await?;
        Self::cleanup_orphan_servers(pool).await?;
        Ok(())
    }

    pub async fn set_instance_auto_join(
        pool: &SqlitePool,
        instance_id: &str,
        auto_join: bool,
    ) -> AppResult<()> {
        if auto_join {
            let target = sqlx::query(
                "SELECT server_id
                 FROM instance_servers
                 WHERE instance_id = ?
                 ORDER BY sort_order ASC, added_at ASC
                 LIMIT 1",
            )
            .bind(instance_id)
            .fetch_optional(pool)
            .await?;

            sqlx::query("UPDATE instance_servers SET is_primary = 0 WHERE instance_id = ?")
                .bind(instance_id)
                .execute(pool)
                .await?;

            if let Some(row) = target {
                let server_id: String = row.get("server_id");
                sqlx::query(
                    "UPDATE instance_servers
                     SET is_primary = 1
                     WHERE instance_id = ? AND server_id = ?",
                )
                .bind(instance_id)
                .bind(server_id)
                .execute(pool)
                .await?;
            }
        } else {
            sqlx::query("UPDATE instance_servers SET is_primary = 0 WHERE instance_id = ?")
                .bind(instance_id)
                .execute(pool)
                .await?;
        }

        Ok(())
    }

    pub async fn delete_instance_records(pool: &SqlitePool, instance_id: &str) -> AppResult<()> {
        sqlx::query("DELETE FROM instance_servers WHERE instance_id = ?")
            .bind(instance_id)
            .execute(pool)
            .await?;
        sqlx::query("DELETE FROM instances WHERE id = ?")
            .bind(instance_id)
            .execute(pool)
            .await?;
        Self::cleanup_orphan_servers(pool).await?;
        Ok(())
    }

    pub async fn get_server_bindings<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
    ) -> AppResult<HashMap<String, ServerBinding>> {
        Self::sync_all_bindings_from_disk(app, pool).await?;
        Self::load_db_bindings(pool).await
    }

    pub async fn get_instance_binding_state<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<InstanceBindingState> {
        Self::sync_instance_binding_from_disk(app, pool, instance_id).await?;
        Self::get_instance_binding_state_db(pool, instance_id).await
    }

    pub async fn find_bound_instance_for_server<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        server_binding: &ServerBinding,
    ) -> AppResult<Option<String>> {
        Self::sync_all_bindings_from_disk(app, pool).await?;

        let row = sqlx::query(
            "SELECT is_.instance_id
             FROM instance_servers is_
             JOIN servers s ON s.id = is_.server_id
             WHERE lower(s.address) = lower(?) AND s.port = ?
             ORDER BY is_.is_primary DESC, is_.sort_order ASC, is_.added_at ASC
             LIMIT 1",
        )
        .bind(server_binding.ip.trim())
        .bind(server_binding.port as i64)
        .fetch_optional(pool)
        .await?;

        Ok(row.map(|row| row.get("instance_id")))
    }

    async fn get_instance_binding_state_db(
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<InstanceBindingState> {
        let rows = sqlx::query(
            "SELECT
                s.id AS server_id,
                s.name AS server_name,
                s.address AS server_address,
                s.port AS server_port,
                is_.is_primary AS is_primary
             FROM instance_servers is_
             JOIN servers s ON s.id = is_.server_id
             WHERE is_.instance_id = ?
             ORDER BY is_.is_primary DESC, is_.sort_order ASC, is_.added_at ASC",
        )
        .bind(instance_id)
        .fetch_all(pool)
        .await?;

        let auto_join_server = rows.iter().any(|row| row.get::<i64, _>("is_primary") != 0);
        let server_binding = rows.first().map(Self::server_binding_from_row);

        Ok(InstanceBindingState {
            server_binding,
            auto_join_server,
        })
    }

    async fn load_db_bindings(pool: &SqlitePool) -> AppResult<HashMap<String, ServerBinding>> {
        let rows = sqlx::query(
            "SELECT
                is_.instance_id AS instance_id,
                s.id AS server_id,
                s.name AS server_name,
                s.address AS server_address,
                s.port AS server_port
             FROM instance_servers is_
             JOIN servers s ON s.id = is_.server_id
             ORDER BY is_.instance_id ASC, is_.is_primary DESC, is_.sort_order ASC, is_.added_at ASC",
        )
        .fetch_all(pool)
        .await?;

        let mut bindings = HashMap::new();
        for row in rows {
            let instance_id: String = row.get("instance_id");
            if bindings.contains_key(&instance_id) {
                continue;
            }

            bindings.insert(instance_id, Self::server_binding_from_row(&row));
        }

        Ok(bindings)
    }

    async fn sync_instance_binding_from_disk<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<()> {
        let config = match Self::load_instance_config(app, instance_id) {
            Ok(config) => config,
            Err(_) => return Ok(()),
        };

        Self::upsert_instance(pool, &config).await?;

        if Self::get_instance_binding_state_db(pool, instance_id)
            .await?
            .server_binding
            .is_some()
        {
            return Ok(());
        }

        if let Some(binding) = &config.server_binding {
            Self::replace_binding_for_instance(
                pool,
                instance_id,
                binding,
                config.auto_join_server.unwrap_or(true),
            )
            .await?;
        }

        Ok(())
    }

    async fn sync_all_bindings_from_disk<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
    ) -> AppResult<()> {
        let base_path = match ConfigService::get_base_path(app) {
            Ok(Some(path)) => path,
            Ok(None) => return Ok(()),
            Err(error) => return Err(error.into()),
        };

        let instances_dir = PathBuf::from(&base_path).join("instances");
        if !instances_dir.exists() {
            return Ok(());
        }

        let mut on_disk_ids: Vec<String> = Vec::new();
        let entries = fs::read_dir(&instances_dir)?;
        for entry in entries.flatten() {
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }

            let instance_id = match path.file_name().and_then(|name| name.to_str()) {
                Some(value) if !value.is_empty() => value.to_string(),
                _ => continue,
            };

            Self::sync_instance_binding_from_disk(app, pool, &instance_id).await?;
            on_disk_ids.push(instance_id);
        }

        // Clean up stale bindings for instances no longer on disk
        Self::cleanup_stale_bindings(pool, &on_disk_ids).await?;

        Ok(())
    }

    async fn cleanup_stale_bindings(
        pool: &SqlitePool,
        on_disk_ids: &[String],
    ) -> AppResult<()> {
        let db_instance_ids: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT instance_id FROM instance_servers",
        )
        .fetch_all(pool)
        .await?;

        for id in &db_instance_ids {
            if !on_disk_ids.iter().any(|disk_id| disk_id == id) {
                sqlx::query("DELETE FROM instance_servers WHERE instance_id = ?")
                    .bind(id)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM instances WHERE id = ?")
                    .bind(id)
                    .execute(pool)
                    .await?;
            }
        }

        Self::cleanup_orphan_servers(pool).await?;
        Ok(())
    }

    async fn cleanup_orphan_servers(pool: &SqlitePool) -> AppResult<()> {
        sqlx::query(
            "DELETE FROM servers
             WHERE NOT EXISTS (
                 SELECT 1 FROM instance_servers
                 WHERE instance_servers.server_id = servers.id
             )",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    fn server_binding_from_row(row: &sqlx::sqlite::SqliteRow) -> ServerBinding {
        ServerBinding {
            uuid: row.get("server_id"),
            name: row.get("server_name"),
            ip: row.get("server_address"),
            port: row.get::<i64, _>("server_port") as u16,
        }
    }
}
