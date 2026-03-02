// src-tauri/src/services/instance/listing.rs
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use crate::domain::instance::{InstanceItem, InstanceConfig};
use crate::error::AppResult;

pub struct InstanceListingService;

impl InstanceListingService {
    /// 获取全部实例
    pub fn get_all<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "尚未配置基础数据目录"))?;
            
        let base_dir = PathBuf::from(base_path_str);
        
        let instances_dir = base_dir.join("instances");
        if !instances_dir.exists() { return Ok(vec![]); }

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
        loaders: Vec<String>
    ) -> AppResult<Vec<InstanceItem>> {
        // 先获取所有实例
        let all_instances = Self::get_all(app)?;
        
        // 执行精准过滤
        let filtered = all_instances.into_iter().filter(|inst| {
            let inst_gv = &inst.version;
            let inst_loader = inst.loader.to_lowercase();
            
            // 判断当前实例的游戏版本是否在 Mod 支持的列表中
            let matches_gv = game_versions.contains(inst_gv);
            
            // 判断当前实例的引导器是否在 Mod 支持的列表中
            let matches_loader = loaders.iter().any(|l| l.to_lowercase() == inst_loader);
            
            matches_gv && matches_loader
        }).collect();

        Ok(filtered)
    }

    fn resolve_cover(root: &Path) -> Option<String> {
        let piconfig = root.join("piconfig");
        
        let extensions = ["png", "jpg", "jpeg", "webp"];
        for ext in extensions {
            let cover_file = piconfig.join(format!("cover.{}", ext));
            if cover_file.exists() {
                return Some(cover_file.to_string_lossy().to_string());
            }
        }
        
        let screen_dir = root.join("screenshots");
        if let Ok(mut entries) = fs::read_dir(screen_dir) {
            if let Some(Ok(e)) = entries.next() {
                return Some(e.path().to_string_lossy().to_string());
            }
        }
        None
    }
}