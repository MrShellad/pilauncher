// src-tauri/src/services/instance/listing.rs
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, Runtime};
use crate::domain::instance::{InstanceItem, InstanceConfig};
use crate::error::AppResult;

pub struct InstanceListingService;

impl InstanceListingService {
    pub fn get_all<R: Runtime>(app: &AppHandle<R>) -> AppResult<Vec<InstanceItem>> {
        // 注意：这里你原本写死了 app_data_dir()，如果用户的 save_path 是自定义的，
        // 你可能需要从全局设置里读取根目录。这里暂且保持你原有的读取逻辑。
        let instances_dir = app.path().app_data_dir()?.join("instances");
        if !instances_dir.exists() { return Ok(vec![]); }

        let mut list = Vec::new();
        for entry in fs::read_dir(instances_dir)? {
            let path = entry?.path();
            if path.is_dir() {
                let id = path.file_name().unwrap().to_string_lossy().to_string();
                
                let manifest_path = path.join("instance.json");
                if let Ok(content) = fs::read_to_string(manifest_path) {
                    // 解析新的 InstanceConfig
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

    fn resolve_cover(root: &Path) -> Option<String> {
        let piconfig = root.join("piconfig");
        
        // 支持多种图片后缀
        let extensions = ["png", "jpg", "jpeg", "webp"];
        for ext in extensions {
            let cover_file = piconfig.join(format!("cover.{}", ext));
            if cover_file.exists() {
                return Some(cover_file.to_string_lossy().to_string());
            }
        }
        
        // 降级方案：找截图
        let screen_dir = root.join("screenshots");
        if let Ok(mut entries) = fs::read_dir(screen_dir) {
            if let Some(Ok(e)) = entries.next() {
                return Some(e.path().to_string_lossy().to_string());
            }
        }
        None
    }
}