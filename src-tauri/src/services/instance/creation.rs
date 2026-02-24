// src-tauri/src/services/instance/creation.rs
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Local;

use tauri::{AppHandle, Emitter, Manager, Runtime}; 

use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig
};
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;

pub struct InstanceCreationService;

impl InstanceCreationService {
    // ✅ 修复：加上 async 关键字，并接收带泛型的 app 句柄
    pub async fn create<R: Runtime>(app: &AppHandle<R>, payload: CreateInstancePayload) -> AppResult<()> {
        // ==========================================
        // 第一阶段：构建目录结构
        // ==========================================
        let instance_root = PathBuf::from(&payload.save_path).join(&payload.folder_name);
        
        // 1. 创建实例私有目录
        let sub_dirs = ["mods", "config", "saves", "resourcepacks", "screenshots", "piconfig"];
        for dir in sub_dirs {
            fs::create_dir_all(instance_root.join(dir))?;
        }

        // 2. 处理封面
        let piconfig_dir = instance_root.join("piconfig");
        if let Some(cover_path_str) = &payload.cover_image {
            let cover_path = Path::new(cover_path_str);
            if cover_path.exists() {
                let ext = cover_path.extension().unwrap_or_default();
                let _ = fs::copy(cover_path, piconfig_dir.join(format!("cover.{}", ext.to_string_lossy())));
            }
        }

        // 3. 写入 instance.json
        let config = InstanceConfig {
            id: payload.folder_name.clone(),
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

        // ==========================================
        // 第二阶段：构建全局共享库并准备下载
        // ==========================================
        let global_mc_root = app.path().app_data_dir()?.join("global").join(".minecraft");
        fs::create_dir_all(global_mc_root.join("assets"))?;
        fs::create_dir_all(global_mc_root.join("libraries"))?;
        fs::create_dir_all(global_mc_root.join("versions"))?;

        // 发送部署开始事件
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("正在准备部署 Minecraft {}...", payload.game_version),
        });

        // 核心下载
        crate::services::downloader::core_installer::install_vanilla_core(
            app, 
            &payload.game_version, 
            &global_mc_root
        ).await?;

        // 依赖与资产下载
        crate::services::downloader::dependencies::download_dependencies(
            app,
            &payload.game_version,
            &global_mc_root
        ).await?;

        // 发送完成事件
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "实例创建成功！".to_string(),
        });

        Ok(())
    }
}