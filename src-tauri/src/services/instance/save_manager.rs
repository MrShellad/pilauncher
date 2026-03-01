// src-tauri/src/services/instance/save_manager.rs
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use crate::services::config_service::ConfigService;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::Local;

// ================= 模型定义 =================

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModSignature {
    pub file_name: String,
    pub signature: String, // 文件大小 + 修改时间构成的快速 Hash
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveBackupMetadata {
    pub uuid: String,
    pub world_name: String,
    pub instance_id: String,
    pub instance_name: String, // TODO: 实际应用中需从实例配置读取
    pub mc_version: String,
    pub loader_version: String,
    pub backup_time: i64,
    pub original_created_time: i64,
    pub original_last_played_time: i64,
    pub size_bytes: u64,
    pub mods_state: Vec<ModSignature>, 
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveItem {
    pub folder_name: String,
    pub world_name: String, // 后续可深入解析 level.dat，目前暂用文件夹名
    pub size_bytes: u64,
    pub last_played_time: i64,
    pub created_time: i64,
}

pub struct SaveManagerService;

impl SaveManagerService {
    // 基础路径获取
    fn get_instance_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let base = ConfigService::get_base_path(app).unwrap().unwrap();
        Ok(PathBuf::from(base).join("instances").join(id))
    }

    fn get_backups_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base = ConfigService::get_base_path(app).unwrap().unwrap();
        Ok(PathBuf::from(base).join("backups").join("saves"))
    }

    fn get_trash_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base = ConfigService::get_base_path(app).unwrap().unwrap();
        Ok(PathBuf::from(base).join("backups").join("trash").join("saves"))
    }

    // 辅助：递归计算文件夹大小
    fn get_dir_size(path: impl AsRef<Path>) -> u64 {
        let mut size = 0;
        if let Ok(entries) = fs::read_dir(path) {
            for entry in entries.filter_map(|e| e.ok()) {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_dir() { size += Self::get_dir_size(entry.path()); } 
                    else { size += meta.len(); }
                }
            }
        }
        size
    }

    // 辅助：零依赖递归拷贝文件夹
    fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
        fs::create_dir_all(&dst)?;
        for entry in fs::read_dir(src)? {
            let entry = entry?;
            let ty = entry.file_type()?;
            if ty.is_dir() { Self::copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?; } 
            else { fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?; }
        }
        Ok(())
    }

    // 辅助：生成当前实例的 Mod 快速签名列表
    fn generate_mods_signature(mods_dir: &Path) -> Vec<ModSignature> {
        let mut sigs = Vec::new();
        if let Ok(entries) = fs::read_dir(mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                    if file_name.ends_with(".jar") || file_name.ends_with(".jar.disabled") {
                        let meta = entry.metadata().unwrap();
                        let size = meta.len();
                        let modified = meta.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();
                        // 签名算法：文件名 + 大小 + 修改时间戳，极速且高精度
                        let signature = format!("{:x}_{:x}", size, modified);
                        sigs.push(ModSignature { file_name, signature });
                    }
                }
            }
        }
        sigs
    }

    // ================= 核心操作 1：获取存档列表 =================
    pub fn get_saves<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<Vec<SaveItem>, String> {
        let saves_dir = Self::get_instance_dir(app, instance_id)?.join("saves");
        fs::create_dir_all(&saves_dir).ok();

        let mut saves = Vec::new();
        if let Ok(entries) = fs::read_dir(&saves_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                if entry.file_type().unwrap().is_dir() {
                    let meta = entry.metadata().unwrap();
                    let folder_name = entry.file_name().to_string_lossy().to_string();
                    
                    saves.push(SaveItem {
                        world_name: folder_name.clone(), // 预留：这里以后可以加入 NBT 解析读取 level.dat 的 LevelName
                        folder_name,
                        size_bytes: Self::get_dir_size(entry.path()),
                        last_played_time: meta.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
                        created_time: meta.created().unwrap_or(meta.modified().unwrap()).duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
                    });
                }
            }
        }
        saves.sort_by(|a, b| b.last_played_time.cmp(&a.last_played_time));
        Ok(saves)
    }

    // ================= 核心操作 2：备份存档与生成元数据 =================
    pub fn backup_save<R: Runtime>(app: &AppHandle<R>, instance_id: &str, folder_name: &str) -> Result<SaveBackupMetadata, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let src_save_dir = instance_dir.join("saves").join(folder_name);
        
        if !src_save_dir.exists() { return Err("存档不存在".to_string()); }

        let uuid = Uuid::new_v4().to_string();
        let backups_dir = Self::get_backups_dir(app)?;
        let target_backup_dir = backups_dir.join(&uuid);
        
        // 1. 拷贝存档文件夹
        let save_content_dir = target_backup_dir.join("save_data");
        Self::copy_dir_all(&src_save_dir, &save_content_dir).map_err(|e| format!("拷贝失败: {}", e))?;

        // 2. 获取实例数据与 Mod 签名
        let mods_dir = instance_dir.join("mods");
        let mods_state = Self::generate_mods_signature(&mods_dir);
        let src_meta = fs::metadata(&src_save_dir).unwrap();

        // 3. 构建元数据
        let meta = SaveBackupMetadata {
            uuid: uuid.clone(),
            world_name: folder_name.to_string(),
            instance_id: instance_id.to_string(),
            instance_name: "未知实例".to_string(), // 后续通过 instance.json 获取
            mc_version: "1.20+".to_string(),     // 同上
            loader_version: "Fabric/Forge".to_string(),
            backup_time: Local::now().timestamp(),
            original_created_time: src_meta.created().unwrap_or(src_meta.modified().unwrap()).duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
            original_last_played_time: src_meta.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64,
            size_bytes: Self::get_dir_size(&save_content_dir),
            mods_state,
        };

        // 4. 写入 backup_meta.json
        let meta_json = serde_json::to_string_pretty(&meta).unwrap();
        fs::write(target_backup_dir.join("backup_meta.json"), meta_json).unwrap();

        Ok(meta)
    }

    // ================= 核心操作 3：删除存档（支持进入回收站） =================
    pub fn delete_save<R: Runtime>(app: &AppHandle<R>, instance_id: &str, folder_name: &str, direct_delete: bool) -> Result<(), String> {
        let src_save_dir = Self::get_instance_dir(app, instance_id)?.join("saves").join(folder_name);
        if !src_save_dir.exists() { return Ok(()); }

        if direct_delete {
            fs::remove_dir_all(&src_save_dir).map_err(|e| e.to_string())?;
        } else {
            // 移入回收站
            let trash_dir = Self::get_trash_dir(app)?;
            fs::create_dir_all(&trash_dir).ok();
            let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
            let trash_target = trash_dir.join(format!("{}_{}", folder_name, timestamp));
            
            // 尝试重命名(移动)，如果跨盘则退化为拷贝后删除
            if fs::rename(&src_save_dir, &trash_target).is_err() {
                Self::copy_dir_all(&src_save_dir, &trash_target).map_err(|e| e.to_string())?;
                fs::remove_dir_all(&src_save_dir).map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }

    // ================= 核心操作 4：恢复存档 (预检查) =================
    // 此接口先不直接覆盖，而是返回校验结果供前端提示用户
    pub fn verify_restore<R: Runtime>(app: &AppHandle<R>, instance_id: &str, backup_uuid: &str) -> Result<Vec<String>, String> {
        let backup_dir = Self::get_backups_dir(app)?.join(backup_uuid);
        let meta_file = backup_dir.join("backup_meta.json");
        
        if !meta_file.exists() { return Err("备份元数据丢失".to_string()); }
        
        let meta_content = fs::read_to_string(meta_file).unwrap();
        let backup_meta: SaveBackupMetadata = serde_json::from_str(&meta_content).map_err(|e| e.to_string())?;
        
        let current_mods_dir = Self::get_instance_dir(app, instance_id)?.join("mods");
        let current_sigs = Self::generate_mods_signature(&current_mods_dir);
        
        let mut missing_or_changed = Vec::new();
        
        // 交叉比对寻找缺失或哈希对不上的 Mod
        for backup_mod in backup_meta.mods_state {
            let found = current_sigs.iter().find(|c| c.file_name == backup_mod.file_name);
            match found {
                None => missing_or_changed.push(format!("缺失模组: {}", backup_mod.file_name)),
                Some(current) if current.signature != backup_mod.signature => {
                    missing_or_changed.push(format!("模组发生变动: {}", backup_mod.file_name));
                }
                _ => {} // 完全一致
            }
        }
        
        Ok(missing_or_changed) // 前端拿到如果为空数组，说明完美匹配，直接执行真·恢复指令
    }

    // ================= 核心操作 5：获取当前实例的历史备份 =================
    pub fn get_backups<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<Vec<SaveBackupMetadata>, String> {
        let backups_dir = Self::get_backups_dir(app)?;
        let mut backups = Vec::new();

        if let Ok(entries) = fs::read_dir(backups_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_dir() {
                    let meta_file = path.join("backup_meta.json");
                    if meta_file.exists() {
                        if let Ok(content) = fs::read_to_string(&meta_file) {
                            if let Ok(meta) = serde_json::from_str::<SaveBackupMetadata>(&content) {
                                // 过滤出属于当前实例的备份
                                if meta.instance_id == instance_id {
                                    backups.push(meta);
                                }
                            }
                        }
                    }
                }
            }
        }
        // 按备份时间倒序排列（最新的在最上面）
        backups.sort_by(|a, b| b.backup_time.cmp(&a.backup_time));
        Ok(backups)
    }
}