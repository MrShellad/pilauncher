use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, PlaytimeSyncSettings};
use crate::services::file_write_lock::lock_for_path;
use crate::services::instance::binding::InstanceBindingService;
use chrono::{DateTime, NaiveDateTime, Utc};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sqlx::{Row, SqlitePool};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::oneshot;

const HEARTBEAT_INTERVAL_SECS: u64 = 60;
const FLUSH_INTERVAL_SECS: i64 = 300;
const AUTO_SYNC_INTERVAL_SECS: u64 = 60 * 60;
const DEFAULT_REMOTE_ROOT: &str = "PiLauncher/playtime";

static ACTIVE_SESSIONS: Lazy<Mutex<HashMap<String, oneshot::Sender<DateTime<Utc>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SessionCheckpoint {
    instance_id: String,
    instance_name: String,
    started_at: String,
    last_heartbeat_at: String,
    accumulated_secs: i64,
    flushed_secs: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DeviceEntry {
    id: String,
    name: String,
    last_sync: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DevicesManifest {
    devices: Vec<DeviceEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct SnapshotInstance {
    name: String,
    playtime: i64,
    last_played: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct DeviceSnapshot {
    device: DeviceEntry,
    instances: HashMap<String, SnapshotInstance>,
    device_total: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlaytimeSourceBreakdown {
    pub device_id: String,
    pub device_name: String,
    pub playtime_secs: i64,
    pub last_played_at: Option<String>,
    pub is_local: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InstancePlaytimeAggregate {
    pub instance_id: String,
    pub instance_name: String,
    pub total_secs: i64,
    pub local_secs: i64,
    pub other_device_secs: i64,
    pub last_played_at: Option<String>,
    pub sources: Vec<PlaytimeSourceBreakdown>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PlaytimeOverview {
    pub device_id: String,
    pub device_name: String,
    pub global_total_secs: i64,
    pub global_local_secs: i64,
    pub global_other_device_secs: i64,
    pub sync_enabled: bool,
    pub sync_configured: bool,
    pub instance: Option<InstancePlaytimeAggregate>,
}

#[derive(Debug, Clone)]
struct LocalInstanceStat {
    id: String,
    name: String,
    playtime_secs: i64,
    last_played_at: Option<String>,
}

#[derive(Debug, Clone)]
struct DeviceIdentity {
    device_id: String,
    device_name: String,
}

pub struct PlaytimeService;

impl PlaytimeService {
    pub fn spawn_background_tasks<R: Runtime + 'static>(app: AppHandle<R>, pool: SqlitePool) {
        tauri::async_runtime::spawn(async move {
            if let Err(error) = Self::recover_stale_sessions(&app, &pool).await {
                eprintln!("[Playtime] Failed to recover stale sessions on startup: {}", error);
            }

            if let Err(error) = Self::sync_with_remote_if_enabled(&app, &pool).await {
                eprintln!("[Playtime] Initial sync skipped: {}", error);
            }

            let mut interval = tokio::time::interval(Duration::from_secs(AUTO_SYNC_INTERVAL_SECS));
            interval.tick().await;

            loop {
                interval.tick().await;

                if let Err(error) = Self::recover_stale_sessions(&app, &pool).await {
                    eprintln!("[Playtime] Periodic recovery failed: {}", error);
                }

                if let Err(error) = Self::sync_with_remote_if_enabled(&app, &pool).await {
                    eprintln!("[Playtime] Periodic sync failed: {}", error);
                }
            }
        });
    }

    pub async fn start_session<R: Runtime + 'static>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        instance_name: &str,
    ) -> AppResult<()> {
        Self::recover_stale_sessions(app, pool).await?;

        {
            let sessions = ACTIVE_SESSIONS.lock().unwrap();
            if sessions.contains_key(instance_id) {
                return Ok(());
            }
        }

        let started_at = Utc::now();
        let checkpoint = SessionCheckpoint {
            instance_id: instance_id.to_string(),
            instance_name: instance_name.to_string(),
            started_at: started_at.to_rfc3339(),
            last_heartbeat_at: started_at.to_rfc3339(),
            accumulated_secs: 0,
            flushed_secs: 0,
        };

        Self::write_checkpoint(app, &checkpoint).await?;

        let (stop_tx, stop_rx) = oneshot::channel();
        ACTIVE_SESSIONS
            .lock()
            .unwrap()
            .insert(instance_id.to_string(), stop_tx);

        let app_handle = app.clone();
        let pool_handle = pool.clone();
        let instance_id_owned = instance_id.to_string();
        let instance_name_owned = instance_name.to_string();

        tauri::async_runtime::spawn(async move {
            if let Err(error) = Self::run_session_loop(
                app_handle,
                pool_handle,
                instance_id_owned,
                instance_name_owned,
                started_at,
                stop_rx,
            )
            .await
            {
                eprintln!("[Playtime] Session loop failed: {}", error);
            }
        });

        Ok(())
    }

    pub async fn finish_session<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<()> {
        let removed_tx = ACTIVE_SESSIONS.lock().unwrap().remove(instance_id);

        if let Some(tx) = removed_tx {
            let _ = tx.send(Utc::now());
        } else {
            Self::recover_stale_sessions(app, pool).await?;
        }

        Ok(())
    }

    pub async fn recover_stale_sessions<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
    ) -> AppResult<()> {
        let session_dir = match Self::sessions_dir(app) {
            Ok(path) => path,
            Err(_) => return Ok(()),
        };

        if !session_dir.exists() {
            return Ok(());
        }

        for entry in fs::read_dir(&session_dir)? {
            let path = match entry {
                Ok(item) => item.path(),
                Err(_) => continue,
            };

            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }

            let checkpoint: SessionCheckpoint = match fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
            {
                Some(value) => value,
                None => {
                    let _ = fs::remove_file(&path);
                    continue;
                }
            };

            let recovered_delta = checkpoint
                .accumulated_secs
                .saturating_sub(checkpoint.flushed_secs);

            Self::apply_increment(
                app,
                pool,
                &checkpoint.instance_id,
                &checkpoint.instance_name,
                recovered_delta,
                Some(checkpoint.last_heartbeat_at.clone()),
            )
            .await?;

            let _ = fs::remove_file(path);
        }

        Ok(())
    }

    pub async fn get_overview<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: Option<&str>,
    ) -> AppResult<PlaytimeOverview> {
        Self::recover_stale_sessions(app, pool).await?;
        let identity = Self::ensure_device_identity(app).await?;
        let sync_settings = ConfigService::get_playtime_sync_settings(app);

        Self::write_local_snapshot(app, pool).await?;

        let local_stats = Self::load_local_stats(pool).await?;
        let snapshots = Self::read_cached_snapshots(app).await?;

        let global_local_secs: i64 = local_stats.iter().map(|item| item.playtime_secs).sum();
        let mut global_other_secs = 0i64;
        let mut remote_by_instance: HashMap<String, Vec<PlaytimeSourceBreakdown>> = HashMap::new();
        let mut remote_instance_names: HashMap<String, String> = HashMap::new();

        for snapshot in snapshots {
            if snapshot.device.id == identity.device_id {
                continue;
            }

            global_other_secs += snapshot.device_total.max(0);

            for (remote_instance_id, remote_instance) in snapshot.instances {
                if remote_instance.playtime <= 0 {
                    continue;
                }

                remote_instance_names
                    .entry(remote_instance_id.clone())
                    .or_insert(remote_instance.name.clone());

                remote_by_instance
                    .entry(remote_instance_id)
                    .or_default()
                    .push(PlaytimeSourceBreakdown {
                        device_id: snapshot.device.id.clone(),
                        device_name: snapshot.device.name.clone(),
                        playtime_secs: remote_instance.playtime,
                        last_played_at: remote_instance.last_played.clone(),
                        is_local: false,
                    });
            }
        }

        let instance = instance_id.map(|selected_id| {
            let local = local_stats.iter().find(|item| item.id == selected_id).cloned();
            let remote_sources = remote_by_instance.remove(selected_id).unwrap_or_default();
            let local_secs = local.as_ref().map(|item| item.playtime_secs).unwrap_or(0);
            let other_device_secs: i64 = remote_sources.iter().map(|item| item.playtime_secs).sum();
            let instance_name = local
                .as_ref()
                .map(|item| item.name.clone())
                .or_else(|| remote_instance_names.get(selected_id).cloned())
                .unwrap_or_default();

            let mut sources = Vec::new();
            if local_secs > 0 || !instance_name.is_empty() {
                sources.push(PlaytimeSourceBreakdown {
                    device_id: identity.device_id.clone(),
                    device_name: identity.device_name.clone(),
                    playtime_secs: local_secs,
                    last_played_at: local.as_ref().and_then(|item| item.last_played_at.clone()),
                    is_local: true,
                });
            }
            sources.extend(remote_sources);
            sources.sort_by(|a, b| b.playtime_secs.cmp(&a.playtime_secs));

            InstancePlaytimeAggregate {
                instance_id: selected_id.to_string(),
                instance_name,
                total_secs: local_secs + other_device_secs,
                local_secs,
                other_device_secs,
                last_played_at: Self::latest_timestamp(
                    local.as_ref().and_then(|item| item.last_played_at.clone()),
                    sources.iter().filter_map(|item| item.last_played_at.clone()),
                ),
                sources,
            }
        });

        Ok(PlaytimeOverview {
            device_id: identity.device_id,
            device_name: identity.device_name,
            global_total_secs: global_local_secs + global_other_secs,
            global_local_secs,
            global_other_device_secs: global_other_secs,
            sync_enabled: sync_settings.enabled,
            sync_configured: Self::is_sync_configured(&sync_settings),
            instance,
        })
    }

    pub async fn merge_into_instance_detail<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        detail: &mut Value,
    ) -> AppResult<()> {
        let overview = Self::get_overview(app, pool, Some(instance_id)).await?;

        if let Some(instance) = overview.instance {
            detail["playTime"] = Value::Number(instance.total_secs.into());
            detail["play_time"] = Value::Number(instance.total_secs.into());
            detail["lastPlayed"] = instance
                .last_played_at
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null);
            detail["last_played"] = instance
                .last_played_at
                .clone()
                .map(Value::String)
                .unwrap_or(Value::Null);
            detail["playtime_breakdown"] = serde_json::to_value(instance).unwrap_or(Value::Null);
        }

        Ok(())
    }

    pub async fn sync_with_remote_if_enabled<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
    ) -> AppResult<()> {
        let sync_settings = ConfigService::get_playtime_sync_settings(app);
        Self::write_local_snapshot(app, pool).await?;

        if !(sync_settings.enabled
            && sync_settings.auto_sync
            && Self::is_sync_configured(&sync_settings))
        {
            return Ok(());
        }

        Self::sync_remote(app, pool, &sync_settings).await
    }

    async fn run_session_loop<R: Runtime>(
        app: AppHandle<R>,
        pool: SqlitePool,
        instance_id: String,
        instance_name: String,
        started_at: DateTime<Utc>,
        mut stop_rx: oneshot::Receiver<DateTime<Utc>>,
    ) -> AppResult<()> {
        let mut interval = tokio::time::interval(Duration::from_secs(HEARTBEAT_INTERVAL_SECS));
        interval.tick().await;

        let mut accumulated_secs = 0i64;
        let mut flushed_secs = 0i64;

        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let now = Utc::now();
                    accumulated_secs = (now - started_at).num_seconds().max(accumulated_secs);

                    let checkpoint = SessionCheckpoint {
                        instance_id: instance_id.clone(),
                        instance_name: instance_name.clone(),
                        started_at: started_at.to_rfc3339(),
                        last_heartbeat_at: now.to_rfc3339(),
                        accumulated_secs,
                        flushed_secs,
                    };
                    Self::write_checkpoint(&app, &checkpoint).await?;

                    let flush_delta = accumulated_secs.saturating_sub(flushed_secs);
                    if flush_delta >= FLUSH_INTERVAL_SECS {
                        Self::apply_increment(
                            &app,
                            &pool,
                            &instance_id,
                            &instance_name,
                            flush_delta,
                            Some(now.to_rfc3339()),
                        )
                        .await?;
                        flushed_secs = accumulated_secs;

                        let flushed_checkpoint = SessionCheckpoint {
                            flushed_secs,
                            ..checkpoint
                        };
                        Self::write_checkpoint(&app, &flushed_checkpoint).await?;
                    }
                }
                result = &mut stop_rx => {
                    let ended_at = result.unwrap_or_else(|_| Utc::now());
                    accumulated_secs = (ended_at - started_at).num_seconds().max(accumulated_secs);
                    let final_delta = accumulated_secs.saturating_sub(flushed_secs);

                    Self::apply_increment(
                        &app,
                        &pool,
                        &instance_id,
                        &instance_name,
                        final_delta,
                        Some(ended_at.to_rfc3339()),
                    )
                    .await?;

                    Self::remove_checkpoint(&app, &instance_id).await?;
                    break;
                }
            }
        }

        Ok(())
    }

    async fn apply_increment<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        instance_name: &str,
        delta_secs: i64,
        last_played_at: Option<String>,
    ) -> AppResult<()> {
        Self::ensure_instance_row(app, pool, instance_id).await?;

        let normalized_last_played = last_played_at
            .clone()
            .and_then(|value| Self::normalize_last_played(Some(&value)));

        sqlx::query(
            "UPDATE instances
             SET playtime_secs = COALESCE(playtime_secs, 0) + ?,
                 pending_delta = COALESCE(pending_delta, 0) + ?,
                 last_played_at = ?,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = ?",
        )
        .bind(delta_secs.max(0))
        .bind(delta_secs.max(0))
        .bind(normalized_last_played.clone())
        .bind(instance_id)
        .execute(pool)
        .await?;

        let row = sqlx::query(
            "SELECT COALESCE(playtime_secs, 0) AS playtime_secs, last_played_at
             FROM instances
             WHERE id = ?",
        )
        .bind(instance_id)
        .fetch_one(pool)
        .await?;

        let total_secs: i64 = row.get("playtime_secs");
        let stored_last_played: Option<String> = row.try_get("last_played_at").unwrap_or(None);

        Self::write_instance_json(app, instance_id, total_secs, stored_last_played.clone()).await?;
        Self::write_local_snapshot(app, pool).await?;

        let _ = app.emit(
            "playtime-updated",
            serde_json::json!({
                "instanceId": instance_id,
                "instanceName": instance_name,
                "deltaSecs": delta_secs.max(0),
                "totalSecs": total_secs,
                "lastPlayedAt": stored_last_played,
            }),
        );

        Ok(())
    }

    async fn ensure_instance_row<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
    ) -> AppResult<()> {
        let exists = sqlx::query_scalar::<_, i64>("SELECT COUNT(1) FROM instances WHERE id = ?")
            .bind(instance_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

        if exists > 0 {
            return Ok(());
        }

        InstanceBindingService::upsert_instance_from_disk(app, pool, instance_id).await?;
        Ok(())
    }

    async fn write_instance_json<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        total_secs: i64,
        last_played_at: Option<String>,
    ) -> AppResult<()> {
        let base_path = ConfigService::get_base_path(app)?
            .ok_or_else(|| AppError::Generic("Base path is not configured".to_string()))?;
        let json_path = PathBuf::from(base_path)
            .join("instances")
            .join(instance_id)
            .join("instance.json");

        if !json_path.exists() {
            return Ok(());
        }

        let lock = lock_for_path(&json_path.to_string_lossy());
        let _guard = lock.lock().await;

        let content = fs::read_to_string(&json_path)?;
        let mut json: Value = serde_json::from_str(&content)?;
        json["playTime"] = Value::Number(total_secs.max(0).into());
        json["lastPlayed"] = last_played_at.map(Value::String).unwrap_or(Value::Null);

        fs::write(&json_path, serde_json::to_string_pretty(&json)?)?;
        Ok(())
    }

    async fn write_local_snapshot<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
    ) -> AppResult<()> {
        let identity = Self::ensure_device_identity(app).await?;
        let stats = Self::load_local_stats(pool).await?;
        let stats_dir = Self::stats_dir(app)?;
        fs::create_dir_all(&stats_dir)?;

        let instances = stats
            .iter()
            .map(|item| {
                (
                    item.id.clone(),
                    SnapshotInstance {
                        name: item.name.clone(),
                        playtime: item.playtime_secs.max(0),
                        last_played: item.last_played_at.clone(),
                    },
                )
            })
            .collect::<HashMap<_, _>>();

        let snapshot = DeviceSnapshot {
            device: DeviceEntry {
                id: identity.device_id.clone(),
                name: identity.device_name.clone(),
                last_sync: Utc::now().to_rfc3339(),
            },
            instances,
            device_total: stats.iter().map(|item| item.playtime_secs.max(0)).sum(),
        };

        let local_snapshot_path = stats_dir.join(format!("{}.json", identity.device_id));
        fs::write(&local_snapshot_path, serde_json::to_string_pretty(&snapshot)?)?;

        let mut manifest = Self::read_local_devices_manifest(app)
            .await
            .unwrap_or_else(|_| DevicesManifest::default());

        manifest.devices.retain(|device| device.id != identity.device_id);
        manifest.devices.push(snapshot.device.clone());
        manifest.devices.sort_by(|left, right| left.name.cmp(&right.name));

        let manifest_path = Self::devices_manifest_path(app)?;
        fs::write(manifest_path, serde_json::to_string_pretty(&manifest)?)?;

        Ok(())
    }

    async fn load_local_stats(pool: &SqlitePool) -> AppResult<Vec<LocalInstanceStat>> {
        let rows = sqlx::query(
            "SELECT id, name, COALESCE(playtime_secs, 0) AS playtime_secs, last_played_at
             FROM instances
             ORDER BY name COLLATE NOCASE ASC",
        )
        .fetch_all(pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| LocalInstanceStat {
                id: row.get("id"),
                name: row.get("name"),
                playtime_secs: row.get("playtime_secs"),
                last_played_at: row.try_get("last_played_at").unwrap_or(None),
            })
            .collect())
    }

    async fn read_cached_snapshots<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<DeviceSnapshot>> {
        let stats_dir = match Self::stats_dir(app) {
            Ok(path) => path,
            Err(_) => return Ok(Vec::new()),
        };

        if !stats_dir.exists() {
            return Ok(Vec::new());
        }

        let mut snapshots = Vec::new();
        for entry in fs::read_dir(stats_dir)? {
            let path = match entry {
                Ok(item) => item.path(),
                Err(_) => continue,
            };

            if path.extension().and_then(|ext| ext.to_str()) != Some("json") {
                continue;
            }

            let snapshot: DeviceSnapshot = match fs::read_to_string(&path)
                .ok()
                .and_then(|content| serde_json::from_str(&content).ok())
            {
                Some(value) => value,
                None => continue,
            };

            snapshots.push(snapshot);
        }

        Ok(snapshots)
    }

    async fn sync_remote<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        settings: &PlaytimeSyncSettings,
    ) -> AppResult<()> {
        let identity = Self::ensure_device_identity(app).await?;
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(20))
            .build()?;

        let remote_root = Self::normalized_remote_root(settings);
        let stats_root = format!("{}/stats", remote_root);

        Self::ensure_remote_collection(&client, settings, &remote_root).await?;
        Self::ensure_remote_collection(&client, settings, &stats_root).await?;

        let mut remote_manifest = Self::fetch_remote_json::<DevicesManifest>(
            &client,
            settings,
            &format!("{}/devices.json", remote_root),
        )
        .await?
        .unwrap_or_default();

        let cached_stats_dir = Self::stats_dir(app)?;
        fs::create_dir_all(&cached_stats_dir)?;

        let remote_device_ids = remote_manifest
            .devices
            .iter()
            .map(|device| device.id.clone())
            .collect::<Vec<_>>();

        for device_id in &remote_device_ids {
            if device_id == &identity.device_id {
                continue;
            }

            if let Some(snapshot) = Self::fetch_remote_json::<DeviceSnapshot>(
                &client,
                settings,
                &format!("{}/{}.json", stats_root, device_id),
            )
            .await?
            {
                let cache_path = cached_stats_dir.join(format!("{}.json", device_id));
                fs::write(cache_path, serde_json::to_string_pretty(&snapshot)?)?;
            }
        }

        for entry in fs::read_dir(&cached_stats_dir)? {
            let path = match entry {
                Ok(item) => item.path(),
                Err(_) => continue,
            };
            let file_device_id = match path.file_stem().and_then(|stem| stem.to_str()) {
                Some(value) => value.to_string(),
                None => continue,
            };

            if file_device_id == identity.device_id {
                continue;
            }

            if !remote_device_ids.iter().any(|item| item == &file_device_id) {
                let _ = fs::remove_file(path);
            }
        }

        let local_snapshot_path = cached_stats_dir.join(format!("{}.json", identity.device_id));
        let local_snapshot_content = fs::read_to_string(&local_snapshot_path)?;

        Self::put_remote_json(
            &client,
            settings,
            &format!("{}/{}.json", stats_root, identity.device_id),
            &local_snapshot_content,
        )
        .await?;

        remote_manifest.devices.retain(|device| device.id != identity.device_id);
        remote_manifest.devices.push(DeviceEntry {
            id: identity.device_id,
            name: identity.device_name,
            last_sync: Utc::now().to_rfc3339(),
        });
        remote_manifest
            .devices
            .sort_by(|left, right| left.name.cmp(&right.name));

        Self::put_remote_json(
            &client,
            settings,
            &format!("{}/devices.json", remote_root),
            &serde_json::to_string_pretty(&remote_manifest)?,
        )
        .await?;

        sqlx::query("UPDATE instances SET pending_delta = 0 WHERE pending_delta IS NOT NULL")
            .execute(pool)
            .await?;

        Ok(())
    }

    async fn fetch_remote_json<T: for<'de> Deserialize<'de>>(
        client: &reqwest::Client,
        settings: &PlaytimeSyncSettings,
        remote_path: &str,
    ) -> AppResult<Option<T>> {
        let response = Self::authorized_request(client, settings, reqwest::Method::GET, remote_path)
            .send()
            .await?;

        if response.status() == reqwest::StatusCode::NOT_FOUND {
            return Ok(None);
        }

        if !response.status().is_success() {
            return Err(AppError::Generic(format!(
                "Playtime sync request failed: {}",
                response.status()
            )));
        }

        Ok(Some(response.json::<T>().await?))
    }

    async fn put_remote_json(
        client: &reqwest::Client,
        settings: &PlaytimeSyncSettings,
        remote_path: &str,
        body: &str,
    ) -> AppResult<()> {
        let response = Self::authorized_request(client, settings, reqwest::Method::PUT, remote_path)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body.to_string())
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(AppError::Generic(format!(
                "Failed to upload playtime snapshot: {}",
                response.status()
            )));
        }

        Ok(())
    }

    async fn ensure_remote_collection(
        client: &reqwest::Client,
        settings: &PlaytimeSyncSettings,
        remote_path: &str,
    ) -> AppResult<()> {
        let method = reqwest::Method::from_bytes(b"MKCOL")
            .map_err(|error| AppError::Generic(error.to_string()))?;
        let response = Self::authorized_request(client, settings, method, remote_path)
            .send()
            .await?;

        let status = response.status();
        if status.is_success()
            || status == reqwest::StatusCode::METHOD_NOT_ALLOWED
            || status == reqwest::StatusCode::CONFLICT
        {
            return Ok(());
        }

        Err(AppError::Generic(format!(
            "Failed to create playtime sync directory: {}",
            status
        )))
    }

    fn authorized_request(
        client: &reqwest::Client,
        settings: &PlaytimeSyncSettings,
        method: reqwest::Method,
        remote_path: &str,
    ) -> reqwest::RequestBuilder {
        let url = Self::join_remote_url(&settings.webdav_url, remote_path);
        let builder = client.request(method, url);

        if settings.username.trim().is_empty() {
            builder
        } else {
            builder.basic_auth(settings.username.clone(), Some(settings.password.clone()))
        }
    }

    async fn write_checkpoint<R: Runtime>(
        app: &AppHandle<R>,
        checkpoint: &SessionCheckpoint,
    ) -> AppResult<()> {
        let path = Self::checkpoint_path(app, &checkpoint.instance_id)?;
        let lock = lock_for_path(&path.to_string_lossy());
        let _guard = lock.lock().await;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }

        fs::write(path, serde_json::to_string_pretty(checkpoint)?)?;
        Ok(())
    }

    async fn remove_checkpoint<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> AppResult<()> {
        let path = Self::checkpoint_path(app, instance_id)?;
        if path.exists() {
            fs::remove_file(path)?;
        }
        Ok(())
    }

    async fn read_local_devices_manifest<R: Runtime>(
        app: &AppHandle<R>,
    ) -> AppResult<DevicesManifest> {
        let path = Self::devices_manifest_path(app)?;
        if !path.exists() {
            return Ok(DevicesManifest::default());
        }

        let content = fs::read_to_string(path)?;
        Ok(serde_json::from_str(&content)?)
    }

    async fn ensure_device_identity<R: Runtime>(app: &AppHandle<R>) -> AppResult<DeviceIdentity> {
        let settings_path = Self::settings_path(app)?;

        if let Some(parent) = settings_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut root = match fs::read_to_string(&settings_path) {
            Ok(content) => serde_json::from_str::<Value>(&content)
                .unwrap_or_else(|_| Value::Object(Map::new())),
            Err(_) => Value::Object(Map::new()),
        };

        let general = Self::ensure_nested_object(&mut root, &["state", "settings", "general"]);
        let mut changed = false;

        let device_id = general
            .get("deviceId")
            .and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(|| {
                changed = true;
                uuid::Uuid::new_v4().to_string()
            });

        let device_name = general
            .get("deviceName")
            .and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty())
            .map(|value| value.to_string())
            .unwrap_or_else(|| {
                changed = true;
                format!(
                    "Pi-{}-{}",
                    std::env::consts::OS,
                    device_id.chars().take(4).collect::<String>().to_uppercase()
                )
            });

        if changed {
            general.insert("deviceId".to_string(), Value::String(device_id.clone()));
            general.insert("deviceName".to_string(), Value::String(device_name.clone()));

            let lock = lock_for_path(&settings_path.to_string_lossy());
            let _guard = lock.lock().await;
            fs::write(&settings_path, serde_json::to_string_pretty(&root)?)?;
        }

        Ok(DeviceIdentity {
            device_id,
            device_name,
        })
    }

    pub fn normalize_last_played(value: Option<&str>) -> Option<String> {
        let raw = value?.trim();
        if raw.is_empty() {
            return None;
        }

        let lowered = raw.to_ascii_lowercase();
        if matches!(lowered.as_str(), "never" | "never played" | "null")
            || raw == "从未游玩"
            || raw == "从未进行游戏"
        {
            return None;
        }

        if let Some(parsed) = Self::parse_timestamp(Some(raw)) {
            return Some(parsed.to_rfc3339());
        }

        None
    }

    fn parse_timestamp(value: Option<&str>) -> Option<DateTime<Utc>> {
        let raw = value?.trim();
        if raw.is_empty() {
            return None;
        }

        if let Ok(parsed) = DateTime::parse_from_rfc3339(raw) {
            return Some(parsed.with_timezone(&Utc));
        }

        if let Ok(parsed) = NaiveDateTime::parse_from_str(raw, "%Y-%m-%d %H:%M:%S") {
            return Some(parsed.and_utc());
        }

        None
    }

    fn latest_timestamp<I>(current: Option<String>, values: I) -> Option<String>
    where
        I: IntoIterator<Item = String>,
    {
        let mut best = current;

        for value in values {
            best = match best {
                Some(existing) => {
                    let existing_ts = Self::parse_timestamp(Some(&existing));
                    let incoming_ts = Self::parse_timestamp(Some(&value));

                    match (existing_ts, incoming_ts) {
                        (Some(existing_time), Some(incoming_time)) => {
                            if incoming_time > existing_time {
                                Some(value)
                            } else {
                                Some(existing)
                            }
                        }
                        (None, Some(_)) => Some(value),
                        _ => Some(existing),
                    }
                }
                None => Some(value),
            };
        }

        best
    }

    fn ensure_nested_object<'a>(
        value: &'a mut Value,
        keys: &[&str],
    ) -> &'a mut Map<String, Value> {
        let mut current = value;
        for key in keys {
            if !current.is_object() {
                *current = Value::Object(Map::new());
            }

            let object = current.as_object_mut().unwrap();
            current = object
                .entry((*key).to_string())
                .or_insert_with(|| Value::Object(Map::new()));
        }

        if !current.is_object() {
            *current = Value::Object(Map::new());
        }

        current.as_object_mut().unwrap()
    }

    fn settings_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        let base_path = ConfigService::get_base_path(app)?
            .ok_or_else(|| AppError::Generic("Base path is not configured".to_string()))?;
        Ok(PathBuf::from(base_path).join("config").join("settings.json"))
    }

    fn playtime_root<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        let base_path = ConfigService::get_base_path(app)?
            .ok_or_else(|| AppError::Generic("Base path is not configured".to_string()))?;
        Ok(PathBuf::from(base_path).join("config").join("playtime"))
    }

    fn sessions_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        Ok(Self::playtime_root(app)?.join("sessions"))
    }

    fn checkpoint_path<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> AppResult<PathBuf> {
        Ok(Self::sessions_dir(app)?.join(format!("{}.json", instance_id)))
    }

    fn stats_dir<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        Ok(Self::playtime_root(app)?.join("stats"))
    }

    fn devices_manifest_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        Ok(Self::playtime_root(app)?.join("devices.json"))
    }

    fn is_sync_configured(settings: &PlaytimeSyncSettings) -> bool {
        !settings.webdav_url.trim().is_empty()
    }

    fn normalized_remote_root(settings: &PlaytimeSyncSettings) -> String {
        let raw = settings.remote_path.trim();
        let normalized = if raw.is_empty() {
            DEFAULT_REMOTE_ROOT
        } else {
            raw
        };

        normalized.trim_matches('/').to_string()
    }

    fn join_remote_url(base_url: &str, remote_path: &str) -> String {
        format!(
            "{}/{}",
            base_url.trim_end_matches('/'),
            remote_path.trim_start_matches('/')
        )
    }
}
