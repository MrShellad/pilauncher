// src-tauri/src/services/instance/creation.rs
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Local;
use tauri::{AppHandle, Emitter, Manager};
use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig
};
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;

pub struct InstanceCreationService;

impl InstanceCreationService {
    pub fn create(payload: CreateInstancePayload) -> AppResult<()> {
        let root = PathBuf::from(&payload.save_path).join(&payload.folder_name);
        
        // 1. 创建更完善的隔离目录结构 (整合了你原有的逻辑)
        let sub_dirs = ["mods", "config", "saves", "resourcepacks", "screenshots", "piconfig"];
        for dir in sub_dirs {
            fs::create_dir_all(root.join(dir))?;
        }

        // 2. 处理封面复制
        let piconfig_dir = root.join("piconfig");
        if let Some(cover_path_str) = payload.cover_image {
            let cover_path = Path::new(&cover_path_str);
            if cover_path.exists() {
                let ext = cover_path.extension().unwrap_or_default();
                let target_cover_path = piconfig_dir.join(format!("cover.{}", ext.to_string_lossy()));
                let _ = fs::copy(cover_path, target_cover_path);
            }
        }

        // 3. 组装符合新格式的 instance.json
        let config = InstanceConfig {
            id: payload.folder_name.clone(),
            name: if payload.name.is_empty() { payload.folder_name.clone() } else { payload.name },
            mc_version: payload.game_version.clone(),
            loader: LoaderConfig {
                r#type: payload.loader_type.to_lowercase(),
                version: payload.loader_version.unwrap_or_else(|| "".to_string()),
            },
            java: JavaConfig {
                path: "auto".to_string(), 
                version: "auto".to_string(),
            },
            memory: MemoryConfig { min: 1024, max: 4096 },
            resolution: ResolutionConfig { width: 1280, height: 720 },
            play_time: 0.0,
            last_played: "从未游玩".to_string(),
            created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        };

        // 4. 写入文件
        let config_json = serde_json::to_string_pretty(&config)?;
        fs::write(root.join("instance.json"), config_json)?;
        // ==========================================
        // 第二阶段：构建全局共享库并准备下载
        // ==========================================
        // 获取全局 .minecraft 路径 (例如: C:\Users\xxx\AppData\Roaming\com.ore.launcher\global\.minecraft)
        let global_mc_root = app.path().app_data_dir()?.join("global").join(".minecraft");
        fs::create_dir_all(global_mc_root.join("assets"))?;
        fs::create_dir_all(global_mc_root.join("libraries"))?;
        fs::create_dir_all(global_mc_root.join("versions"))?;

        // 通知前端开始部署核心
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("正在准备部署 Minecraft {}...", payload.game_version),
        });

        // 核心下载模块的入口 (我们接下来在下面实现它)
        crate::services::downloader::core_installer::install_vanilla_core(
            app, 
            &payload.game_version, 
            &global_mc_root
        ).await?;

        // TODO: 接下来的步骤（后续实现）
        // 1. 解析刚刚下载的 原版 JSON
        // 2. 并发下载 Assets 和 Libraries
        // 3. 如果需要，下载并注入 Fabric / Forge 引导器

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