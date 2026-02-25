// src-tauri/src/services/instance/creation.rs
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Local;

// 注意这里移除了 Manager，因为路径获取交给了 ConfigService
use tauri::{AppHandle, Emitter, Runtime}; 

use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig
};
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;

pub struct InstanceCreationService;

impl InstanceCreationService {
    pub async fn create<R: Runtime>(app: &AppHandle<R>, payload: CreateInstancePayload) -> AppResult<()> {
        
        // ✅ 1. 动态获取基础目录 (由 SetupWizard 配置的 PiLauncher 根目录)
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "尚未配置基础数据目录"))?; 
        let base_dir = PathBuf::from(base_path_str);

        // 我们统一使用 folder_name 作为实例的唯一标识 ID
        let instance_id = payload.folder_name.clone(); 

        // ✅ 2. 强制将实例生成在 PiLauncher/instances/ 目录下
        let instance_root = base_dir.join("instances").join(&instance_id);

        let sub_dirs = ["mods", "config", "saves", "resourcepacks", "screenshots", "piconfig"];
        for dir in sub_dirs {
            fs::create_dir_all(instance_root.join(dir))?;
        }

        let piconfig_dir = instance_root.join("piconfig");
        if let Some(cover_path_str) = &payload.cover_image {
            let cover_path = Path::new(cover_path_str);
            if cover_path.exists() {
                let ext = cover_path.extension().unwrap_or_default();
                let _ = fs::copy(cover_path, piconfig_dir.join(format!("cover.{}", ext.to_string_lossy())));
            }
        }

        let config = InstanceConfig {
            id: instance_id.clone(),
            name: if payload.name.is_empty() { payload.folder_name.clone() } else { payload.name.clone() },
            mc_version: payload.game_version.clone(),
            loader: LoaderConfig {
                r#type: payload.loader_type.to_lowercase(),
                version: payload.loader_version.clone().unwrap_or_default(),
            },
            java: JavaConfig { path: "auto".to_string(), version: "auto".to_string() },
            memory: MemoryConfig { min: 1024, max: 4096 },
            resolution: ResolutionConfig { width: 1280, height: 720 },
            play_time: 0.0,
            last_played: "从未游玩".to_string(),
            created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        };
        fs::write(instance_root.join("instance.json"), serde_json::to_string_pretty(&config)?)?;

        // ✅ 3. 将全局核心缓存强制指向 PiLauncher/runtime/
        let global_mc_root = base_dir.join("runtime");
        
        // 虽然 ConfigService 初始化时建过，但做个兜底创建更安全
        fs::create_dir_all(global_mc_root.join("assets"))?;
        fs::create_dir_all(global_mc_root.join("libraries"))?;
        fs::create_dir_all(global_mc_root.join("versions"))?;

        // 发送事件 (保持不变)
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("正在准备部署 Minecraft {}...", payload.game_version),
        });

        // 传递修改后的 global_mc_root 给底层下载器
        crate::services::downloader::core_installer::install_vanilla_core(
            app, 
            &instance_id,
            &payload.game_version, 
            &global_mc_root
        ).await?;

        crate::services::downloader::dependencies::download_dependencies(
            app,
            &instance_id,
            &payload.game_version,
            &global_mc_root
        ).await?;

        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "实例创建成功！".to_string(),
        });

        Ok(())
    }
}