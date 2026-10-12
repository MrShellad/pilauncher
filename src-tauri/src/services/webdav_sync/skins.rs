use crate::domain::library::{WebDavSkinSyncResult, WebDavSyncConfig};
use crate::services::config::ConfigService;
use reqwest::{header, Client, Method, StatusCode};
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{self, Cursor};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

use super::constants::{
    REMOTE_ROOT, SKINS_ARCHIVE_PATH, SKINS_DIR, SKINS_MANIFEST_PATH, WARDROBE_DIR,
};
use super::{paths, remote, util};

const SKIN_BACKUP_SCHEMA_VERSION: i32 = 1;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkinBackupManifest {
    schema_version: i32,
    updated_at: i64,
    file_count: usize,
    total_size: u64,
    content_hash: String,
}

#[derive(Debug, Default, Clone)]
struct LocalSkinSnapshot {
    updated_at: i64,
    file_count: usize,
    total_size: u64,
    content_hash: String,
}

#[derive(Debug)]
struct FileFingerprint {
    relative_path: String,
    size: u64,
    modified_at: i64,
    content_hash: String,
}

pub(crate) async fn sync_skin_assets<R: Runtime>(
    app: &AppHandle<R>,
    config: &WebDavSyncConfig,
) -> Result<WebDavSkinSyncResult, String> {
    util::validate_base_url(&config.base_url)?;

    let client = Client::builder()
        .build()
        .map_err(|error| format!("failed to build WebDAV client: {error}"))?;
    let remote_created = ensure_skin_layout(&client, config).await?;

    let skins_root = local_skins_root(app)?;
    let local_snapshot = scan_local_skin_snapshot(&skins_root)?;
    let remote_manifest = download_manifest(&client, config).await?;
    let mut remote_files = remote_manifest
        .as_ref()
        .map(|manifest| manifest.file_count)
        .unwrap_or(0);

    let mut uploaded_files = 0usize;
    let mut downloaded_files = 0usize;
    let mut archive_updated = false;
    let mut restored = false;

    if let Some(manifest) = remote_manifest.as_ref() {
        let remote_differs = manifest.content_hash != local_snapshot.content_hash;
        let remote_is_newer = manifest.updated_at > local_snapshot.updated_at;
        if remote_differs
            && !manifest.content_hash.is_empty()
            && (local_snapshot.file_count == 0 || remote_is_newer)
        {
            match download_archive(&client, config).await? {
                Some(bytes) => {
                    restore_archive(&skins_root, bytes)?;
                    downloaded_files = manifest.file_count;
                    restored = true;
                    let restored_snapshot = scan_local_skin_snapshot(&skins_root)?;
                    return Ok(WebDavSkinSyncResult {
                        remote_root: util::join_remote_url(&config.base_url, SKINS_DIR),
                        remote_created,
                        uploaded_files,
                        downloaded_files,
                        local_files: restored_snapshot.file_count,
                        remote_files: manifest.file_count,
                        archive_updated,
                        restored,
                    });
                }
                None if local_snapshot.file_count == 0 => {
                    return Err(
                        "remote skin backup manifest exists, but skins.zip is missing".to_string(),
                    );
                }
                None => {}
            }
        }
    }

    let remote_matches_local = remote_manifest
        .as_ref()
        .map(|manifest| manifest.content_hash == local_snapshot.content_hash)
        .unwrap_or(false);

    if local_snapshot.file_count > 0 && !remote_matches_local {
        let archive_path = create_local_archive(app, &skins_root)?;
        let archive_bytes = fs::read(&archive_path).map_err(|error| error.to_string())?;
        upload_bytes(
            &client,
            config,
            SKINS_ARCHIVE_PATH,
            "application/zip",
            archive_bytes,
        )
        .await?;

        let manifest = SkinBackupManifest {
            schema_version: SKIN_BACKUP_SCHEMA_VERSION,
            updated_at: local_snapshot.updated_at.max(util::now_millis()),
            file_count: local_snapshot.file_count,
            total_size: local_snapshot.total_size,
            content_hash: local_snapshot.content_hash.clone(),
        };
        let manifest_bytes =
            serde_json::to_vec_pretty(&manifest).map_err(|error| error.to_string())?;
        upload_bytes(
            &client,
            config,
            SKINS_MANIFEST_PATH,
            "application/json",
            manifest_bytes,
        )
        .await?;

        let _ = fs::remove_file(archive_path);
        uploaded_files = local_snapshot.file_count;
        remote_files = local_snapshot.file_count;
        archive_updated = true;
    }

    Ok(WebDavSkinSyncResult {
        remote_root: util::join_remote_url(&config.base_url, SKINS_DIR),
        remote_created,
        uploaded_files,
        downloaded_files,
        local_files: local_snapshot.file_count,
        remote_files,
        archive_updated,
        restored,
    })
}

async fn ensure_skin_layout(client: &Client, config: &WebDavSyncConfig) -> Result<bool, String> {
    let mut remote_created = false;
    for remote_path in [REMOTE_ROOT, WARDROBE_DIR, SKINS_DIR] {
        remote_created |= remote::ensure_collection(client, config, remote_path).await?;
    }
    Ok(remote_created)
}

fn local_skins_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "base path is not configured".to_string())?;
    Ok(PathBuf::from(base_path).join("config").join("skins"))
}

fn system_time_to_millis(value: SystemTime) -> i64 {
    value
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

fn scan_local_skin_snapshot(root: &Path) -> Result<LocalSkinSnapshot, String> {
    if !root.exists() {
        return Ok(LocalSkinSnapshot::default());
    }

    let mut files = Vec::new();
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
        if relative_path.is_empty() {
            continue;
        }

        let bytes = fs::read(path).map_err(|error| error.to_string())?;
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let modified_at = metadata
            .modified()
            .map(system_time_to_millis)
            .unwrap_or_default();

        files.push(FileFingerprint {
            relative_path,
            size: bytes.len() as u64,
            modified_at,
            content_hash: format!("{:x}", md5::compute(bytes)),
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

    Ok(LocalSkinSnapshot {
        updated_at,
        file_count: files.len(),
        total_size,
        content_hash: if files.is_empty() {
            String::new()
        } else {
            format!("{:x}", md5::compute(digest_material.as_bytes()))
        },
    })
}

fn create_local_archive<R: Runtime>(
    app: &AppHandle<R>,
    skins_root: &Path,
) -> Result<PathBuf, String> {
    let archive_dir = paths::sync_root(app)?.join("wardrobe");
    fs::create_dir_all(&archive_dir).map_err(|error| error.to_string())?;
    let archive_path = archive_dir.join("skins.zip.tmp");
    if archive_path.exists() {
        let _ = fs::remove_file(&archive_path);
    }

    let file = File::create(&archive_path).map_err(|error| error.to_string())?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    let mut entries = WalkDir::new(skins_root)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .collect::<Vec<_>>();
    entries.sort_by(|left, right| left.path().cmp(right.path()));

    for entry in entries {
        let path = entry.path();
        let relative_path = match path.strip_prefix(skins_root) {
            Ok(value) => value,
            Err(_) => continue,
        };
        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let archive_name = relative_path.to_string_lossy().replace('\\', "/");
        if entry.file_type().is_dir() {
            zip.add_directory(format!("{}/", archive_name.trim_end_matches('/')), options)
                .map_err(|error| error.to_string())?;
            continue;
        }

        zip.start_file(&archive_name, options)
            .map_err(|error| error.to_string())?;
        let mut source = File::open(path).map_err(|error| error.to_string())?;
        io::copy(&mut source, &mut zip).map_err(|error| error.to_string())?;
    }

    zip.finish().map_err(|error| error.to_string())?;
    Ok(archive_path)
}

fn restore_archive(skins_root: &Path, archive_bytes: Vec<u8>) -> Result<(), String> {
    let parent = skins_root
        .parent()
        .ok_or_else(|| "invalid local skins directory".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;

    let temp_dir = parent.join(format!(".skins-sync-{}", Uuid::new_v4()));
    if temp_dir.exists() {
        fs::remove_dir_all(&temp_dir).map_err(|error| error.to_string())?;
    }
    fs::create_dir_all(&temp_dir).map_err(|error| error.to_string())?;

    let mut archive =
        ZipArchive::new(Cursor::new(archive_bytes)).map_err(|error| error.to_string())?;
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(|error| error.to_string())?;
        let enclosed_name = entry
            .enclosed_name()
            .ok_or_else(|| "skin backup archive contains an invalid path".to_string())?
            .to_path_buf();
        let target = temp_dir.join(enclosed_name);

        if entry.is_dir() {
            fs::create_dir_all(&target).map_err(|error| error.to_string())?;
            continue;
        }

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        }
        let mut output = File::create(&target).map_err(|error| error.to_string())?;
        io::copy(&mut entry, &mut output).map_err(|error| error.to_string())?;
    }

    if skins_root.exists() {
        fs::remove_dir_all(skins_root).map_err(|error| error.to_string())?;
    }
    fs::rename(&temp_dir, skins_root).map_err(|error| error.to_string())
}

async fn download_manifest(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<Option<SkinBackupManifest>, String> {
    let response = remote::authorized_request(client, config, Method::GET, SKINS_MANIFEST_PATH)
        .send()
        .await
        .map_err(|error| format!("failed to read WebDAV skin backup manifest: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to read WebDAV skin backup manifest: HTTP {}",
            response.status()
        ));
    }

    response
        .json::<SkinBackupManifest>()
        .await
        .map(Some)
        .map_err(|error| format!("invalid WebDAV skin backup manifest: {error}"))
}

async fn download_archive(
    client: &Client,
    config: &WebDavSyncConfig,
) -> Result<Option<Vec<u8>>, String> {
    let response = remote::authorized_request(client, config, Method::GET, SKINS_ARCHIVE_PATH)
        .send()
        .await
        .map_err(|error| format!("failed to download WebDAV skin backup: {error}"))?;

    if response.status() == StatusCode::NOT_FOUND {
        return Ok(None);
    }
    if !response.status().is_success() {
        return Err(format!(
            "failed to download WebDAV skin backup: HTTP {}",
            response.status()
        ));
    }

    response
        .bytes()
        .await
        .map(|bytes| Some(bytes.to_vec()))
        .map_err(|error| format!("failed to read WebDAV skin backup: {error}"))
}

async fn upload_bytes(
    client: &Client,
    config: &WebDavSyncConfig,
    remote_path: &str,
    content_type: &'static str,
    body: Vec<u8>,
) -> Result<(), String> {
    let response = remote::authorized_request(client, config, Method::PUT, remote_path)
        .header(header::CONTENT_TYPE, content_type)
        .body(body)
        .send()
        .await
        .map_err(|error| format!("failed to upload WebDAV skin backup: {error}"))?;

    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "failed to upload WebDAV skin backup: HTTP {}",
            response.status()
        ))
    }
}
