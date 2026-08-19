use crate::domain::gamepad::{GamepadModMeta, GamepadModStatus};
use std::collections::HashMap;
use std::fs;
use std::path::{PathBuf};
use tauri::{AppHandle, Runtime};

pub struct GamepadManager;

impl GamepadManager {
    pub fn check_and_update_gamepad<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<bool, String> {
        let instance_dir = super::ModManagerService::get_instance_dir(app, instance_id)?;
        let config_path = instance_dir.join("instance.json");

        let mut game_dir = instance_dir.clone();
        let mut config: Option<crate::domain::instance::InstanceConfig> = None;
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(cfg) =
                    serde_json::from_str::<crate::domain::instance::InstanceConfig>(&content)
                {
                    if let Some(ref tp) = cfg.third_party_path {
                        game_dir = PathBuf::from(tp);
                    }
                    config = Some(cfg);
                }
            }
        }
        let mods_dir = game_dir.join("mods");

        let mut has_gamepad = false;
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_lowercase();
                    // 仅判断启用的 mod (.jar)
                    if file_name.ends_with(".jar") && !file_name.ends_with(".disabled") {
                        if file_name.contains("controllable")
                            || file_name.contains("midnightcontrols")
                            || file_name.contains("controlify")
                        {
                            has_gamepad = true;
                            break;
                        }
                    }
                }
            }
        }

        // 保存检测结果回 instance.json
        if let Some(mut cfg) = config {
            cfg.gamepad = Some(has_gamepad);
            if let Ok(new_content) = serde_json::to_string_pretty(&cfg) {
                let _ = fs::write(&config_path, new_content);
            }
        }

        Ok(has_gamepad)
    }

    pub fn read_gamepad_meta<R: Runtime>(
        app: &AppHandle<R>,
    ) -> Result<HashMap<String, GamepadModMeta>, String> {
        let shared_dir = super::icon_storage::IconStorage::get_shared_mods_dir(app)?;
        let meta_path = shared_dir.join("gamepad_meta.json");
        if meta_path.exists() {
            let content = fs::read_to_string(&meta_path).unwrap_or_default();
            Ok(serde_json::from_str(&content).unwrap_or_default())
        } else {
            Ok(HashMap::new())
        }
    }

    pub fn write_gamepad_meta<R: Runtime>(
        app: &AppHandle<R>,
        meta: &HashMap<String, GamepadModMeta>,
    ) -> Result<(), String> {
        let shared_dir = super::icon_storage::IconStorage::get_shared_mods_dir(app)?;
        let meta_path = shared_dir.join("gamepad_meta.json");
        let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
        fs::write(&meta_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    pub async fn check_gamepad_mod_status<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<GamepadModStatus, String> {
        // 1. 检查实例 mods/ 中是否已安装手柄 mod
        let installed = Self::check_and_update_gamepad(app, instance_id)?;

        if installed {
            return Ok(GamepadModStatus {
                installed: true,
                needs_install: false,
                needs_update: false,
                local_file_name: None,
                remote_file_name: None,
                has_cache: false,
            });
        }

        // 2. 检查 shared_mods 缓存
        let meta = Self::read_gamepad_meta(app)?;
        let loader_key = loader_type.to_lowercase();
        let cache_key = format!("{}_{}", mc_version, loader_key);
        let cached = meta.get(&cache_key);
        let has_cache = cached.map_or(false, |c| {
            let shared_dir = super::icon_storage::IconStorage::get_shared_mods_dir(app).unwrap_or_default();
            shared_dir.join(&c.file_name).exists()
        });

        let local_fn = cached.map(|c| c.file_name.clone());

        Ok(GamepadModStatus {
            installed: false,
            needs_install: !has_cache,
            needs_update: false, // 更新检测由前端通过 API 比对完成
            local_file_name: local_fn,
            remote_file_name: None,
            has_cache,
        })
    }
}
