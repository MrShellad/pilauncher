use crate::services::config_service::ConfigService;
use crate::services::downloader::dependencies::scheduler::sha1_file;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ModEntry {
    pub hash: String,
    pub file_name: String,
    pub mod_id: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InstanceSnapshot {
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
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModUpdatePair {
    pub old: ModEntry,
    pub new: ModEntry,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotProgressEvent {
    pub current: usize,
    pub total: usize,
    pub phase: String,
    pub file: String,
}

pub struct ModSnapshotManager;

impl ModSnapshotManager {
    pub fn get_instance_root<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        Ok(PathBuf::from(base_path).join("instances").join(instance_id))
    }

    pub fn get_game_mods_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<PathBuf, String> {
        let instance_root = Self::get_instance_root(app, instance_id)?;
        let mut target_dir = instance_root.clone();
        let json_path = instance_root.join("instance.json");
        if let Ok(content) = fs::read_to_string(&json_path) {
            if let Ok(config) =
                serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
            {
                if let Some(tp) = config.third_party_path {
                    target_dir = PathBuf::from(tp);
                }
            }
        }
        let mods_dir = target_dir.join("mods");
        if !mods_dir.exists() {
            fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
        }
        Ok(mods_dir)
    }

    pub fn get_shared_mods_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        let shared_dir = PathBuf::from(base_path).join("shared_mods").join("mods");
        if !shared_dir.exists() {
            fs::create_dir_all(&shared_dir).map_err(|e| e.to_string())?;
        }
        Ok(shared_dir)
    }

    fn parse_manifest_mod_id(
        app: &AppHandle<impl Runtime>,
        instance_id: &str,
        file_name: &str,
    ) -> (Option<String>, Option<String>) {
        if let Ok(root) = Self::get_instance_root(app, instance_id) {
            let manifest_path = root.join("mod_manifest.json");
            if let Ok(content) = fs::read_to_string(&manifest_path) {
                if let Ok(manifest) =
                    serde_json::from_str::<serde_json::Map<String, serde_json::Value>>(&content)
                {
                    let base_name = file_name.trim_end_matches(".disabled");
                    if let Some(entry) = manifest.get(base_name) {
                        let project_id = entry
                            .pointer("/source/projectId")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        return (project_id, None); // version parsing logic can be added later if manifest contains it
                    }
                }
            }
        }
        (None, None)
    }

    pub async fn take_snapshot<R: Runtime>(
        app: AppHandle<R>,
        instance_id: String,
        trigger: String,
        message: String,
    ) -> Result<InstanceSnapshot, String> {
        let mods_dir = Self::get_game_mods_dir(&app, &instance_id)?;
        let shared_dir = Self::get_shared_mods_dir(&app)?;
        
        // Scan current items
        let mut target_files: Vec<PathBuf> = Vec::new();
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        target_files.push(entry.path());
                    }
                }
            }
        }

        let total = target_files.len();
        let mut mod_entries = Vec::new();

        app.emit(
            "snapshot-progress",
            SnapshotProgressEvent {
                current: 0,
                total,
                phase: "扫描文件...".to_string(),
                file: "".to_string(),
            },
        )
        .ok();

        for (i, path) in target_files.iter().enumerate() {
            let file_name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            app.emit(
                "snapshot-progress",
                SnapshotProgressEvent {
                    current: i,
                    total,
                    phase: format!("正在计算哈希 ({}/{})", i, total),
                    file: file_name.clone(),
                },
            )
            .ok();

            // Calculate Hash
            let hash = sha1_file(path).await.map_err(|e| e.to_string())?;
            let safe_hash = encode_safe_hash(&hash);
            
            // Check cross-instance cache
            let cached_path = shared_dir.join(format!("{}.jar", safe_hash));
            if !cached_path.exists() {
                // If not in cache, copy it to cache
                fs::copy(path, &cached_path).map_err(|e| format!("写入共享缓存失败: {}", e))?;
            }

            // Replace actual file with a hard link (if they are on the same mount point)
            // Or just leave it as is if hard link fails, but we should try hard link
            // For safety: rename original to temp, hard link cache to original, delete temp
            // Or we just don't touch the original if modifying running instance?
            // Actually, to realize "Zero-copy rollback", we DO need to hard link.
            let temp_ext = format!("{}.tmp_old", file_name);
            let temp_path = mods_dir.join(&temp_ext);
            fs::rename(path, &temp_path).ok();
            
            if let Err(_) = fs::hard_link(&cached_path, path) {
                // fallback to copy if hard link not supported between folders (cross-drive)
                fs::copy(&cached_path, path).map_err(|e| format!("链接文件失败: {}", e))?;
            }
            fs::remove_file(&temp_path).ok(); // cleanup

            let (mod_id, version) = Self::parse_manifest_mod_id(&app, &instance_id, &file_name);

            mod_entries.push(ModEntry {
                hash: safe_hash,
                file_name,
                mod_id,
                version,
            });
        }

        // Generate JSON
        let id = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let timestamp = chrono::Utc::now().timestamp_millis();
        let snapshot = InstanceSnapshot {
            id: id.clone(),
            timestamp,
            trigger,
            message,
            mods: mod_entries,
        };

        let snapshots_dir = Self::get_instance_root(&app, &instance_id)?
            .join("piconfig")
            .join("snapshots")
            .join("mods");
            
        fs::create_dir_all(&snapshots_dir).map_err(|e| e.to_string())?;

        let json_path = snapshots_dir.join(format!("{}.json", id));
        let serialized = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;
        fs::write(json_path, serialized).map_err(|e| e.to_string())?;

        app.emit(
            "snapshot-progress",
            SnapshotProgressEvent {
                current: total,
                total,
                phase: "完成".to_string(),
                file: "".to_string(),
            },
        )
        .ok();

        Ok(snapshot)
    }

    pub fn get_snapshot_history<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<InstanceSnapshot>, String> {
        let snapshots_dir = Self::get_instance_root(app, instance_id)?
            .join("piconfig")
            .join("snapshots")
            .join("mods");

        if !snapshots_dir.exists() {
            return Ok(Vec::new());
        }

        let mut history = Vec::new();
        if let Ok(entries) = fs::read_dir(&snapshots_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(snapshot) = serde_json::from_str::<InstanceSnapshot>(&content) {
                            history.push(snapshot);
                        }
                    }
                }
            }
        }

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
        
        let mut old_mods: HashMap<String, ModEntry> = HashMap::new();
        let mut new_mods: HashMap<String, ModEntry> = HashMap::new();

        if let Some(old_snap) = history.iter().find(|s| s.id == old_id) {
            for m in &old_snap.mods {
                old_mods.insert(m.file_name.clone(), m.clone());
            }
        }

        if let Some(new_snap) = history.iter().find(|s| s.id == new_id) {
            for m in &new_snap.mods {
                new_mods.insert(m.file_name.clone(), m.clone());
            }
        }

        let mut added = Vec::new();
        let mut removed = Vec::new();
        let mut updated = Vec::new();

        for (name, new_mod) in &new_mods {
            if let Some(old_mod) = old_mods.get(name) {
                if old_mod.hash != new_mod.hash {
                    updated.push(ModUpdatePair {
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
        })
    }

    pub fn rollback_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        snapshot_id: &str,
    ) -> Result<(), String> {
        let history = Self::get_snapshot_history(app, instance_id)?;
        let target_snap = history
            .iter()
            .find(|s| s.id == snapshot_id)
            .ok_or_else(|| "找不到指定的快照".to_string())?;

        let mods_dir = Self::get_game_mods_dir(app, instance_id)?;
        let shared_dir = Self::get_shared_mods_dir(app)?;

        let parent_dir = mods_dir.parent().unwrap();
        let temp_mods_dir = parent_dir.join(".mods_temp");

        if temp_mods_dir.exists() {
            fs::remove_dir_all(&temp_mods_dir).ok();
        }
        fs::create_dir_all(&temp_mods_dir).map_err(|e| format!("创建临时目录失败: {}", e))?;

        for mod_entry in &target_snap.mods {
            let cached_path = shared_dir.join(format!("{}.jar", mod_entry.hash));
            let target_path = temp_mods_dir.join(&mod_entry.file_name);

            if !cached_path.exists() {
                // If the cache somehow got corrupted/deleted
                return Err(format!("快照已损坏, 找不回依赖文件: {}", mod_entry.file_name));
            }

            if let Err(_) = fs::hard_link(&cached_path, &target_path) {
                fs::copy(&cached_path, &target_path)
                    .map_err(|e| format!("回退重建时遇到致命文件写入错误: {}", e))?;
            }
        }

        // Atomic swap
        let backup_cur_dir = parent_dir.join(".mods_backup_broken");
        fs::rename(&mods_dir, &backup_cur_dir).ok();
        
        match fs::rename(&temp_mods_dir, &mods_dir) {
            Ok(_) => {
                fs::remove_dir_all(&backup_cur_dir).ok();
            }
            Err(e) => {
                // Rollback the swap
                fs::rename(&backup_cur_dir, &mods_dir).ok();
                return Err(format!("无法最终执行目录映射覆盖: {}", e));
            }
        }

        Ok(())
    }
}

fn encode_safe_hash(hash: &str) -> String {
    hash.trim().to_lowercase()
}
