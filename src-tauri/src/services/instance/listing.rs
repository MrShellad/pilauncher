// src-tauri/src/services/instance/listing.rs
use crate::domain::instance::{InstanceConfig, InstanceItem};
use crate::error::AppResult;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

pub struct InstanceListingService;

impl InstanceListingService {
    /// 获取全部实例
    pub fn get_all<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "尚未配置基础数据目录")
            })?;

        let base_dir = PathBuf::from(base_path_str);

        let instances_dir = base_dir.join("instances");
        if !instances_dir.exists() {
            return Ok(vec![]);
        }

        let mut list = Vec::new();
        for entry in fs::read_dir(instances_dir)? {
            let path = entry?.path();
            if path.is_dir() {
                let id = path.file_name().unwrap().to_string_lossy().to_string();

                let manifest_path = path.join("instance.json");
                if let Ok(content) = fs::read_to_string(manifest_path) {
                    if let Ok(m) = serde_json::from_str::<InstanceConfig>(&content) {
                        list.push(InstanceItem {
                            id,
                            name: m.name,
                            version: m.mc_version,
                            loader: m.loader.r#type,
                            play_time: m.play_time,
                            last_played: m.last_played,
                            cover_path: Self::resolve_cover(&path),
                            gamepad: m.gamepad,
                            tags: m.tags.clone(),
                            is_favorite: m.is_favorite,
                            created_at: m.created_at,
                        });
                    }
                }
            }
        }
        Ok(list)
    }

    /// 获取与指定游戏版本和引导器兼容的实例
    pub fn get_compatible<R: Runtime>(
        app: &AppHandle<R>,
        game_versions: Vec<String>,
        loaders: Vec<String>,
        ignore_loader: bool,
    ) -> AppResult<Vec<InstanceItem>> {
        let all_instances = Self::get_all(app)?;

        let filtered = all_instances
            .into_iter()
            .filter(|inst| {
                let inst_gv = &inst.version;
                let inst_loader = inst.loader.to_lowercase();

                // 游戏版本必须匹配
                let matches_gv = game_versions.contains(inst_gv);

                // 如果是 ignore_loader (光影/资源包)，或者 Mod 本身不限 Loader，或者匹配成功
                let matches_loader = ignore_loader
                    || loaders.is_empty()
                    || loaders.iter().any(|l| l.to_lowercase() == inst_loader);

                matches_gv && matches_loader
            })
            .collect();

        Ok(filtered)
    }

    /// 解析实例封面图路径
    fn resolve_cover(root: &Path) -> Option<String> {
        let extensions = ["png", "jpg", "jpeg", "webp"];

        // 1. 尝试读取本启动器专属的 piconfig/cover.*
        let piconfig = root.join("piconfig");
        for ext in extensions {
            let cover_file = piconfig.join(format!("cover.{}", ext));
            if cover_file.exists() {
                return Some(cover_file.to_string_lossy().to_string());
            }
        }

        // 2. ✅ 新增 Fallback：尝试读取实例根目录下的 instance.* (完美兼容外部导入的整合包)
        for ext in extensions {
            let instance_file = root.join(format!("instance.{}", ext));
            if instance_file.exists() {
                return Some(instance_file.to_string_lossy().to_string());
            }
        }

        // 3. 最后 Fallback：尝试获取截图目录下的第一张图片
        let screen_dir = root.join("screenshots");
        if let Ok(mut entries) = fs::read_dir(screen_dir) {
            if let Some(Ok(e)) = entries.next() {
                return Some(e.path().to_string_lossy().to_string());
            }
        }

        None
    }
}
