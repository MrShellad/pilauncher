use crate::services::config_service::ConfigService;
use chrono::Utc;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use sha1::Digest as Sha1Digest;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::{atomic::Ordering, Arc, Mutex};
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;

const SNAPSHOT_SCHEMA_VERSION: u32 = 2;
const SNAPSHOT_STORE_DIRECTORY: &str = "snapshot-store";
const SNAPSHOT_RESTORE_DIRECTORY: &str = ".pilauncher-snapshot-restore";

static INSTANCE_SNAPSHOT_LOCKS: Lazy<Mutex<HashMap<String, Arc<Mutex<()>>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ModEntry {
    pub hash: String,
    #[serde(default = "default_hash_algorithm")]
    pub hash_algorithm: String,
    pub file_name: String,
    pub mod_id: Option<String>,
    pub version: Option<String>,
    #[serde(default)]
    pub is_enabled: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstanceSnapshot {
    #[serde(default = "default_snapshot_schema_version")]
    pub schema_version: u32,
    pub id: String,
    pub timestamp: i64,
    pub trigger: String,
    pub message: String,
    pub mods: Vec<ModEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotDiff {
    pub added: Vec<ModEntry>,
    pub removed: Vec<ModEntry>,
    pub updated: Vec<ModUpdatePair>,
    pub state_changed: Vec<ModUpdatePair>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModUpdatePair {
    pub old: ModEntry,
    pub new: ModEntry,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RollbackResult {
    pub restored_snapshot_id: String,
    pub pre_rollback_snapshot_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotProgressEvent {
    instance_id: String,
    current: usize,
    total: usize,
    phase: String,
    file: String,
    operation_id: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
enum RestoreStage {
    Prepared,
    PreviousMoved,
    Activated,
    Committed,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RestoreJournal {
    schema_version: u32,
    instance_id: String,
    operation_id: String,
    target_snapshot_id: String,
    stage: RestoreStage,
}

pub struct ModSnapshotManager;

impl ModSnapshotManager {
    pub fn get_instance_root<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        Self::validate_instance_id(instance_id)?;
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "未配置基础数据目录".to_string())?;

        Ok(PathBuf::from(base_path).join("instances").join(instance_id))
    }

    pub fn get_game_mods_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let mods_dir = Self::resolve_game_mods_dir(app, instance_id)?;
        fs::create_dir_all(&mods_dir).map_err(|e| format!("无法创建 mods 目录: {e}"))?;
        Ok(mods_dir)
    }

    pub fn take_snapshot<R: Runtime>(
        app: AppHandle<R>,
        instance_id: String,
        trigger: String,
        message: String,
    ) -> Result<InstanceSnapshot, String> {
        Self::validate_instance_id(&instance_id)?;
        let lock = Self::instance_lock(&instance_id)?;
        let _guard = lock.lock().map_err(|_| "快照操作锁已损坏".to_string())?;

        Self::ensure_game_not_running()?;
        Self::recover_pending_restore(&app, &instance_id)?;
        Self::take_snapshot_locked(&app, &instance_id, trigger, message)
    }

    pub fn get_snapshot_history<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<InstanceSnapshot>, String> {
        Self::validate_instance_id(instance_id)?;

        let mut snapshots = HashMap::new();
        let legacy_dir = Self::legacy_snapshots_dir(app, instance_id)?;
        for snapshot in Self::read_snapshot_directory(&legacy_dir)? {
            snapshots.insert(snapshot.id.clone(), snapshot);
        }

        let manifest_dir = Self::snapshot_manifest_dir(app, instance_id)?;
        for snapshot in Self::read_snapshot_directory(&manifest_dir)? {
            snapshots.insert(snapshot.id.clone(), snapshot);
        }

        let mut history: Vec<_> = snapshots.into_values().collect();
        history.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
        Ok(history)
    }

    pub fn calculate_snapshot_diff<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        old_id: &str,
        new_id: &str,
    ) -> Result<SnapshotDiff, String> {
        let history = Self::get_snapshot_history(app, instance_id)?;
        let old_snapshot = history
            .iter()
            .find(|snapshot| snapshot.id == old_id)
            .ok_or_else(|| format!("找不到快照: {old_id}"))?;
        let new_snapshot = history
            .iter()
            .find(|snapshot| snapshot.id == new_id)
            .ok_or_else(|| format!("找不到快照: {new_id}"))?;

        let old_mods = Self::snapshot_entries_by_name(old_snapshot)?;
        let new_mods = Self::snapshot_entries_by_name(new_snapshot)?;
        let mut added = Vec::new();
        let mut removed = Vec::new();
        let mut updated = Vec::new();
        let mut state_changed = Vec::new();

        for (name, new_mod) in &new_mods {
            if let Some(old_mod) = old_mods.get(name) {
                if old_mod.hash != new_mod.hash || old_mod.hash_algorithm != new_mod.hash_algorithm
                {
                    updated.push(ModUpdatePair {
                        old: old_mod.clone(),
                        new: new_mod.clone(),
                    });
                }

                if Self::resolved_enabled_state(old_mod) != Self::resolved_enabled_state(new_mod) {
                    state_changed.push(ModUpdatePair {
                        old: old_mod.clone(),
                        new: new_mod.clone(),
                    });
                }
            } else {
                added.push(new_mod.clone());
            }
        }

        for (name, old_mod) in old_mods {
            if !new_mods.contains_key(&name) {
                removed.push(old_mod);
            }
        }

        Ok(SnapshotDiff {
            added,
            removed,
            updated,
            state_changed,
        })
    }

    pub fn rollback_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        snapshot_id: &str,
    ) -> Result<RollbackResult, String> {
        Self::validate_instance_id(instance_id)?;
        let lock = Self::instance_lock(instance_id)?;
        let _guard = lock.lock().map_err(|_| "快照操作锁已损坏".to_string())?;

        Self::ensure_game_not_running()?;
        Self::recover_pending_restore(app, instance_id)?;
        let target_snapshot = Self::get_snapshot_history(app, instance_id)?
            .into_iter()
            .find(|snapshot| snapshot.id == snapshot_id)
            .ok_or_else(|| format!("找不到指定快照: {snapshot_id}"))?;

        // A rollback is always preceded by a durable snapshot of the current state.
        let pre_rollback_snapshot = Self::take_snapshot_locked(
            app,
            instance_id,
            "PRE_ROLLBACK".to_string(),
            format!("自动创建：回滚到 {} 前的状态", target_snapshot.id),
        )?;

        Self::restore_snapshot_locked(app, instance_id, &target_snapshot)?;
        Ok(RollbackResult {
            restored_snapshot_id: target_snapshot.id,
            pre_rollback_snapshot_id: pre_rollback_snapshot.id,
        })
    }

    fn take_snapshot_locked<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        trigger: String,
        message: String,
    ) -> Result<InstanceSnapshot, String> {
        let operation_id = Uuid::new_v4().to_string();
        let mods_dir = Self::resolve_game_mods_dir(app, instance_id)?;
        let target_files = Self::list_mod_files(&mods_dir)?;
        let total = target_files.len();
        let mut mods = Vec::with_capacity(total);

        Self::emit_progress(
            app,
            instance_id,
            0,
            total,
            "扫描模组文件",
            "",
            &operation_id,
        );

        for (index, path) in target_files.iter().enumerate() {
            let file_name = Self::file_name(path)?;
            Self::emit_progress(
                app,
                instance_id,
                index,
                total,
                &format!("归档文件 ({}/{})", index + 1, total),
                &file_name,
                &operation_id,
            );

            let hash = Self::sha256_file(path)?;
            Self::ensure_blob(app, path, &hash)?;
            let (mod_id, version) = Self::parse_manifest_mod_id(app, instance_id, &file_name);
            mods.push(ModEntry {
                hash,
                hash_algorithm: "sha256".to_string(),
                file_name: file_name.clone(),
                mod_id,
                version,
                is_enabled: Some(!file_name.to_ascii_lowercase().ends_with(".disabled")),
            });
        }

        let snapshot = InstanceSnapshot {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().timestamp_millis(),
            trigger,
            message,
            mods,
        };
        let manifest_path =
            Self::snapshot_manifest_dir(app, instance_id)?.join(format!("{}.json", snapshot.id));
        Self::write_json_atomically(&manifest_path, &snapshot)?;
        Self::emit_progress(app, instance_id, total, total, "完成", "", &operation_id);

        Ok(snapshot)
    }

    fn restore_snapshot_locked<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        target_snapshot: &InstanceSnapshot,
    ) -> Result<(), String> {
        let mods_dir = Self::resolve_game_mods_dir(app, instance_id)?;
        let parent_dir = mods_dir
            .parent()
            .ok_or_else(|| "无法确定 mods 父目录".to_string())?
            .to_path_buf();
        fs::create_dir_all(&parent_dir).map_err(|e| format!("无法创建实例目录: {e}"))?;

        let operation_id = Uuid::new_v4().to_string();
        let operation_dir = parent_dir
            .join(SNAPSHOT_RESTORE_DIRECTORY)
            .join(&operation_id);
        let staging_dir = operation_dir.join("staging");
        let previous_dir = operation_dir.join("previous");
        fs::create_dir_all(&staging_dir).map_err(|e| format!("无法创建回滚暂存目录: {e}"))?;

        let entries = Self::snapshot_entries_by_name(target_snapshot)?;
        for mod_entry in entries.values() {
            Self::validate_snapshot_file_name(&mod_entry.file_name)?;
            let source = Self::resolve_snapshot_blob(app, mod_entry)?;
            let target = staging_dir.join(&mod_entry.file_name);
            Self::copy_file_durably(&source, &target)?;
            let actual_hash = Self::hash_file_with_algorithm(&target, &mod_entry.hash_algorithm)?;
            if actual_hash != mod_entry.hash {
                return Err(format!("恢复暂存校验失败: {}", mod_entry.file_name));
            }
        }

        let mut journal = RestoreJournal {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            instance_id: instance_id.to_string(),
            operation_id,
            target_snapshot_id: target_snapshot.id.clone(),
            stage: RestoreStage::Prepared,
        };
        Self::write_restore_journal(&operation_dir, &journal)?;

        if mods_dir.exists() {
            fs::rename(&mods_dir, &previous_dir)
                .map_err(|e| format!("无法保留当前 mods 目录: {e}"))?;
        }
        journal.stage = RestoreStage::PreviousMoved;
        Self::write_restore_journal(&operation_dir, &journal)?;

        if let Err(error) = fs::rename(&staging_dir, &mods_dir) {
            let restore_error = if previous_dir.exists() {
                fs::rename(&previous_dir, &mods_dir).err()
            } else {
                None
            };
            return Err(match restore_error {
                Some(restore_error) => {
                    format!("无法激活回滚目录: {error}; 自动恢复原目录也失败: {restore_error}")
                }
                None => format!("无法激活回滚目录: {error}"),
            });
        }
        journal.stage = RestoreStage::Activated;
        Self::write_restore_journal(&operation_dir, &journal)?;

        if let Err(error) = Self::verify_restored_mods(&mods_dir, target_snapshot) {
            let failed_dir = operation_dir.join("failed");
            let recovery = fs::rename(&mods_dir, &failed_dir)
                .and_then(|_| fs::rename(&previous_dir, &mods_dir));
            return Err(match recovery {
                Ok(_) => format!("回滚后的目录校验失败，已恢复原 mods 目录: {error}"),
                Err(recovery_error) => {
                    format!("回滚后的目录校验失败: {error}; 自动恢复原目录失败: {recovery_error}")
                }
            });
        }

        journal.stage = RestoreStage::Committed;
        Self::write_restore_journal(&operation_dir, &journal)?;
        let _ = fs::remove_dir_all(&operation_dir);
        Ok(())
    }

    fn recover_pending_restore<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<(), String> {
        let mods_dir = Self::resolve_game_mods_dir(app, instance_id)?;
        let parent_dir = mods_dir
            .parent()
            .ok_or_else(|| "无法确定 mods 父目录".to_string())?;
        let transactions_dir = parent_dir.join(SNAPSHOT_RESTORE_DIRECTORY);
        if !transactions_dir.exists() {
            return Ok(());
        }

        for entry in
            fs::read_dir(&transactions_dir).map_err(|e| format!("无法读取回滚恢复日志: {e}"))?
        {
            let entry = entry.map_err(|e| format!("无法读取回滚恢复项: {e}"))?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_dir() {
                continue;
            }

            let operation_dir = entry.path();
            let previous_dir = operation_dir.join("previous");
            let Some(journal) = Self::read_restore_journal(&operation_dir)? else {
                if previous_dir.exists() {
                    return Err(format!(
                        "发现缺少恢复日志的回滚事务，已保留现场以避免覆盖 mods: {}",
                        operation_dir.display()
                    ));
                }
                let _ = fs::remove_dir_all(&operation_dir);
                continue;
            };
            if journal.instance_id != instance_id {
                continue;
            }

            match journal.stage {
                RestoreStage::Prepared => {
                    if !mods_dir.exists() && previous_dir.exists() {
                        fs::rename(&previous_dir, &mods_dir)
                            .map_err(|e| format!("恢复未完成回滚的原 mods 目录失败: {e}"))?;
                    }
                }
                RestoreStage::PreviousMoved => {
                    if !mods_dir.exists() && previous_dir.exists() {
                        fs::rename(&previous_dir, &mods_dir)
                            .map_err(|e| format!("恢复未完成回滚的原 mods 目录失败: {e}"))?;
                    } else if mods_dir.exists() && previous_dir.exists() {
                        let target = Self::get_snapshot_history(app, instance_id)?
                            .into_iter()
                            .find(|snapshot| snapshot.id == journal.target_snapshot_id)
                            .ok_or_else(|| {
                                format!(
                                    "无法验证中断回滚的目标快照: {}",
                                    journal.target_snapshot_id
                                )
                            })?;
                        Self::verify_restored_mods(&mods_dir, &target).map_err(|error| {
                            format!("中断回滚后的 mods 未通过校验，已保留现场: {error}")
                        })?;
                    }
                }
                RestoreStage::Activated | RestoreStage::Committed => {
                    if !mods_dir.exists() && previous_dir.exists() {
                        fs::rename(&previous_dir, &mods_dir)
                            .map_err(|e| format!("恢复中断回滚的原 mods 目录失败: {e}"))?;
                    } else if mods_dir.exists() && previous_dir.exists() {
                        let target = Self::get_snapshot_history(app, instance_id)?
                            .into_iter()
                            .find(|snapshot| snapshot.id == journal.target_snapshot_id)
                            .ok_or_else(|| {
                                format!(
                                    "无法验证中断回滚的目标快照: {}",
                                    journal.target_snapshot_id
                                )
                            })?;
                        if let Err(error) = Self::verify_restored_mods(&mods_dir, &target) {
                            let failed_dir = operation_dir.join("failed-recovery");
                            fs::rename(&mods_dir, &failed_dir)
                                .and_then(|_| fs::rename(&previous_dir, &mods_dir))
                                .map_err(|recovery_error| {
                                    format!(
                                        "中断回滚校验失败: {error}; 自动恢复原 mods 目录失败: {recovery_error}"
                                    )
                                })?;
                        }
                    }
                }
            }
            let _ = fs::remove_dir_all(&operation_dir);
        }

        let _ = fs::remove_dir(&transactions_dir);
        Ok(())
    }

    fn verify_restored_mods(mods_dir: &Path, snapshot: &InstanceSnapshot) -> Result<(), String> {
        let expected = Self::snapshot_entries_by_name(snapshot)?;
        let actual_paths = Self::list_mod_files(mods_dir)?;
        if actual_paths.len() != expected.len() {
            return Err("恢复后的模组数量与快照不一致".to_string());
        }

        for path in actual_paths {
            let file_name = Self::file_name(&path)?;
            let entry = expected
                .get(&file_name.to_ascii_lowercase())
                .ok_or_else(|| format!("恢复后出现未记录文件: {file_name}"))?;
            let hash = Self::hash_file_with_algorithm(&path, &entry.hash_algorithm)?;
            if hash != entry.hash {
                return Err(format!("恢复后文件哈希不匹配: {file_name}"));
            }
        }
        Ok(())
    }

    fn resolve_snapshot_blob<R: Runtime>(
        app: &AppHandle<R>,
        entry: &ModEntry,
    ) -> Result<PathBuf, String> {
        let path = if entry.hash_algorithm.eq_ignore_ascii_case("sha256") {
            Self::blob_path(app, &entry.hash)?
        } else if entry.hash_algorithm.eq_ignore_ascii_case("sha1") {
            Self::legacy_shared_mods_dir(app)?.join(format!("{}.jar", entry.hash))
        } else {
            return Err(format!("不支持的快照哈希算法: {}", entry.hash_algorithm));
        };

        if !path.is_file() {
            return Err(format!("快照内容缺失: {}", entry.file_name));
        }
        let actual_hash = Self::hash_file_with_algorithm(&path, &entry.hash_algorithm)?;
        if actual_hash != entry.hash {
            return Err(format!("快照内容校验失败: {}", entry.file_name));
        }
        Ok(path)
    }

    fn ensure_blob<R: Runtime>(
        app: &AppHandle<R>,
        source: &Path,
        hash: &str,
    ) -> Result<(), String> {
        let target = Self::blob_path(app, hash)?;
        if target.exists() {
            let actual_hash = Self::sha256_file(&target)?;
            if actual_hash != hash {
                return Err(format!("快照仓库内容损坏: {}", target.display()));
            }
            return Ok(());
        }

        let parent = target
            .parent()
            .ok_or_else(|| "无法确定快照 Blob 目录".to_string())?;
        fs::create_dir_all(parent).map_err(|e| format!("无法创建快照 Blob 目录: {e}"))?;
        let temp = parent.join(format!(".{}.{}.partial", hash, Uuid::new_v4()));
        Self::copy_file_durably(source, &temp)?;
        let actual_hash = Self::sha256_file(&temp)?;
        if actual_hash != hash {
            let _ = fs::remove_file(&temp);
            return Err(format!("快照 Blob 写入校验失败: {}", source.display()));
        }

        if let Err(error) = fs::rename(&temp, &target) {
            if target.exists() && Self::sha256_file(&target)? == hash {
                let _ = fs::remove_file(&temp);
                return Ok(());
            }
            let _ = fs::remove_file(&temp);
            return Err(format!("无法提交快照 Blob: {error}"));
        }
        Ok(())
    }

    fn resolve_game_mods_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let instance_root = Self::get_instance_root(app, instance_id)?;
        let json_path = instance_root.join("instance.json");
        let target_root = match fs::read_to_string(&json_path) {
            Ok(content) => {
                match serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content) {
                    Ok(config) => config
                        .third_party_path
                        .map(PathBuf::from)
                        .unwrap_or(instance_root),
                    Err(_) => instance_root,
                }
            }
            Err(_) => instance_root,
        };
        Ok(target_root.join("mods"))
    }

    fn snapshot_store_root<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "未配置基础数据目录".to_string())?;
        Ok(PathBuf::from(base_path).join(SNAPSHOT_STORE_DIRECTORY))
    }

    fn snapshot_manifest_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        Ok(Self::snapshot_store_root(app)?
            .join("manifests")
            .join(instance_id))
    }

    fn blob_path<R: Runtime>(app: &AppHandle<R>, hash: &str) -> Result<PathBuf, String> {
        if hash.len() != 64 || !hash.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err("无效的 SHA-256 快照哈希".to_string());
        }
        Ok(Self::snapshot_store_root(app)?
            .join("blobs")
            .join(&hash[..2])
            .join(hash))
    }

    fn legacy_snapshots_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        Ok(Self::get_instance_root(app, instance_id)?
            .join("piconfig")
            .join("snapshots")
            .join("mods"))
    }

    fn legacy_shared_mods_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "未配置基础数据目录".to_string())?;
        Ok(PathBuf::from(base_path).join("shared_mods").join("mods"))
    }

    fn read_snapshot_directory(directory: &Path) -> Result<Vec<InstanceSnapshot>, String> {
        if !directory.exists() {
            return Ok(Vec::new());
        }

        let mut snapshots = Vec::new();
        for entry in fs::read_dir(directory).map_err(|e| format!("无法读取快照目录: {e}"))?
        {
            let entry = entry.map_err(|e| format!("无法读取快照文件项: {e}"))?;
            let path = entry.path();
            if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                continue;
            }
            snapshots.push(Self::read_json(&path)?);
        }
        Ok(snapshots)
    }

    fn read_json<T: for<'a> Deserialize<'a>>(path: &Path) -> Result<T, String> {
        let content =
            fs::read_to_string(path).map_err(|e| format!("无法读取 {}: {e}", path.display()))?;
        serde_json::from_str(&content)
            .map_err(|e| format!("快照元数据损坏 {}: {e}", path.display()))
    }

    fn write_restore_journal(operation_dir: &Path, journal: &RestoreJournal) -> Result<(), String> {
        let path = operation_dir.join(format!(
            "journal-{}.json",
            Self::restore_stage_name(journal.stage)
        ));
        Self::write_json_atomically(&path, journal)
    }

    fn read_restore_journal(operation_dir: &Path) -> Result<Option<RestoreJournal>, String> {
        for stage in [
            RestoreStage::Committed,
            RestoreStage::Activated,
            RestoreStage::PreviousMoved,
            RestoreStage::Prepared,
        ] {
            let path =
                operation_dir.join(format!("journal-{}.json", Self::restore_stage_name(stage)));
            if path.exists() {
                return Self::read_json(&path).map(Some);
            }
        }
        Ok(None)
    }

    fn restore_stage_name(stage: RestoreStage) -> &'static str {
        match stage {
            RestoreStage::Prepared => "prepared",
            RestoreStage::PreviousMoved => "previous-moved",
            RestoreStage::Activated => "activated",
            RestoreStage::Committed => "committed",
        }
    }

    fn write_json_atomically<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
        let parent = path
            .parent()
            .ok_or_else(|| "无法确定元数据目录".to_string())?;
        fs::create_dir_all(parent).map_err(|e| format!("无法创建元数据目录: {e}"))?;
        let temp = parent.join(format!(
            ".{}.{}.tmp",
            Self::file_name(path)?,
            Uuid::new_v4()
        ));
        let bytes = serde_json::to_vec_pretty(value).map_err(|e| e.to_string())?;
        let mut file = File::create(&temp).map_err(|e| format!("无法写入临时元数据: {e}"))?;
        file.write_all(&bytes)
            .map_err(|e| format!("无法写入临时元数据: {e}"))?;
        file.sync_all()
            .map_err(|e| format!("无法同步临时元数据: {e}"))?;
        drop(file);

        if let Err(error) = fs::rename(&temp, path) {
            let _ = fs::remove_file(&temp);
            return Err(format!("无法提交元数据文件: {error}"));
        }
        Ok(())
    }

    fn copy_file_durably(source: &Path, target: &Path) -> Result<(), String> {
        let parent = target
            .parent()
            .ok_or_else(|| "无法确定目标目录".to_string())?;
        fs::create_dir_all(parent).map_err(|e| format!("无法创建目标目录: {e}"))?;
        let mut input =
            File::open(source).map_err(|e| format!("无法读取 {}: {e}", source.display()))?;
        let mut output =
            File::create(target).map_err(|e| format!("无法创建 {}: {e}", target.display()))?;
        std::io::copy(&mut input, &mut output)
            .map_err(|e| format!("无法复制 {}: {e}", source.display()))?;
        output
            .sync_all()
            .map_err(|e| format!("无法同步 {}: {e}", target.display()))?;
        Ok(())
    }

    fn sha256_file(path: &Path) -> Result<String, String> {
        let mut file = File::open(path).map_err(|e| format!("无法读取 {}: {e}", path.display()))?;
        let mut hasher = Sha256::new();
        let mut buffer = [0_u8; 128 * 1024];
        loop {
            let count = file
                .read(&mut buffer)
                .map_err(|e| format!("无法读取 {}: {e}", path.display()))?;
            if count == 0 {
                break;
            }
            hasher.update(&buffer[..count]);
        }
        Ok(hex::encode(hasher.finalize()))
    }

    fn hash_file_with_algorithm(path: &Path, algorithm: &str) -> Result<String, String> {
        if algorithm.eq_ignore_ascii_case("sha256") {
            return Self::sha256_file(path);
        }
        if algorithm.eq_ignore_ascii_case("sha1") {
            let mut file =
                File::open(path).map_err(|e| format!("无法读取 {}: {e}", path.display()))?;
            let mut hasher = sha1::Sha1::default();
            let mut buffer = [0_u8; 128 * 1024];
            loop {
                let count = file
                    .read(&mut buffer)
                    .map_err(|e| format!("无法读取 {}: {e}", path.display()))?;
                if count == 0 {
                    break;
                }
                Sha1Digest::update(&mut hasher, &buffer[..count]);
            }
            return Ok(hex::encode(Sha1Digest::finalize(hasher)));
        }
        Err(format!("不支持的快照哈希算法: {algorithm}"))
    }

    fn list_mod_files(mods_dir: &Path) -> Result<Vec<PathBuf>, String> {
        if !mods_dir.exists() {
            return Ok(Vec::new());
        }
        if !mods_dir.is_dir() {
            return Err(format!("mods 路径不是目录: {}", mods_dir.display()));
        }

        let mut files = Vec::new();
        for entry in fs::read_dir(mods_dir).map_err(|e| format!("无法读取 mods 目录: {e}"))? {
            let entry = entry.map_err(|e| format!("无法读取 mods 文件项: {e}"))?;
            if !entry.file_type().map_err(|e| e.to_string())?.is_file() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if Self::is_supported_mod_file(&name) {
                files.push(entry.path());
            }
        }
        files.sort_by_key(|path| {
            path.file_name()
                .map(|name| name.to_string_lossy().to_ascii_lowercase())
        });
        Ok(files)
    }

    fn snapshot_entries_by_name(
        snapshot: &InstanceSnapshot,
    ) -> Result<HashMap<String, ModEntry>, String> {
        let mut entries = HashMap::new();
        for entry in &snapshot.mods {
            Self::validate_snapshot_file_name(&entry.file_name)?;
            let key = entry.file_name.to_ascii_lowercase();
            if entries.insert(key.clone(), entry.clone()).is_some() {
                return Err(format!("快照包含重复文件名: {key}"));
            }
        }
        Ok(entries)
    }

    fn validate_snapshot_file_name(file_name: &str) -> Result<(), String> {
        let path = Path::new(file_name);
        if file_name.is_empty()
            || !Self::is_supported_mod_file(file_name)
            || path.components().count() != 1
            || !matches!(path.components().next(), Some(Component::Normal(_)))
        {
            return Err(format!("非法快照文件名: {file_name}"));
        }
        Ok(())
    }

    fn is_supported_mod_file(file_name: &str) -> bool {
        let lower = file_name.to_ascii_lowercase();
        lower.ends_with(".jar") || lower.ends_with(".jar.disabled")
    }

    fn file_name(path: &Path) -> Result<String, String> {
        path.file_name()
            .map(|name| name.to_string_lossy().to_string())
            .ok_or_else(|| format!("路径缺少文件名: {}", path.display()))
    }

    fn resolved_enabled_state(mod_entry: &ModEntry) -> bool {
        mod_entry.is_enabled.unwrap_or(
            !mod_entry
                .file_name
                .to_ascii_lowercase()
                .ends_with(".disabled"),
        )
    }

    fn parse_manifest_mod_id<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
    ) -> (Option<String>, Option<String>) {
        let Ok(root) = Self::get_instance_root(app, instance_id) else {
            return (None, None);
        };
        let manifest_path = root.join("mod_manifest.json");
        let Ok(content) = fs::read_to_string(&manifest_path) else {
            return (None, None);
        };
        let Ok(manifest) =
            serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
        else {
            return (None, None);
        };
        let base_name = file_name.trim_end_matches(".disabled");
        let Some(entry) = manifest.get(base_name) else {
            return (None, None);
        };
        let project_id = entry
            .pointer("/source/projectId")
            .and_then(|value| value.as_str())
            .map(ToString::to_string);
        let version = entry
            .pointer("/source/version")
            .and_then(|value| value.as_str())
            .map(ToString::to_string);
        (project_id, version)
    }

    fn emit_progress<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        current: usize,
        total: usize,
        phase: &str,
        file: &str,
        operation_id: &str,
    ) {
        let _ = app.emit(
            "snapshot-progress",
            SnapshotProgressEvent {
                instance_id: instance_id.to_string(),
                current,
                total,
                phase: phase.to_string(),
                file: file.to_string(),
                operation_id: operation_id.to_string(),
            },
        );
    }

    fn instance_lock(instance_id: &str) -> Result<Arc<Mutex<()>>, String> {
        let mut locks = INSTANCE_SNAPSHOT_LOCKS
            .lock()
            .map_err(|_| "快照锁注册表已损坏".to_string())?;
        Ok(locks
            .entry(instance_id.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone())
    }

    fn ensure_game_not_running() -> Result<(), String> {
        if crate::commands::launcher_cmd::CURRENT_GAME_PID.load(Ordering::SeqCst) != 0 {
            return Err("游戏正在运行，无法创建或回滚模组快照".to_string());
        }
        Ok(())
    }

    fn validate_instance_id(instance_id: &str) -> Result<(), String> {
        let path = Path::new(instance_id);
        if instance_id.trim().is_empty()
            || path.components().count() != 1
            || !matches!(path.components().next(), Some(Component::Normal(_)))
        {
            return Err("非法实例 ID".to_string());
        }
        Ok(())
    }
}

fn default_snapshot_schema_version() -> u32 {
    1
}

fn default_hash_algorithm() -> String {
    "sha1".to_string()
}

#[cfg(test)]
mod tests {
    use super::{ModSnapshotManager, RestoreJournal, RestoreStage, SNAPSHOT_SCHEMA_VERSION};
    use std::fs;
    use uuid::Uuid;

    #[test]
    fn only_accepts_mod_archives_and_disabled_archives() {
        assert!(ModSnapshotManager::is_supported_mod_file("example.jar"));
        assert!(ModSnapshotManager::is_supported_mod_file(
            "example.jar.disabled"
        ));
        assert!(!ModSnapshotManager::is_supported_mod_file("options.txt"));
        assert!(!ModSnapshotManager::is_supported_mod_file(
            "example.tmp_old"
        ));
    }

    #[test]
    fn rejects_snapshot_path_traversal() {
        assert!(ModSnapshotManager::validate_snapshot_file_name("safe.jar").is_ok());
        assert!(ModSnapshotManager::validate_snapshot_file_name("../unsafe.jar").is_err());
        assert!(ModSnapshotManager::validate_snapshot_file_name("nested/unsafe.jar").is_err());
    }

    #[test]
    fn durable_copy_preserves_sha256() {
        let root = std::env::temp_dir().join(format!("pilauncher-snapshot-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let source = root.join("source.jar");
        let target = root.join("nested").join("target.jar");
        fs::write(&source, b"snapshot content").unwrap();

        ModSnapshotManager::copy_file_durably(&source, &target).unwrap();
        assert_eq!(
            ModSnapshotManager::sha256_file(&source).unwrap(),
            ModSnapshotManager::sha256_file(&target).unwrap(),
        );
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn restore_journal_uses_the_latest_durable_stage() {
        let root = std::env::temp_dir().join(format!("pilauncher-journal-{}", Uuid::new_v4()));
        fs::create_dir_all(&root).unwrap();
        let mut journal = RestoreJournal {
            schema_version: SNAPSHOT_SCHEMA_VERSION,
            instance_id: "instance".to_string(),
            operation_id: "operation".to_string(),
            target_snapshot_id: "snapshot".to_string(),
            stage: RestoreStage::Prepared,
        };

        ModSnapshotManager::write_restore_journal(&root, &journal).unwrap();
        journal.stage = RestoreStage::Activated;
        ModSnapshotManager::write_restore_journal(&root, &journal).unwrap();

        let recovered = ModSnapshotManager::read_restore_journal(&root)
            .unwrap()
            .unwrap();
        assert_eq!(recovered.stage, RestoreStage::Activated);
        let _ = fs::remove_dir_all(root);
    }
}
