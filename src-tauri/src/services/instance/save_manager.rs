use crate::domain::instance::InstanceConfig;
use crate::services::config_service::ConfigService;
use chrono::Local;
use serde::{Deserialize, Serialize};
use sha1::{Digest, Sha1};
use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::{ZipArchive, ZipWriter};

const SAVE_METADATA_FILE: &str = ".saves_metadata.json";
const BACKUP_META_FILE: &str = "meta.json";
const BACKUP_WORLD_ARCHIVE_FILE: &str = "world.zip";
const BACKUP_CONFIG_ARCHIVE_FILE: &str = "configs.zip";
const BACKUP_PREVIEW_FILE: &str = "preview.png";
const SAVE_BACKUP_PROGRESS_EVENT: &str = "save-backup-progress";

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveItem {
    pub folder_name: String,
    pub world_name: String,
    pub world_uuid: String,
    pub size_bytes: u64,
    pub last_played_time: i64,
    pub created_time: i64,
    pub icon_path: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveMetadataCache {
    #[serde(default)]
    pub world_uuid: String,
    pub world_name: String,
    pub size_bytes: u64,
    pub last_played_time: i64,
    pub created_time: i64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupWorld {
    pub name: String,
    pub uuid: String,
    #[serde(default)]
    pub folder_name: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupGame {
    pub mc_version: String,
    pub loader: String,
    #[serde(default)]
    pub loader_version: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupModEntry {
    pub file_name: String,
    pub hash: String,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupEnvironment {
    pub mods_hash: String,
    pub config_hash: String,
    pub mod_count: usize,
    #[serde(default)]
    pub mods: Vec<SaveBackupModEntry>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupFiles {
    pub world_size: u64,
    pub config_size: u64,
    pub total_size: u64,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupState {
    pub safe_backup: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupUser {
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupMetadata {
    pub backup_id: String,
    pub instance_id: String,
    pub world: SaveBackupWorld,
    pub created_at: i64,
    pub trigger: String,
    pub game: SaveBackupGame,
    pub environment: SaveBackupEnvironment,
    pub files: SaveBackupFiles,
    pub state: SaveBackupState,
    #[serde(default)]
    pub user: SaveBackupUser,
    #[serde(default)]
    pub has_configs: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestoreCheckResult {
    pub backup_id: String,
    pub target_folder_name: String,
    pub warnings: Vec<String>,
    pub safe_backup: bool,
    pub can_restore_configs: bool,
    pub auto_backup_current: bool,
    pub game_matches: bool,
    pub loader_matches: bool,
    pub mods_match: bool,
    pub configs_match: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveRestoreResult {
    pub backup_id: String,
    pub restored_folder_name: String,
    pub restored_configs: bool,
    pub guard_backup_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupProgress {
    pub instance_id: String,
    pub folder_name: String,
    pub current: u64,
    pub total: u64,
    pub message: String,
    pub stage: String,
}

enum BackupPayload {
    Archive(PathBuf),
    Missing,
}

struct BackupRecord {
    meta: SaveBackupMetadata,
    backup_dir: PathBuf,
    world_payload: BackupPayload,
    configs_payload: BackupPayload,
}

pub struct SaveManagerService;

impl SaveManagerService {
    fn get_base_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "base path is not configured".to_string())?;
        Ok(PathBuf::from(base))
    }

    fn get_instance_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        Ok(Self::get_base_dir(app)?.join("instances").join(instance_id))
    }

    fn get_game_dir<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<PathBuf, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let mut game_dir = instance_dir.clone();
        if let Ok(config) = Self::get_instance_config(&instance_dir) {
            if let Some(tp) = config.third_party_path {
                game_dir = PathBuf::from(tp);
            }
        }
        Ok(game_dir)
    }

    fn get_backups_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        Ok(Self::get_base_dir(app)?.join("backups").join("saves"))
    }

    fn get_trash_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        Ok(Self::get_base_dir(app)?
            .join("backups")
            .join("trash")
            .join("saves"))
    }

    fn get_instance_config(instance_dir: &Path) -> Result<InstanceConfig, String> {
        let content =
            fs::read_to_string(instance_dir.join("instance.json")).map_err(|e| e.to_string())?;
        serde_json::from_str::<InstanceConfig>(&content).map_err(|e| e.to_string())
    }

    fn get_dir_size(path: impl AsRef<Path>) -> u64 {
        let root = path.as_ref();
        if !root.exists() {
            return 0;
        }

        WalkDir::new(root)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_file())
            .map(|entry| entry.metadata().map(|meta| meta.len()).unwrap_or(0))
            .sum()
    }

    fn count_files(path: impl AsRef<Path>) -> u64 {
        let root = path.as_ref();
        if !root.exists() {
            return 0;
        }

        WalkDir::new(root)
            .into_iter()
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.file_type().is_file())
            .count() as u64
    }

    fn emit_backup_progress<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
        current: u64,
        total: u64,
        message: impl Into<String>,
        stage: impl Into<String>,
    ) {
        let _ = app.emit(
            SAVE_BACKUP_PROGRESS_EVENT,
            SaveBackupProgress {
                instance_id: instance_id.to_string(),
                folder_name: folder_name.to_string(),
                current,
                total: total.max(1),
                message: message.into(),
                stage: stage.into(),
            },
        );
    }

    fn get_config_backup_sources(instance_dir: &Path) -> Vec<(PathBuf, String)> {
        let mut sources = Vec::new();

        for folder_name in ["config", "defaultconfigs"] {
            let path = instance_dir.join(folder_name);
            if path.exists() {
                sources.push((path, folder_name.to_string()));
            }
        }

        sources
    }

    fn resolve_backup_payload(archive_path: PathBuf) -> BackupPayload {
        if archive_path.exists() {
            BackupPayload::Archive(archive_path)
        } else {
            BackupPayload::Missing
        }
    }

    fn zip_sources<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
        sources: &[(PathBuf, String)],
        archive_path: &Path,
        stage: &str,
        processed_files: &mut u64,
        total_files: u64,
    ) -> Result<u64, String> {
        let file = File::create(archive_path).map_err(|e| e.to_string())?;
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated)
            .unix_permissions(0o755);

        let mut total_size = 0;

        for (root_path, archive_prefix) in sources {
            if !root_path.exists() {
                continue;
            }

            for entry in WalkDir::new(root_path)
                .into_iter()
                .filter_map(|entry| entry.ok())
            {
                let path = entry.path();
                let rel = match path.strip_prefix(root_path) {
                    Ok(rel) => rel,
                    Err(_) => continue,
                };

                if rel.as_os_str().is_empty() {
                    continue;
                }

                let rel_str = rel.to_string_lossy().replace('\\', "/");
                let archive_rel = if archive_prefix.is_empty() {
                    rel_str
                } else {
                    format!("{}/{}", archive_prefix.trim_end_matches('/'), rel_str)
                };

                if entry.file_type().is_dir() {
                    zip.add_directory(format!("{}/", archive_rel.trim_end_matches('/')), options)
                        .map_err(|e| e.to_string())?;
                    continue;
                }

                zip.start_file(&archive_rel, options)
                    .map_err(|e| e.to_string())?;

                let mut src_file = File::open(path).map_err(|e| e.to_string())?;
                total_size += io::copy(&mut src_file, &mut zip).map_err(|e| e.to_string())?;

                *processed_files += 1;
                Self::emit_backup_progress(
                    app,
                    instance_id,
                    folder_name,
                    (*processed_files).min(total_files.max(1)),
                    total_files,
                    archive_rel,
                    stage.to_string(),
                );
            }
        }

        zip.finish().map_err(|e| e.to_string())?;
        Ok(total_size)
    }

    fn extract_archive_to(archive_path: &Path, dst: &Path) -> Result<(), String> {
        let file = File::open(archive_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        fs::create_dir_all(dst).map_err(|e| e.to_string())?;

        for index in 0..archive.len() {
            let mut entry = archive.by_index(index).map_err(|e| e.to_string())?;
            let enclosed_name = entry
                .enclosed_name()
                .ok_or_else(|| "archive entry contains an invalid path".to_string())?
                .to_path_buf();
            let out_path = dst.join(enclosed_name);

            if entry.is_dir() {
                fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
                continue;
            }

            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let mut out_file = File::create(&out_path).map_err(|e| e.to_string())?;
            io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;
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

    fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
        if path.exists() {
            fs::remove_dir_all(path).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    fn move_dir_with_fallback(src: &Path, dst: &Path) -> Result<(), String> {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        if fs::rename(src, dst).is_ok() {
            return Ok(());
        }

        Self::copy_dir_all(src, dst).map_err(|e| e.to_string())?;
        fs::remove_dir_all(src).map_err(|e| e.to_string())?;
        Ok(())
    }

    fn write_json_atomically<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let temp_path = path.with_extension("tmp");
        let json = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
        fs::write(&temp_path, json).map_err(|e| e.to_string())?;
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
        fs::rename(temp_path, path).map_err(|e| e.to_string())
    }

    fn system_time_to_timestamp(time: std::time::SystemTime) -> i64 {
        time.duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() as i64
    }

    fn metadata_time(path: &Path) -> i64 {
        fs::metadata(path)
            .ok()
            .and_then(|meta| meta.modified().ok())
            .map(Self::system_time_to_timestamp)
            .unwrap_or(0)
    }

    fn quick_file_fingerprint(path: &Path) -> String {
        match fs::metadata(path) {
            Ok(meta) => {
                let modified = meta
                    .modified()
                    .ok()
                    .map(Self::system_time_to_timestamp)
                    .unwrap_or_default();
                format!("{:x}:{:x}", meta.len(), modified)
            }
            Err(_) => "missing".to_string(),
        }
    }

    fn stable_world_uuid(instance_id: &str, folder_name: &str) -> String {
        let mut hasher = Sha1::new();
        hasher.update(instance_id.as_bytes());
        hasher.update(b"::");
        hasher.update(folder_name.as_bytes());
        let digest = hasher.finalize();

        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&digest[..16]);
        Uuid::from_bytes(bytes).to_string()
    }

    fn hash_pairs(pairs: &[(String, String)]) -> String {
        let mut hasher = Sha1::new();
        for (name, hash) in pairs {
            hasher.update(name.as_bytes());
            hasher.update(b"=");
            hasher.update(hash.as_bytes());
            hasher.update(b"\n");
        }
        format!("{:x}", hasher.finalize())
    }

    fn inspect_save_folder(
        instance_id: &str,
        folder_name: &str,
        save_dir: &Path,
    ) -> Result<SaveMetadataCache, String> {
        let meta_path = save_dir.join(SAVE_METADATA_FILE);
        let level_dat = save_dir.join("level.dat");
        let folder_meta = fs::metadata(save_dir).map_err(|e| e.to_string())?;

        let mut cache = if meta_path.exists() {
            fs::read_to_string(&meta_path)
                .ok()
                .and_then(|content| serde_json::from_str::<SaveMetadataCache>(&content).ok())
                .unwrap_or_default()
        } else {
            SaveMetadataCache::default()
        };

        let level_modified = if level_dat.exists() {
            Self::metadata_time(&level_dat)
        } else {
            folder_meta
                .modified()
                .ok()
                .map(Self::system_time_to_timestamp)
                .unwrap_or_default()
        };
        let meta_modified = Self::metadata_time(&meta_path);
        let needs_refresh = cache.world_uuid.is_empty()
            || cache.world_name.is_empty()
            || meta_modified < level_modified;

        if needs_refresh {
            cache = SaveMetadataCache {
                world_uuid: Self::stable_world_uuid(instance_id, folder_name),
                world_name: folder_name.to_string(),
                size_bytes: Self::get_dir_size(save_dir),
                last_played_time: level_modified,
                created_time: folder_meta
                    .created()
                    .ok()
                    .or_else(|| folder_meta.modified().ok())
                    .map(Self::system_time_to_timestamp)
                    .unwrap_or_default(),
            };
        } else {
            if cache.world_uuid.is_empty() {
                cache.world_uuid = Self::stable_world_uuid(instance_id, folder_name);
            }
            if cache.world_name.is_empty() {
                cache.world_name = folder_name.to_string();
            }
        }

        Self::write_json_atomically(&meta_path, &cache)?;
        Ok(cache)
    }

    fn collect_mod_entries(mods_dir: &Path) -> Vec<SaveBackupModEntry> {
        let mut mods = Vec::new();

        if let Ok(entries) = fs::read_dir(mods_dir) {
            for entry in entries.filter_map(|entry| entry.ok()) {
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let file_name = entry.file_name().to_string_lossy().to_string();
                let lower_name = file_name.to_ascii_lowercase();
                if !lower_name.ends_with(".jar") && !lower_name.ends_with(".jar.disabled") {
                    continue;
                }

                mods.push(SaveBackupModEntry {
                    file_name,
                    hash: Self::quick_file_fingerprint(&path),
                });
            }
        }

        mods.sort_by(|a, b| a.file_name.cmp(&b.file_name));
        mods
    }

    fn collect_config_entries(instance_dir: &Path) -> Vec<(String, String)> {
        let mut entries = Vec::new();

        for root_name in ["config", "defaultconfigs"] {
            let root_path = instance_dir.join(root_name);
            if !root_path.exists() {
                continue;
            }

            for entry in WalkDir::new(&root_path)
                .into_iter()
                .filter_map(|entry| entry.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }

                let rel = match entry.path().strip_prefix(&root_path) {
                    Ok(rel) => rel,
                    Err(_) => continue,
                };

                let rel_path = Path::new(root_name).join(rel);
                let rel_str = rel_path.to_string_lossy().replace('\\', "/");
                entries.push((rel_str, Self::quick_file_fingerprint(entry.path())));
            }
        }

        entries.sort_by(|a, b| a.0.cmp(&b.0));
        entries
    }

    fn snapshot_environment(instance_dir: &Path) -> SaveBackupEnvironment {
        let mods = Self::collect_mod_entries(&instance_dir.join("mods"));
        let mod_pairs = mods
            .iter()
            .map(|item| (item.file_name.clone(), item.hash.clone()))
            .collect::<Vec<_>>();
        let config_pairs = Self::collect_config_entries(instance_dir);

        SaveBackupEnvironment {
            mods_hash: Self::hash_pairs(&mod_pairs),
            config_hash: Self::hash_pairs(&config_pairs),
            mod_count: mods.len(),
            mods,
        }
    }

    fn create_backup<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
        trigger: &str,
        safe_backup: bool,
    ) -> Result<SaveBackupMetadata, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let src_save_dir = game_dir.join("saves").join(folder_name);
        if !src_save_dir.exists() {
            return Err("save folder does not exist".to_string());
        }

        let instance_config = Self::get_instance_config(&instance_dir)?;
        let save_cache = Self::inspect_save_folder(instance_id, folder_name, &src_save_dir)?;
        let backup_id = Uuid::new_v4().to_string();
        let world_root_dir = Self::get_backups_dir(app)?
            .join(instance_id)
            .join(&save_cache.world_uuid);
        let final_backup_dir = world_root_dir.join(&backup_id);
        let temp_backup_dir = world_root_dir.join(format!(".{}.tmp", backup_id));
        let world_file_count = Self::count_files(&src_save_dir);
        let config_sources = Self::get_config_backup_sources(&game_dir);
        let config_file_count = config_sources
            .iter()
            .map(|(path, _)| Self::count_files(path))
            .sum::<u64>();
        let total_files = (world_file_count + config_file_count).max(1);

        Self::emit_backup_progress(
            app,
            instance_id,
            folder_name,
            0,
            total_files,
            "preparing backup snapshot",
            "PREPARE",
        );

        let result = (|| -> Result<SaveBackupMetadata, String> {
            Self::remove_dir_if_exists(&temp_backup_dir)?;
            if let Some(parent) = final_backup_dir.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::create_dir_all(&temp_backup_dir).map_err(|e| e.to_string())?;

            let mut processed_files = 0;
            let world_size = Self::zip_sources(
                app,
                instance_id,
                folder_name,
                &[(src_save_dir.clone(), String::new())],
                &temp_backup_dir.join(BACKUP_WORLD_ARCHIVE_FILE),
                "PACK_WORLD",
                &mut processed_files,
                total_files,
            )?;
            let config_size = if config_file_count > 0 {
                Self::zip_sources(
                    app,
                    instance_id,
                    folder_name,
                    &config_sources,
                    &temp_backup_dir.join(BACKUP_CONFIG_ARCHIVE_FILE),
                    "PACK_CONFIGS",
                    &mut processed_files,
                    total_files,
                )?
            } else {
                0
            };

            let preview_src = src_save_dir.join("icon.png");
            if preview_src.exists() {
                fs::copy(&preview_src, temp_backup_dir.join(BACKUP_PREVIEW_FILE))
                    .map_err(|e| e.to_string())?;
            }

            Self::emit_backup_progress(
                app,
                instance_id,
                folder_name,
                processed_files.min(total_files),
                total_files,
                "writing metadata",
                "FINALIZE",
            );

            let environment = Self::snapshot_environment(&game_dir);

            let meta = SaveBackupMetadata {
                backup_id: backup_id.clone(),
                instance_id: instance_id.to_string(),
                world: SaveBackupWorld {
                    name: save_cache.world_name,
                    uuid: save_cache.world_uuid,
                    folder_name: folder_name.to_string(),
                },
                created_at: Local::now().timestamp(),
                trigger: trigger.to_string(),
                game: SaveBackupGame {
                    mc_version: instance_config.mc_version,
                    loader: instance_config.loader.r#type,
                    loader_version: instance_config.loader.version,
                },
                environment,
                files: SaveBackupFiles {
                    world_size,
                    config_size,
                    total_size: world_size + config_size,
                },
                state: SaveBackupState { safe_backup },
                user: SaveBackupUser::default(),
                has_configs: config_size > 0,
            };

            Self::write_json_atomically(&temp_backup_dir.join(BACKUP_META_FILE), &meta)?;
            Self::move_dir_with_fallback(&temp_backup_dir, &final_backup_dir)?;
            Self::emit_backup_progress(
                app,
                instance_id,
                folder_name,
                total_files,
                total_files,
                "backup snapshot completed",
                "DONE",
            );
            Ok(meta)
        })();

        if let Err(error) = &result {
            let _ = Self::remove_dir_if_exists(&temp_backup_dir);
            Self::emit_backup_progress(
                app,
                instance_id,
                folder_name,
                0,
                total_files,
                error.clone(),
                "ERROR",
            );
        }

        result
    }

    fn build_new_backup_record(backup_dir: &Path) -> Option<BackupRecord> {
        let meta_path = backup_dir.join(BACKUP_META_FILE);
        if !meta_path.exists() {
            return None;
        }

        let content = fs::read_to_string(&meta_path).ok()?;
        let mut meta = serde_json::from_str::<SaveBackupMetadata>(&content).ok()?;
        if meta.world.folder_name.is_empty() {
            meta.world.folder_name = meta.world.name.clone();
        }
        if meta.world.uuid.is_empty() {
            meta.world.uuid = Self::stable_world_uuid(&meta.instance_id, &meta.world.folder_name);
        }
        let world_payload =
            Self::resolve_backup_payload(backup_dir.join(BACKUP_WORLD_ARCHIVE_FILE));
        if matches!(world_payload, BackupPayload::Missing) {
            return None;
        }

        let configs_payload =
            Self::resolve_backup_payload(backup_dir.join(BACKUP_CONFIG_ARCHIVE_FILE));
        meta.has_configs = meta.has_configs || !matches!(configs_payload, BackupPayload::Missing);

        Some(BackupRecord {
            backup_dir: backup_dir.to_path_buf(),
            world_payload,
            configs_payload,
            meta,
        })
    }

    fn load_backup_records<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<BackupRecord>, String> {
        let backups_dir = Self::get_backups_dir(app)?;
        let mut records = Vec::new();

        let new_root = backups_dir.join(instance_id);
        if let Ok(world_entries) = fs::read_dir(&new_root) {
            for world_entry in world_entries.filter_map(|entry| entry.ok()) {
                let world_path = world_entry.path();
                if !world_path.is_dir() {
                    continue;
                }

                for backup_entry in fs::read_dir(&world_path)
                    .ok()
                    .into_iter()
                    .flat_map(|entries| entries.filter_map(|entry| entry.ok()))
                {
                    let backup_path = backup_entry.path();
                    if !backup_path.is_dir() {
                        continue;
                    }

                    let dir_name = backup_entry.file_name().to_string_lossy().to_string();
                    if dir_name.starts_with('.') {
                        continue;
                    }

                    if let Some(record) = Self::build_new_backup_record(&backup_path) {
                        if record.meta.instance_id == instance_id {
                            records.push(record);
                        }
                    }
                }
            }
        }

        records.sort_by(|a, b| b.meta.created_at.cmp(&a.meta.created_at));
        Ok(records)
    }

    fn find_backup_record<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        backup_id: &str,
    ) -> Result<BackupRecord, String> {
        Self::load_backup_records(app, instance_id)?
            .into_iter()
            .find(|record| record.meta.backup_id == backup_id)
            .ok_or_else(|| "backup snapshot not found".to_string())
    }

    fn diff_mods(
        current_mods: &[SaveBackupModEntry],
        backup_mods: &[SaveBackupModEntry],
    ) -> Vec<String> {
        let mut warnings = Vec::new();

        for backup_mod in backup_mods {
            match current_mods
                .iter()
                .find(|item| item.file_name == backup_mod.file_name)
            {
                None => warnings.push(format!("missing mod: {}", backup_mod.file_name)),
                Some(current_mod) if current_mod.hash != backup_mod.hash => {
                    warnings.push(format!("changed mod: {}", backup_mod.file_name));
                }
                _ => {}
            }

            if warnings.len() >= 5 {
                return warnings;
            }
        }

        for current_mod in current_mods {
            if backup_mods
                .iter()
                .all(|item| item.file_name != current_mod.file_name)
            {
                warnings.push(format!("extra mod: {}", current_mod.file_name));
            }

            if warnings.len() >= 5 {
                break;
            }
        }

        warnings
    }

    fn build_restore_check<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        meta: &SaveBackupMetadata,
    ) -> Result<SaveRestoreCheckResult, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let instance_config = Self::get_instance_config(&instance_dir)?;
        let current_environment = Self::snapshot_environment(&game_dir);
        let mut warnings = Vec::new();

        let game_matches = instance_config.mc_version == meta.game.mc_version;
        if !game_matches {
            warnings.push(format!(
                "minecraft version mismatch: current {}, backup {}",
                instance_config.mc_version, meta.game.mc_version
            ));
        }

        let loader_matches = meta.game.loader.is_empty()
            || (instance_config
                .loader
                .r#type
                .eq_ignore_ascii_case(&meta.game.loader)
                && (meta.game.loader_version.is_empty()
                    || instance_config.loader.version.is_empty()
                    || instance_config.loader.version == meta.game.loader_version));
        if !loader_matches {
            let current_loader = if instance_config.loader.version.is_empty() {
                instance_config.loader.r#type.clone()
            } else {
                format!(
                    "{} {}",
                    instance_config.loader.r#type, instance_config.loader.version
                )
            };
            let backup_loader = if meta.game.loader.is_empty() {
                meta.game.loader_version.clone()
            } else if meta.game.loader_version.is_empty() {
                meta.game.loader.clone()
            } else {
                format!("{} {}", meta.game.loader, meta.game.loader_version)
            };
            warnings.push(format!(
                "loader mismatch: current {}, backup {}",
                current_loader, backup_loader
            ));
        }

        let mods_match = meta.environment.mods_hash.is_empty()
            || current_environment.mods_hash == meta.environment.mods_hash;
        if !mods_match {
            warnings.push(format!(
                "mod environment differs: current {} mods, backup {} mods",
                current_environment.mod_count, meta.environment.mod_count
            ));
            warnings.extend(Self::diff_mods(
                &current_environment.mods,
                &meta.environment.mods,
            ));
        }

        let configs_match = meta.environment.config_hash.is_empty()
            || current_environment.config_hash == meta.environment.config_hash;
        if !configs_match && meta.has_configs {
            warnings.push(
                "config snapshot differs from the current instance. Enable config restore to fully roll back."
                    .to_string(),
            );
        }

        if !meta.state.safe_backup {
            warnings.push(
                "this snapshot was marked as non-safe and may have been created while the world was active."
                    .to_string(),
            );
        }

        Ok(SaveRestoreCheckResult {
            backup_id: meta.backup_id.clone(),
            target_folder_name: meta.world.folder_name.clone(),
            warnings,
            safe_backup: meta.state.safe_backup,
            can_restore_configs: meta.has_configs,
            auto_backup_current: true,
            game_matches,
            loader_matches,
            mods_match,
            configs_match,
        })
    }

    fn restore_snapshot_dir(src: &Path, dst: &Path) -> Result<(), String> {
        if dst.exists() {
            fs::remove_dir_all(dst).map_err(|e| e.to_string())?;
        }
        if src.exists() {
            Self::copy_dir_all(src, dst).map_err(|e| e.to_string())?;
        } else {
            fs::create_dir_all(dst).map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_saves<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<SaveItem>, String> {
        let saves_dir = Self::get_game_dir(app, instance_id)?.join("saves");
        fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

        let mut saves = Vec::new();
        if let Ok(entries) = fs::read_dir(&saves_dir) {
            for entry in entries.filter_map(|entry| entry.ok()) {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                let folder_name = entry.file_name().to_string_lossy().to_string();
                let cache = Self::inspect_save_folder(instance_id, &folder_name, &path)?;
                let icon_path = path.join("icon.png");

                saves.push(SaveItem {
                    folder_name,
                    world_name: cache.world_name,
                    world_uuid: cache.world_uuid,
                    size_bytes: cache.size_bytes,
                    last_played_time: cache.last_played_time,
                    created_time: cache.created_time,
                    icon_path: icon_path
                        .exists()
                        .then(|| icon_path.to_string_lossy().to_string()),
                });
            }
        }

        saves.sort_by(|a, b| b.last_played_time.cmp(&a.last_played_time));
        Ok(saves)
    }

    pub fn backup_save<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
    ) -> Result<SaveBackupMetadata, String> {
        Self::create_backup(app, instance_id, folder_name, "manual", true)
    }

    pub fn delete_save<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        folder_name: &str,
        direct_delete: bool,
    ) -> Result<(), String> {
        let src_save_dir = Self::get_game_dir(app, instance_id)?
            .join("saves")
            .join(folder_name);
        if !src_save_dir.exists() {
            return Ok(());
        }

        if direct_delete {
            fs::remove_dir_all(&src_save_dir).map_err(|e| e.to_string())?;
            return Ok(());
        }

        let trash_dir = Self::get_trash_dir(app)?;
        fs::create_dir_all(&trash_dir).map_err(|e| e.to_string())?;
        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let trash_target = trash_dir.join(format!("{}_{}", folder_name, timestamp));
        Self::move_dir_with_fallback(&src_save_dir, &trash_target)
    }

    pub fn delete_backup<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        backup_id: &str,
    ) -> Result<(), String> {
        let record = Self::find_backup_record(app, instance_id, backup_id)?;
        Self::remove_dir_if_exists(&record.backup_dir)?;

        if let Some(world_root) = record.backup_dir.parent() {
            let is_empty = fs::read_dir(world_root)
                .map(|mut entries| entries.next().is_none())
                .unwrap_or(false);
            if is_empty {
                let _ = fs::remove_dir(world_root);
            }
        }

        Ok(())
    }

    pub fn verify_restore<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        backup_id: &str,
    ) -> Result<SaveRestoreCheckResult, String> {
        let record = Self::find_backup_record(app, instance_id, backup_id)?;
        Self::build_restore_check(app, instance_id, &record.meta)
    }

    pub fn restore_backup<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        backup_id: &str,
        restore_configs: bool,
        auto_backup_current: bool,
    ) -> Result<SaveRestoreResult, String> {
        let record = Self::find_backup_record(app, instance_id, backup_id)?;

        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let saves_dir = game_dir.join("saves");
        fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

        let target_folder_name = record.meta.world.folder_name.clone();
        let target_save_dir = saves_dir.join(&target_folder_name);

        let guard_backup_id = if auto_backup_current && target_save_dir.exists() {
            Some(
                Self::create_backup(app, instance_id, &target_folder_name, "restore_guard", true)?
                    .backup_id,
            )
        } else {
            None
        };

        let temp_restore_dir = saves_dir.join(format!(".restore-{}", Uuid::new_v4()));
        Self::remove_dir_if_exists(&temp_restore_dir)?;
        match &record.world_payload {
            BackupPayload::Archive(path) => {
                Self::extract_archive_to(path, &temp_restore_dir)?;
            }
            BackupPayload::Missing => {
                return Err("backup world payload is missing".to_string());
            }
        }

        if target_save_dir.exists() {
            fs::remove_dir_all(&target_save_dir).map_err(|e| e.to_string())?;
        }
        Self::move_dir_with_fallback(&temp_restore_dir, &target_save_dir)?;

        if restore_configs && record.meta.has_configs {
            let temp_configs_root =
                instance_dir.join(format!(".restore-configs-{}", Uuid::new_v4()));
            Self::remove_dir_if_exists(&temp_configs_root)?;

            match &record.configs_payload {
                BackupPayload::Archive(path) => {
                    Self::extract_archive_to(path, &temp_configs_root)?;
                }
                BackupPayload::Missing => {
                    return Err("backup config payload is missing".to_string());
                }
            }

            Self::restore_snapshot_dir(
                &temp_configs_root.join("config"),
                &game_dir.join("config"),
            )?;
            Self::restore_snapshot_dir(
                &temp_configs_root.join("defaultconfigs"),
                &game_dir.join("defaultconfigs"),
            )?;
            let _ = Self::remove_dir_if_exists(&temp_configs_root);
        }

        let _ = Self::inspect_save_folder(instance_id, &target_folder_name, &target_save_dir);

        Ok(SaveRestoreResult {
            backup_id: record.meta.backup_id,
            restored_folder_name: target_folder_name,
            restored_configs: restore_configs && record.meta.has_configs,
            guard_backup_id,
        })
    }

    pub fn get_backups<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<SaveBackupMetadata>, String> {
        Ok(Self::load_backup_records(app, instance_id)?
            .into_iter()
            .map(|record| record.meta)
            .collect())
    }

    pub fn open_saves_folder<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<(), String> {
        let saves_dir = Self::get_game_dir(app, instance_id)?.join("saves");
        fs::create_dir_all(&saves_dir).map_err(|e| e.to_string())?;

        #[cfg(target_os = "windows")]
        std::process::Command::new("explorer")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        std::process::Command::new("open")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| e.to_string())?;

        #[cfg(target_os = "linux")]
        std::process::Command::new("xdg-open")
            .arg(&saves_dir)
            .spawn()
            .map_err(|e| e.to_string())?;

        Ok(())
    }
}
