// src-tauri/src/services/instance/resource_manager.rs
use crate::services::config_service::ConfigService;
use chrono::Local;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

// 1. 定义资源类型枚举，自动映射到真实的文件夹名称
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum ResourceType {
    Mod,
    Save,
    Shader,
    ResourcePack,
}

impl ResourceType {
    pub fn folder_name(&self) -> &'static str {
        match self {
            ResourceType::Mod => "mods",
            ResourceType::Save => "saves",
            ResourceType::Shader => "shaderpacks",
            ResourceType::ResourcePack => "resourcepacks",
        }
    }
}

// 2. 统一的资源基础信息模型
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ResourceItem {
    pub file_name: String,
    pub is_enabled: bool,   // 是否启用（没有 .disabled 后缀）
    pub is_directory: bool, // 比如存档就是目录
    pub file_size: u64,
    pub modified_at: i64, // 时间戳
    // icon 绝对路径（由哨兵提取后填入）
    pub icon_absolute_path: Option<String>,
    // 这里保留一个扩展字段，留给后续解析 jar 或 level.dat 时塞入专属数据
    pub meta: Option<serde_json::Value>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ResourceSnapshot {
    pub id: String,
    pub timestamp: String,
    pub item_count: usize,
    pub description: String,
}

pub struct ResourceManager;

impl ResourceManager {
    fn get_target_dir<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: &ResourceType,
    ) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        let target_dir = PathBuf::from(base_path)
            .join("instances")
            .join(instance_id)
            .join(res_type.folder_name());

        // 确保目录存在
        if !target_dir.exists() {
            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        }
        Ok(target_dir)
    }

    // ================= 核心操作 1：获取资源列表 =================
    pub fn list_resources<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
    ) -> Result<Vec<ResourceItem>, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let mut items = Vec::new();

        if let Ok(entries) = fs::read_dir(&target_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let file_name = entry.file_name().to_string_lossy().to_string();

                // 忽略隐藏文件
                if file_name.starts_with('.') {
                    continue;
                }

                let is_disabled = file_name.ends_with(".disabled");
                let metadata = entry.metadata().unwrap();

                // TODO: 在这里可以根据 res_type，调用专门的解析逻辑 (比如 ModManager::parse_jar) 将结果塞入 meta

                items.push(ResourceItem {
                    file_name,
                    is_enabled: !is_disabled,
                    is_directory: metadata.is_dir(),
                    file_size: metadata.len(),
                    modified_at: metadata
                        .modified()
                        .unwrap()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64,
                    icon_absolute_path: None,
                    meta: None,
                });
            }
        }

        // 按照修改时间倒序排列
        items.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
        Ok(items)
    }

    // ================= 核心操作 2：启用/禁用 (无损重命名) =================
    pub fn toggle_resource<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        file_name: &str,
        enable: bool,
    ) -> Result<(), String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let current_path = target_dir.join(file_name);

        if !current_path.exists() {
            return Err("文件不存在".to_string());
        }

        let new_file_name = if enable {
            file_name.trim_end_matches(".disabled").to_string()
        } else {
            if file_name.ends_with(".disabled") {
                return Ok(());
            }
            format!("{}.disabled", file_name)
        };

        let new_path = target_dir.join(new_file_name);
        fs::rename(current_path, new_path).map_err(|e| format!("切换状态失败: {}", e))?;
        Ok(())
    }

    // ================= 核心操作 3：删除资源 =================
    pub fn delete_resource<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        file_name: &str,
    ) -> Result<(), String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;
        let current_path = target_dir.join(file_name);

        if current_path.exists() {
            if current_path.is_dir() {
                fs::remove_dir_all(current_path).map_err(|e| e.to_string())?;
            } else {
                fs::remove_file(current_path).map_err(|e| e.to_string())?;
            }
        }

        // 检测，如果删除的是 Mod，就在相应的 mod_manifest.json 取消注册
        if res_type == ResourceType::Mod {
            if let Some(instance_dir) = target_dir.parent() {
                let manifest_path = instance_dir.join("mod_manifest.json");
                if manifest_path.exists() {
                    if let Ok(content) = fs::read_to_string(&manifest_path) {
                        if let Ok(mut manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                            if let Some(obj) = manifest.as_object_mut() {
                                let base_name = file_name.trim_end_matches(".disabled");
                                if obj.remove(base_name).is_some() {
                                    let _ = fs::write(&manifest_path, serde_json::to_string_pretty(&obj).unwrap_or_default());
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(())
    }

    // ================= 核心操作 4：统一快照系统 =================
    pub fn create_snapshot<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        res_type: ResourceType,
        desc: &str,
    ) -> Result<ResourceSnapshot, String> {
        let target_dir = Self::get_target_dir(app, instance_id, &res_type)?;

        // 快照存放在实例级的 piconfig/snapshots/资源类型/ 目录下
        let base_path = ConfigService::get_base_path(app).unwrap().unwrap();
        let snapshots_dir = PathBuf::from(base_path)
            .join("instances")
            .join(instance_id)
            .join("piconfig")
            .join("snapshots")
            .join(res_type.folder_name());

        let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
        let snapshot_path = snapshots_dir.join(&timestamp);
        fs::create_dir_all(&snapshot_path).map_err(|e| e.to_string())?;

        let mut count = 0;
        if target_dir.exists() {
            // 利用简单的文件级遍历进行拷贝（生产环境可用 crate: fs_extra）
            for entry in fs::read_dir(&target_dir).unwrap().filter_map(|e| e.ok()) {
                if entry.path().is_file() {
                    fs::copy(entry.path(), snapshot_path.join(entry.file_name())).ok();
                    count += 1;
                } else {
                    // 对于存档(目录)，需要递归拷贝处理
                    // 这里为了演示暂作简化，可以引入 dircpy 等库完美处理目录快照
                }
            }
        }

        Ok(ResourceSnapshot {
            id: timestamp.clone(),
            timestamp: Local::now().to_string(),
            item_count: count,
            description: desc.to_string(),
        })
    }

    // ================= 核心操作 5：手动下载时的 Manifest 同步 =================
    pub fn update_mod_manifest<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        platform: &str,
        project_id: &str,
        file_id: &str,
    ) -> Result<(), String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        let manifest_path = std::path::PathBuf::from(base_path)
            .join("instances")
            .join(instance_id)
            .join("mod_manifest.json");

        let mut manifest = if manifest_path.exists() {
            let content = fs::read_to_string(&manifest_path).unwrap_or_default();
            serde_json::from_str::<serde_json::Value>(&content)
                .unwrap_or_else(|_| serde_json::json!({}))
        } else {
            serde_json::json!({})
        };

        if let Some(obj) = manifest.as_object_mut() {
            let base_name = file_name.trim_end_matches(".disabled").to_string();
            obj.insert(
                base_name,
                serde_json::json!({
                    "platform": platform,
                    "projectId": project_id,
                    "fileId": file_id
                }),
            );
        }

        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).unwrap_or_default(),
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }
}
