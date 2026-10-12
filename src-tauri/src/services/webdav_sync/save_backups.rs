use crate::domain::library::{WebDavSaveBackupSyncResult, WebDavSyncConfig};
use crate::services::config::ConfigService;
use crate::services::instance::save_manager::{
    SaveBackupMetadata, SaveManagerService, SaveRestoreResult,
};
use reqwest::{header, Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;

use super::constants::{
    REMOTE_ROOT, SAVE_BACKUPS_ARCHIVE_PATH, SAVE_BACKUPS_ARCHIVE_TEMP_PATH,
    SAVE_BACKUPS_BACKUPS_DIR, SAVE_BACKUPS_DATA_DIR, SAVE_BACKUPS_DIR, SAVE_BACKUPS_MANIFEST_PATH,
};
use super::{remote, util};

const SAVE_BACKUP_SYNC_SCHEMA_VERSION: i32 = 2;
const SAVE_BACKUP_LOCK_TIMEOUT_SECONDS: u64 = 300;

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
struct SaveBackupsManifest {
    schema_version: i32,
    updated_at: i64,
    file_count: usize,
    backup_count: usize,
    total_size: u64,
    content_hash: String,
    #[serde(default)]
    selected_worlds: Vec<String>,
    #[serde(default)]
    files: Vec<FileFingerprint>,
}

#[derive(Debug, Default, Clone)]
struct LocalSaveBackupsSnapshot {
    updated_at: i64,
    file_count: usize,
    backup_count: usize,
    total_size: u64,
    content_hash: String,
    files: Vec<FileFingerprint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FileFingerprint {
    relative_path: String,
    size: u64,
    modified_at: i64,
    content_hash: String,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavRemoteSaveBackup {
    pub backup_id: String,
    pub remote_instance_id: String,
    pub remote_world_key: String,
    pub remote_prefix: String,
    pub file_count: usize,
    pub total_size: u64,
    pub metadata: SaveBackupMetadata,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavSaveBackupDownloadResult {
    pub backup_id: String,
    pub target_instance_id: String,
    pub downloaded_backups: usize,
    pub downloaded_files: usize,
    pub restored: bool,
    pub restore_result: Option<SaveRestoreResult>,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebDavSaveBackupDeleteResult {
    pub backup_id: String,
    pub deleted_files: usize,
    pub remaining_backups: usize,
}

#[derive(Clone)]
struct RemoteBackupRecord {
    meta: SaveBackupMetadata,
    prefix: String,
    instance_id: String,
    world_key: String,
    files: Vec<FileFingerprint>,
}

pub(crate) async fn sync_save_backups<R: Runtime>(
    app: &AppHandle<R>,
    config: &WebDavSyncConfig,
) -> Result<WebDavSaveBackupSyncResult, String> {
    util::validate_base_url(&config.base_url)?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;
    let remote_created = ensure_save_backup_layout(&client, config).await?;
    let lock_token = lock_save_backup_directory(&client, config).await?;
    let sync_result =
        sync_save_backups_locked(app, config, &client, remote_created, &lock_token).await;
    let unlock_result = unlock_save_backup_directory(&client, config, &lock_token).await;

    match (sync_result, unlock_result) {
        (Ok(result), Ok(())) => Ok(result),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(unlock_error)) => Err(format!(
            "save backup sync completed, but failed to release WebDAV lock: {}",
            unlock_error
        )),
        (Err(error), Err(unlock_error)) => Err(format!(
            "{}; additionally failed to release WebDAV lock: {}",
            error, unlock_error
        )),
    }
}

pub(crate) async fn list_remote_save_backups(
    config: &WebDavSyncConfig,
) -> Result<Vec<WebDavRemoteSaveBackup>, String> {
    util::validate_base_url(&config.base_url)?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;
    ensure_save_backup_layout(&client, config).await?;

    let Some(manifest) = download_manifest(&client, config).await? else {
        return Ok(Vec::new());
    };

    let mut records = load_remote_backup_records(&client, config, &manifest).await?;
    records.sort_by(|left, right| {
        right
            .meta
            .created_at
            .cmp(&left.meta.created_at)
            .then_with(|| left.meta.backup_id.cmp(&right.meta.backup_id))
    });

    Ok(records
        .into_iter()
        .map(|record| WebDavRemoteSaveBackup {
            backup_id: record.meta.backup_id.clone(),
            remote_instance_id: record.instance_id,
            remote_world_key: record.world_key,
            remote_prefix: record.prefix,
            file_count: record.files.len(),
            total_size: record.files.iter().map(|file| file.size).sum(),
            metadata: record.meta,
        })
        .collect())
}

pub(crate) async fn download_remote_save_backup<R: Runtime>(
    app: &AppHandle<R>,
    config: &WebDavSyncConfig,
    backup_id: &str,
    target_instance_id: &str,
    restore_to_saves: bool,
    restore_configs: bool,
    auto_backup_current: bool,
) -> Result<WebDavSaveBackupDownloadResult, String> {
    util::validate_base_url(&config.base_url)?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;
    ensure_save_backup_layout(&client, config).await?;

    let manifest = download_manifest(&client, config)
        .await?
        .ok_or_else(|| "WebDAV save backup manifest does not exist".to_string())?;
    let records = load_remote_backup_records(&client, config, &manifest).await?;
    let records_by_id = records
        .into_iter()
        .map(|record| (record.meta.backup_id.clone(), record))
        .collect::<HashMap<_, _>>();

    if !records_by_id.contains_key(backup_id) {
        return Err(format!("WebDAV save backup not found: {backup_id}"));
    }

    let ordered_backup_ids = collect_required_backup_chain(backup_id, &records_by_id)?;
    let downloaded_files = download_backup_chain_to_local(
        app,
        config,
        &client,
        target_instance_id,
        &ordered_backup_ids,
        &records_by_id,
    )
    .await?;

    let restore_result = if restore_to_saves {
        Some(SaveManagerService::restore_backup(
            app,
            target_instance_id,
            backup_id,
            restore_configs,
            auto_backup_current,
        )?)
    } else {
        None
    };

    Ok(WebDavSaveBackupDownloadResult {
        backup_id: backup_id.to_string(),
        target_instance_id: target_instance_id.to_string(),
        downloaded_backups: ordered_backup_ids.len(),
        downloaded_files,
        restored: restore_result.is_some(),
        restore_result,
    })
}

pub(crate) async fn delete_remote_save_backup(
    config: &WebDavSyncConfig,
    backup_id: &str,
) -> Result<WebDavSaveBackupDeleteResult, String> {
    util::validate_base_url(&config.base_url)?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;
    ensure_save_backup_layout(&client, config).await?;

    let lock_token = lock_save_backup_directory(&client, config).await?;
    let delete_result =
        delete_remote_save_backup_locked(config, &client, backup_id, &lock_token).await;
    let unlock_result = unlock_save_backup_directory(&client, config, &lock_token).await;

    match (delete_result, unlock_result) {
        (Ok(result), Ok(())) => Ok(result),
        (Err(error), Ok(())) => Err(error),
        (Ok(_), Err(unlock_error)) => Err(format!(
            "save backup delete completed, but failed to release WebDAV lock: {}",
            unlock_error
        )),
        (Err(error), Err(unlock_error)) => Err(format!(
            "{}; additionally failed to release WebDAV lock: {}",
            error, unlock_error
        )),
    }
}

async fn sync_save_backups_locked<R: Runtime>(
    app: &AppHandle<R>,
    config: &WebDavSyncConfig,
    client: &Client,
    remote_created: bool,
    lock_token: &str,
) -> Result<WebDavSaveBackupSyncResult, String> {
    let backups_root = local_save_backups_root(app)?;
    let selected_worlds = SaveManagerService::load_webdav_backup_selection(app)?.selected_worlds;
    let save_backup_mode = normalize_save_backup_mode(&config.save_backup_mode);
    let backup_only = save_backup_mode == "backup";
    let local_snapshot = scan_local_save_backups_snapshot(&backups_root, &selected_worlds)?;
    let remote_manifest = download_manifest(client, config).await?;

    let mut uploaded_files = 0usize;
    let mut downloaded_files = 0usize;
    let mut archive_updated = false;
    let mut restored = false;
    let mut verified = true;
    let mut remote_files = remote_manifest
        .as_ref()
        .map(|manifest| manifest.file_count)
        .unwrap_or(0);
    let mut remote_backups = remote_manifest
        .as_ref()
        .map(|manifest| manifest.backup_count)
        .unwrap_or(0);

    if selected_worlds.is_empty() || local_snapshot.file_count == 0 {
        delete_remote_save_backup_tree(client, config, lock_token).await?;
        return Ok(WebDavSaveBackupSyncResult {
            remote_root: util::join_remote_url(&config.base_url, SAVE_BACKUPS_DATA_DIR),
            remote_created,
            mode: save_backup_mode,
            uploaded_files,
            downloaded_files,
            local_files: local_snapshot.file_count,
            remote_files: 0,
            local_backups: local_snapshot.backup_count,
            remote_backups: 0,
            archive_updated: true,
            restored,
            verified,
        });
    }

    if !backup_only {
        if let Some(manifest) = remote_manifest.as_ref() {
            let remote_differs = manifest.content_hash != local_snapshot.content_hash;
            let remote_is_newer = manifest.updated_at > local_snapshot.updated_at;
            let remote_selection: HashSet<String> =
                manifest.selected_worlds.iter().cloned().collect();
            if remote_differs
                && !manifest.content_hash.is_empty()
                && !manifest.files.is_empty()
                && remote_selection == selected_worlds
                && remote_is_newer
            {
                restore_remote_tree(client, config, &backups_root, manifest, &selected_worlds)
                    .await?;
                downloaded_files = manifest.file_count;
                restored = true;

                let restored_snapshot =
                    scan_local_save_backups_snapshot(&backups_root, &selected_worlds)?;
                verified = restored_snapshot.content_hash == manifest.content_hash;
                if !verified {
                    return Err(
                        "restored WebDAV save backup files did not match manifest".to_string()
                    );
                }

                return Ok(WebDavSaveBackupSyncResult {
                    remote_root: util::join_remote_url(&config.base_url, SAVE_BACKUPS_DATA_DIR),
                    remote_created,
                    mode: save_backup_mode,
                    uploaded_files,
                    downloaded_files,
                    local_files: restored_snapshot.file_count,
                    remote_files: manifest.file_count,
                    local_backups: restored_snapshot.backup_count,
                    remote_backups: manifest.backup_count,
                    archive_updated,
                    restored,
                    verified,
                });
            }
        }
    }

    let remote_matches_local = remote_manifest
        .as_ref()
        .map(|manifest| manifest.content_hash == local_snapshot.content_hash)
        .unwrap_or(false);

    if !remote_matches_local {
        let manifest = SaveBackupsManifest {
            schema_version: SAVE_BACKUP_SYNC_SCHEMA_VERSION,
            updated_at: local_snapshot.updated_at.max(util::now_millis()),
            file_count: local_snapshot.file_count,
            backup_count: local_snapshot.backup_count,
            total_size: local_snapshot.total_size,
            content_hash: local_snapshot.content_hash.clone(),
            selected_worlds: selected_worlds.iter().cloned().collect(),
            files: local_snapshot.files.clone(),
        };

        publish_remote_tree(
            client,
            config,
            &backups_root,
            &local_snapshot,
            &manifest,
            lock_token,
        )
        .await?;
        uploaded_files = local_snapshot.file_count;
        remote_files = local_snapshot.file_count;
        remote_backups = local_snapshot.backup_count;
        archive_updated = true;
    }

    Ok(WebDavSaveBackupSyncResult {
        remote_root: util::join_remote_url(&config.base_url, SAVE_BACKUPS_DATA_DIR),
        remote_created,
        mode: save_backup_mode,
        uploaded_files,
        downloaded_files,
        local_files: local_snapshot.file_count,
        remote_files,
        local_backups: local_snapshot.backup_count,
        remote_backups,
        archive_updated,
        restored,
        verified,
    })
}

async fn ensure_save_backup_layout(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<bool, String> {
    let mut remote_created = false;
    for remote_path in [
        REMOTE_ROOT,
        SAVE_BACKUPS_DIR,
        SAVE_BACKUPS_BACKUPS_DIR,
        SAVE_BACKUPS_DATA_DIR,
    ] {
        remote_created |= remote::ensure_collection(client, config, remote_path).await?;
    }
    Ok(remote_created)
}

fn local_save_backups_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "base path is not configured".to_string())?;
    Ok(PathBuf::from(base_path).join("backups").join("saves"))
}

fn normalize_save_backup_mode(value: &str) -> String {
    if value.eq_ignore_ascii_case("sync") {
        "sync".to_string()
    } else {
        "backup".to_string()
    }
}

fn system_time_to_millis(value: SystemTime) -> i64 {
    value
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn is_transient_backup_path(relative_path: &str) -> bool {
    relative_path
        .split('/')
        .any(|segment| segment.starts_with('.') || segment.ends_with(".tmp"))
}

fn selected_backup_path(relative_path: &str, selected_worlds: &HashSet<String>) -> bool {
    let mut parts = relative_path.split('/');
    let Some(instance_id) = parts.next() else {
        return false;
    };
    let Some(world_identity) = parts.next() else {
        return false;
    };
    selected_worlds.contains(&SaveManagerService::webdav_selection_key(
        instance_id,
        world_identity,
    ))
}

fn selected_world_prefixes(selected_worlds: &HashSet<String>) -> Vec<String> {
    selected_worlds
        .iter()
        .filter_map(|key| {
            let (instance_id, world_identity) = key.split_once('/')?;
            Some(format!("{instance_id}/{world_identity}"))
        })
        .collect()
}

fn md5_file(path: &Path) -> Result<String, String> {
    let mut file = File::open(path).map_err(|error| error.to_string())?;
    let mut context = md5::Context::new();
    let mut buffer = [0u8; 64 * 1024];

    loop {
        let read = file.read(&mut buffer).map_err(|error| error.to_string())?;
        if read == 0 {
            break;
        }
        context.consume(&buffer[..read]);
    }

    Ok(format!("{:x}", context.finalize()))
}

fn scan_local_save_backups_snapshot(
    root: &Path,
    selected_worlds: &HashSet<String>,
) -> Result<LocalSaveBackupsSnapshot, String> {
    if !root.exists() {
        return Ok(LocalSaveBackupsSnapshot::default());
    }

    let mut files = Vec::new();
    let mut backup_ids = BTreeSet::new();

    for entry in WalkDir::new(root)
        .into_iter()
        .filter_map(|entry| entry.ok())
    {
        if !entry.file_type().is_file() {
            continue;
        }

        let path = entry.path();
        let relative_path = match path.strip_prefix(root) {
            Ok(value) => value.to_string_lossy().replace('\\', "/"),
            Err(_) => continue,
        };
        if relative_path.is_empty() || is_transient_backup_path(&relative_path) {
            continue;
        }
        if !selected_backup_path(&relative_path, selected_worlds) {
            continue;
        }

        let parts = relative_path.split('/').collect::<Vec<_>>();
        if parts.len() >= 4 && relative_path.ends_with("/meta.json") {
            backup_ids.insert(format!("{}/{}/{}", parts[0], parts[1], parts[2]));
        }

        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let modified_at = metadata
            .modified()
            .map(system_time_to_millis)
            .unwrap_or_default();

        files.push(FileFingerprint {
            relative_path,
            size: metadata.len(),
            modified_at,
            content_hash: md5_file(path)?,
        });
    }

    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let mut digest_material = String::new();
    let mut updated_at = 0i64;
    let mut total_size = 0u64;
    for file in &files {
        updated_at = updated_at.max(file.modified_at);
        total_size = total_size.saturating_add(file.size);
        digest_material.push_str(&file.relative_path);
        digest_material.push('\0');
        digest_material.push_str(&file.size.to_string());
        digest_material.push('\0');
        digest_material.push_str(&file.content_hash);
        digest_material.push('\n');
    }

    Ok(LocalSaveBackupsSnapshot {
        updated_at,
        file_count: files.len(),
        backup_count: backup_ids.len(),
        total_size,
        content_hash: if files.is_empty() {
            String::new()
        } else {
            format!("{:x}", md5::compute(digest_material.as_bytes()))
        },
        files,
    })
}

async fn publish_remote_tree(
    client: &Client,
    config: &WebDavSyncConfig,
    backups_root: &Path,
    snapshot: &LocalSaveBackupsSnapshot,
    manifest: &SaveBackupsManifest,
    lock_token: &str,
) -> Result<(), String> {
    delete_remote_save_backup_tree(client, config, lock_token).await?;
    ensure_collection_locked(client, config, SAVE_BACKUPS_BACKUPS_DIR, lock_token).await?;
    ensure_collection_locked(client, config, SAVE_BACKUPS_DATA_DIR, lock_token).await?;

    for file in &snapshot.files {
        let local_path = backups_root.join(
            file.relative_path
                .replace('/', std::path::MAIN_SEPARATOR_STR),
        );
        let remote_path = format!("{SAVE_BACKUPS_DATA_DIR}/{}", file.relative_path);
        ensure_remote_parent_collections(client, config, &remote_path, lock_token).await?;
        let body = fs::read(&local_path).map_err(|error| error.to_string())?;
        upload_bytes(
            client,
            config,
            &remote_path,
            "application/octet-stream",
            body,
            Some(lock_token),
        )
        .await?;
    }

    let manifest_bytes = serde_json::to_vec_pretty(manifest).map_err(|error| error.to_string())?;
    upload_bytes(
        client,
        config,
        SAVE_BACKUPS_MANIFEST_PATH,
        "application/json",
        manifest_bytes,
        Some(lock_token),
    )
    .await
}

async fn restore_remote_tree(
    client: &Client,
    config: &WebDavSyncConfig,
    backups_root: &Path,
    manifest: &SaveBackupsManifest,
    selected_worlds: &HashSet<String>,
) -> Result<(), String> {
    let parent = backups_root
        .parent()
        .ok_or_else(|| "invalid local save backups directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let temp_dir = parent.join(format!(".save-backups-webdav-{}", Uuid::new_v4()));
    remove_dir_if_exists(&temp_dir)?;
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let result = async {
        for entry in &manifest.selected_worlds {
            let _ = entry;
        }

        let remote_files = list_manifest_files(manifest);
        for file in remote_files {
            if !selected_backup_path(&file.relative_path, selected_worlds) {
                continue;
            }
            let body = download_remote_file(client, config, &file.relative_path).await?;
            let target = temp_dir.join(
                file.relative_path
                    .replace('/', std::path::MAIN_SEPARATOR_STR),
            );
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            let mut output = File::create(&target).map_err(|error| error.to_string())?;
            output.write_all(&body).map_err(|error| error.to_string())?;
        }

        let extracted_snapshot = scan_local_save_backups_snapshot(&temp_dir, selected_worlds)?;
        if extracted_snapshot.content_hash != manifest.content_hash {
            return Err("downloaded save backup files hash mismatch".to_string());
        }

        fs::create_dir_all(backups_root).map_err(|error| error.to_string())?;
        for prefix in selected_world_prefixes(selected_worlds) {
            let temp_world = temp_dir.join(prefix.replace('/', std::path::MAIN_SEPARATOR_STR));
            let target_world =
                backups_root.join(prefix.replace('/', std::path::MAIN_SEPARATOR_STR));
            let rollback = parent.join(format!(".save-backups-rollback-{}", Uuid::new_v4()));
            if target_world.exists() {
                move_dir_with_fallback(&target_world, &rollback)?;
            }
            if temp_world.exists() {
                if let Some(parent) = target_world.parent() {
                    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                }
                if let Err(error) = move_dir_with_fallback(&temp_world, &target_world) {
                    if target_world.exists() {
                        let _ = remove_dir_if_exists(&target_world);
                    }
                    if rollback.exists() {
                        let _ = move_dir_with_fallback(&rollback, &target_world);
                    }
                    return Err(error);
                }
            }
            let _ = remove_dir_if_exists(&rollback);
        }

        Ok(())
    }
    .await;

    let _ = remove_dir_if_exists(&temp_dir);
    result
}

async fn load_remote_backup_records(
    client: &Client,
    config: &WebDavSyncConfig,
    manifest: &SaveBackupsManifest,
) -> Result<Vec<RemoteBackupRecord>, String> {
    let mut prefixes = BTreeSet::new();
    for file in &manifest.files {
        validate_manifest_relative_path(&file.relative_path)?;
        let parts = file.relative_path.split('/').collect::<Vec<_>>();
        if parts.len() >= 4 && parts[3..].join("/") == "meta.json" {
            prefixes.insert(parts[..3].join("/"));
        }
    }

    let mut records = Vec::new();
    for prefix in prefixes {
        let meta_path = format!("{prefix}/meta.json");
        let meta_bytes = download_remote_file(client, config, &meta_path).await?;
        if md5_bytes(&meta_bytes)
            != manifest_hash_for_path(manifest, &meta_path).unwrap_or_default()
        {
            return Err(format!(
                "WebDAV save backup metadata hash mismatch: {meta_path}"
            ));
        }
        let meta = serde_json::from_slice::<SaveBackupMetadata>(&meta_bytes)
            .map_err(|error| format!("invalid WebDAV save backup metadata: {error}"))?;
        let parts = prefix.split('/').collect::<Vec<_>>();
        let instance_id = parts.get(0).copied().unwrap_or_default().to_string();
        let world_key = parts.get(1).copied().unwrap_or_default().to_string();
        let files = manifest
            .files
            .iter()
            .filter(|file| path_has_prefix(&file.relative_path, &prefix))
            .cloned()
            .collect::<Vec<_>>();

        records.push(RemoteBackupRecord {
            meta,
            prefix,
            instance_id,
            world_key,
            files,
        });
    }

    Ok(records)
}

fn manifest_hash_for_path(manifest: &SaveBackupsManifest, relative_path: &str) -> Option<String> {
    manifest
        .files
        .iter()
        .find(|file| file.relative_path == relative_path)
        .map(|file| file.content_hash.clone())
}

fn path_has_prefix(relative_path: &str, prefix: &str) -> bool {
    relative_path == prefix
        || relative_path
            .strip_prefix(prefix)
            .map(|rest| rest.starts_with('/'))
            .unwrap_or(false)
}

fn validate_manifest_relative_path(relative_path: &str) -> Result<(), String> {
    if relative_path.trim().is_empty() {
        return Err("manifest contains an empty relative path".to_string());
    }
    let path = Path::new(relative_path);
    if path.is_absolute()
        || path
            .components()
            .any(|component| matches!(component, Component::ParentDir | Component::Prefix(_)))
    {
        return Err(format!(
            "manifest contains an unsafe relative path: {}",
            relative_path
        ));
    }
    Ok(())
}

fn collect_required_backup_chain(
    backup_id: &str,
    records_by_id: &HashMap<String, RemoteBackupRecord>,
) -> Result<Vec<String>, String> {
    fn visit(
        backup_id: &str,
        records_by_id: &HashMap<String, RemoteBackupRecord>,
        visiting: &mut HashSet<String>,
        visited: &mut HashSet<String>,
        ordered: &mut Vec<String>,
    ) -> Result<(), String> {
        if visited.contains(backup_id) {
            return Ok(());
        }
        if !visiting.insert(backup_id.to_string()) {
            return Err(format!("WebDAV save backup dependency cycle: {backup_id}"));
        }

        let record = records_by_id
            .get(backup_id)
            .ok_or_else(|| format!("WebDAV save backup not found: {backup_id}"))?;
        if record.meta.backup_mode == "differential" {
            let base_id = record.meta.base_backup_id.as_deref().ok_or_else(|| {
                format!("differential WebDAV save backup is missing base id: {backup_id}")
            })?;
            visit(base_id, records_by_id, visiting, visited, ordered)?;
        }

        visiting.remove(backup_id);
        visited.insert(backup_id.to_string());
        ordered.push(backup_id.to_string());
        Ok(())
    }

    let mut visiting = HashSet::new();
    let mut visited = HashSet::new();
    let mut ordered = Vec::new();
    visit(
        backup_id,
        records_by_id,
        &mut visiting,
        &mut visited,
        &mut ordered,
    )?;
    Ok(ordered)
}

async fn download_backup_chain_to_local<R: Runtime>(
    app: &AppHandle<R>,
    config: &WebDavSyncConfig,
    client: &Client,
    target_instance_id: &str,
    ordered_backup_ids: &[String],
    records_by_id: &HashMap<String, RemoteBackupRecord>,
) -> Result<usize, String> {
    let backups_root = local_save_backups_root(app)?;
    let parent = backups_root
        .parent()
        .ok_or_else(|| "invalid local save backups directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let temp_dir = parent.join(format!(".save-backups-webdav-download-{}", Uuid::new_v4()));
    remove_dir_if_exists(&temp_dir)?;
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let result = async {
        let mut downloaded_files = 0usize;

        for backup_id in ordered_backup_ids {
            let record = records_by_id
                .get(backup_id)
                .ok_or_else(|| format!("WebDAV save backup not found: {backup_id}"))?;
            for file in &record.files {
                validate_manifest_relative_path(&file.relative_path)?;
                let relative_suffix = file
                    .relative_path
                    .strip_prefix(&record.prefix)
                    .ok_or_else(|| {
                        format!(
                            "manifest file is outside backup prefix: {}",
                            file.relative_path
                        )
                    })?
                    .trim_start_matches('/');
                let target_relative_path = format!(
                    "{}/{}/{}/{}",
                    target_instance_id, record.world_key, backup_id, relative_suffix
                );
                validate_manifest_relative_path(&target_relative_path)?;

                let bytes = download_remote_file(client, config, &file.relative_path).await?;
                if bytes.len() as u64 != file.size || md5_bytes(&bytes) != file.content_hash {
                    return Err(format!(
                        "WebDAV save backup file hash mismatch: {}",
                        file.relative_path
                    ));
                }

                let target =
                    temp_dir.join(target_relative_path.replace('/', std::path::MAIN_SEPARATOR_STR));
                if let Some(parent) = target.parent() {
                    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
                }
                let mut output = File::create(&target).map_err(|error| error.to_string())?;
                output
                    .write_all(&bytes)
                    .map_err(|error| error.to_string())?;
                downloaded_files += 1;
            }

            let local_meta_path = temp_dir
                .join(target_instance_id)
                .join(&record.world_key)
                .join(backup_id)
                .join("meta.json");
            let mut meta = serde_json::from_str::<SaveBackupMetadata>(
                &fs::read_to_string(&local_meta_path).map_err(|error| error.to_string())?,
            )
            .map_err(|error| format!("invalid downloaded save backup metadata: {error}"))?;
            meta.instance_id = target_instance_id.to_string();
            fs::write(
                &local_meta_path,
                serde_json::to_string_pretty(&meta).map_err(|error| error.to_string())?,
            )
            .map_err(|error| error.to_string())?;
        }

        fs::create_dir_all(&backups_root).map_err(|error| error.to_string())?;
        for backup_id in ordered_backup_ids {
            let record = records_by_id
                .get(backup_id)
                .ok_or_else(|| format!("WebDAV save backup not found: {backup_id}"))?;
            let temp_backup = temp_dir
                .join(target_instance_id)
                .join(&record.world_key)
                .join(backup_id);
            let final_backup = backups_root
                .join(target_instance_id)
                .join(&record.world_key)
                .join(backup_id);
            if final_backup.exists() {
                remove_dir_if_exists(&final_backup)?;
            }
            if let Some(parent) = final_backup.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            move_dir_with_fallback(&temp_backup, &final_backup)?;
        }

        Ok(downloaded_files)
    }
    .await;

    let _ = remove_dir_if_exists(&temp_dir);
    result
}

async fn delete_remote_save_backup_locked(
    config: &WebDavSyncConfig,
    client: &Client,
    backup_id: &str,
    lock_token: &str,
) -> Result<WebDavSaveBackupDeleteResult, String> {
    let manifest = download_manifest(client, config)
        .await?
        .ok_or_else(|| "WebDAV save backup manifest does not exist".to_string())?;
    let records = load_remote_backup_records(client, config, &manifest).await?;
    let records_by_id = records
        .into_iter()
        .map(|record| (record.meta.backup_id.clone(), record))
        .collect::<HashMap<_, _>>();
    let record = records_by_id
        .get(backup_id)
        .ok_or_else(|| format!("WebDAV save backup not found: {backup_id}"))?;

    let dependents = records_by_id
        .values()
        .filter(|candidate| {
            candidate.meta.backup_mode == "differential"
                && candidate.meta.base_backup_id.as_deref() == Some(backup_id)
        })
        .map(|candidate| candidate.meta.backup_id.clone())
        .collect::<Vec<_>>();
    if !dependents.is_empty() {
        return Err(format!(
            "cannot delete full WebDAV backup because differential backups depend on it: {}",
            dependents.join(", ")
        ));
    }

    let deleted_files = record.files.len();
    let deleted_prefix = record.prefix.clone();
    delete_remote_path(
        client,
        config,
        &format!("{SAVE_BACKUPS_DATA_DIR}/{deleted_prefix}"),
        Some(lock_token),
    )
    .await?;

    let remaining_files = manifest
        .files
        .iter()
        .filter(|file| !path_has_prefix(&file.relative_path, &deleted_prefix))
        .cloned()
        .collect::<Vec<_>>();
    if remaining_files.is_empty() {
        let _ =
            delete_remote_path(client, config, SAVE_BACKUPS_MANIFEST_PATH, Some(lock_token)).await;
        return Ok(WebDavSaveBackupDeleteResult {
            backup_id: backup_id.to_string(),
            deleted_files,
            remaining_backups: 0,
        });
    }

    let next_manifest = rebuild_manifest_with_files(&manifest, remaining_files);
    let remaining_backups = next_manifest.backup_count;
    upload_bytes(
        client,
        config,
        SAVE_BACKUPS_MANIFEST_PATH,
        "application/json",
        serde_json::to_vec_pretty(&next_manifest).map_err(|error| error.to_string())?,
        Some(lock_token),
    )
    .await?;

    Ok(WebDavSaveBackupDeleteResult {
        backup_id: backup_id.to_string(),
        deleted_files,
        remaining_backups,
    })
}

fn rebuild_manifest_with_files(
    current: &SaveBackupsManifest,
    mut files: Vec<FileFingerprint>,
) -> SaveBackupsManifest {
    files.sort_by(|left, right| left.relative_path.cmp(&right.relative_path));

    let mut backup_ids = BTreeSet::new();
    let mut prefixes = HashSet::new();
    let mut total_size = 0u64;
    let mut updated_at = 0i64;
    for file in &files {
        total_size = total_size.saturating_add(file.size);
        updated_at = updated_at.max(file.modified_at);
        let parts = file.relative_path.split('/').collect::<Vec<_>>();
        if parts.len() >= 2 {
            prefixes.insert(format!("{}/{}", parts[0], parts[1]));
        }
        if parts.len() >= 4 && parts[3..].join("/") == "meta.json" {
            backup_ids.insert(format!("{}/{}/{}", parts[0], parts[1], parts[2]));
        }
    }

    let selected_worlds = current
        .selected_worlds
        .iter()
        .filter(|world| prefixes.contains(*world))
        .cloned()
        .collect::<Vec<_>>();

    SaveBackupsManifest {
        schema_version: SAVE_BACKUP_SYNC_SCHEMA_VERSION,
        updated_at: updated_at.max(util::now_millis()),
        file_count: files.len(),
        backup_count: backup_ids.len(),
        total_size,
        content_hash: manifest_content_hash(&files),
        selected_worlds,
        files,
    }
}

fn manifest_content_hash(files: &[FileFingerprint]) -> String {
    if files.is_empty() {
        return String::new();
    }

    let mut digest_material = String::new();
    for file in files {
        digest_material.push_str(&file.relative_path);
        digest_material.push('\0');
        digest_material.push_str(&file.size.to_string());
        digest_material.push('\0');
        digest_material.push_str(&file.content_hash);
        digest_material.push('\n');
    }
    format!("{:x}", md5::compute(digest_material.as_bytes()))
}

fn md5_bytes(bytes: &[u8]) -> String {
    format!("{:x}", md5::compute(bytes))
}

fn list_manifest_files(manifest: &SaveBackupsManifest) -> Vec<FileFingerprint> {
    manifest.files.clone()
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        fs::remove_dir_all(path).map_err(|error| error.to_string())?;
    }
    Ok(())
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    let src = src.as_ref();
    let dst = dst.as_ref();

    if !src.exists() {
        return Ok(());
    }

    fs::create_dir_all(dst)?;
    for entry in WalkDir::new(src) {
        let entry = entry?;
        let rel = match entry.path().strip_prefix(src) {
            Ok(rel) => rel,
            Err(_) => continue,
        };
        if rel.as_os_str().is_empty() {
            continue;
        }

        let target = dst.join(rel);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)?;
        } else {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target)?;
        }
    }

    Ok(())
}

fn move_dir_with_fallback(src: &Path, dst: &Path) -> Result<(), String> {
    if let Some(parent) = dst.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    if fs::rename(src, dst).is_ok() {
        return Ok(());
    }

    copy_dir_all(src, dst).map_err(|error| error.to_string())?;
    fs::remove_dir_all(src).map_err(|error| error.to_string())?;
    Ok(())
}

async fn download_manifest(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<Option<SaveBackupsManifest>, String> {
    let response =
        remote::authorized_request(client, config, Method::GET, SAVE_BACKUPS_MANIFEST_PATH)
            .send()
            .await
            .map_err(|error| format!("failed to download WebDAV save backup manifest: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to download WebDAV save backup manifest: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<SaveBackupsManifest>()
        .await
        .map(Some)
        .map_err(|error| format!("invalid WebDAV save backup manifest: {error}"))
}

async fn download_remote_file(
    client: &Client,
    config: &WebDavSyncConfig,
    relative_path: &str,
) -> Result<Vec<u8>, String> {
    let remote_path = format!("{SAVE_BACKUPS_DATA_DIR}/{relative_path}");
    let response = remote::authorized_request(client, config, Method::GET, &remote_path)
        .send()
        .await
        .map_err(|error| format!("failed to download WebDAV save backup file: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "failed to download WebDAV save backup file: HTTP {}",
            response.status()
        ));
    }

    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("failed to read WebDAV save backup file: {error}"))
}

async fn ensure_remote_parent_collections(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
    lock_token: &str,
) -> Result<(), String> {
    let mut current = String::new();
    let parts = remote_path.split('/').collect::<Vec<_>>();
    for part in parts.iter().take(parts.len().saturating_sub(1)) {
        if !current.is_empty() {
            current.push('/');
        }
        current.push_str(part);
        ensure_collection_locked(client, config, &current, lock_token).await?;
    }
    Ok(())
}

async fn ensure_collection_locked(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
    lock_token: &str,
) -> Result<bool, String> {
    let method =
        Method::from_bytes(b"MKCOL").map_err(|error| format!("invalid MKCOL method: {error}"))?;
    let response = remote::authorized_request(client, config, method, remote_path)
        .header("If", lock_if_header(lock_token))
        .send()
        .await
        .map_err(|error| format!("failed to create WebDAV directory: {error}"))?;

    let status = response.status();
    if status.is_success() {
        return Ok(true);
    }
    if status == StatusCode::METHOD_NOT_ALLOWED || status == StatusCode::CONFLICT {
        return Ok(false);
    }

    Err(format!("failed to create WebDAV directory: HTTP {status}"))
}

async fn delete_remote_save_backup_tree(
    client: &Client,
    config: &WebDavSyncConfig,
    lock_token: &str,
) -> Result<(), String> {
    let _ = delete_remote_path(client, config, SAVE_BACKUPS_DATA_DIR, Some(lock_token)).await;
    let _ = delete_remote_path(client, config, SAVE_BACKUPS_MANIFEST_PATH, Some(lock_token)).await;
    let _ = delete_remote_path(client, config, SAVE_BACKUPS_ARCHIVE_PATH, Some(lock_token)).await;
    let _ = delete_remote_path(
        client,
        config,
        SAVE_BACKUPS_ARCHIVE_TEMP_PATH,
        Some(lock_token),
    )
    .await;
    Ok(())
}

async fn lock_save_backup_directory(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<String, String> {
    let method =
        Method::from_bytes(b"LOCK").map_err(|error| format!("invalid LOCK method: {error}"))?;
    let body = r#"<?xml version="1.0" encoding="utf-8" ?>
<D:lockinfo xmlns:D="DAV:">
  <D:lockscope><D:exclusive/></D:lockscope>
  <D:locktype><D:write/></D:locktype>
  <D:owner><D:href>PiLauncher</D:href></D:owner>
</D:lockinfo>"#;

    let response = remote::authorized_request(client, config, method, SAVE_BACKUPS_DIR)
        .header("Depth", "0")
        .header(
            "Timeout",
            format!("Second-{SAVE_BACKUP_LOCK_TIMEOUT_SECONDS}"),
        )
        .header(header::CONTENT_TYPE, "application/xml")
        .body(body)
        .send()
        .await
        .map_err(|error| format!("failed to lock WebDAV save backup directory: {error}"))?;

    let status = response.status();
    if status.as_u16() == 423 {
        return Err(
            "WebDAV save backup directory is locked by another sync session; please retry later"
                .to_string(),
        );
    }
    if !status.is_success() {
        return Err(format!(
            "failed to lock WebDAV save backup directory: HTTP {status}"
        ));
    }

    let header_token = response
        .headers()
        .get("Lock-Token")
        .and_then(|value| value.to_str().ok())
        .and_then(normalize_lock_token);
    let body = response.text().await.unwrap_or_default();
    header_token
        .or_else(|| {
            extract_lock_token_from_body(&body).and_then(|token| normalize_lock_token(&token))
        })
        .ok_or_else(|| "WebDAV lock succeeded, but no lock token was returned".to_string())
}

async fn unlock_save_backup_directory(
    client: &Client,
    config: &WebDavSyncConfig,
    lock_token: &str,
) -> Result<(), String> {
    let method =
        Method::from_bytes(b"UNLOCK").map_err(|error| format!("invalid UNLOCK method: {error}"))?;
    let response = remote::authorized_request(client, config, method, SAVE_BACKUPS_DIR)
        .header("Lock-Token", lock_token)
        .send()
        .await
        .map_err(|error| format!("failed to unlock WebDAV save backup directory: {error}"))?;

    let status = response.status();
    if status.is_success() || status == StatusCode::NOT_FOUND {
        Ok(())
    } else {
        Err(format!(
            "failed to unlock WebDAV save backup directory: HTTP {status}"
        ))
    }
}

fn normalize_lock_token(value: &str) -> Option<String> {
    let token = value
        .trim()
        .trim_start_matches('<')
        .trim_end_matches('>')
        .trim();
    if token.is_empty() {
        None
    } else {
        Some(format!("<{token}>"))
    }
}

fn lock_if_header(lock_token: &str) -> String {
    format!("({lock_token})")
}

fn extract_lock_token_from_body(body: &str) -> Option<String> {
    for marker in ["opaquelocktoken:", "urn:uuid:"] {
        if let Some(start) = body.find(marker) {
            let token = body[start..]
                .split(|character: char| {
                    character == '<'
                        || character == '>'
                        || character == '"'
                        || character == '\''
                        || character.is_whitespace()
                })
                .next()
                .unwrap_or_default()
                .trim();
            if !token.is_empty() {
                return Some(token.to_string());
            }
        }
    }
    None
}

async fn delete_remote_path(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
    lock_token: Option<&str>,
) -> Result<(), String> {
    let mut request = remote::authorized_request(client, config, Method::DELETE, remote_path);
    if let Some(lock_token) = lock_token {
        request = request.header("If", lock_if_header(lock_token));
    }
    let response = request
        .send()
        .await
        .map_err(|error| format!("failed to delete WebDAV path: {error}"))?;

    if response.status().is_success() || response.status() == StatusCode::NOT_FOUND {
        Ok(())
    } else {
        Err(format!(
            "failed to delete WebDAV path: HTTP {}",
            response.status()
        ))
    }
}

async fn upload_bytes(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
    content_type: &'static str,
    body: Vec<u8>,
    lock_token: Option<&str>,
) -> Result<(), String> {
    let mut request = remote::authorized_request(client, config, Method::PUT, remote_path)
        .header(header::CONTENT_TYPE, content_type);
    if let Some(lock_token) = lock_token {
        request = request.header("If", lock_if_header(lock_token));
    }
    let response = request
        .body(body)
        .send()
        .await
        .map_err(|error| format!("failed to upload WebDAV save backup: {error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "failed to upload WebDAV save backup: HTTP {}",
            response.status()
        ))
    }
}
