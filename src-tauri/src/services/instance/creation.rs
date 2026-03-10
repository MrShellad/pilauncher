// src-tauri/src/services/instance/creation.rs
use chrono::Local;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::error::AppResult;

pub struct InstanceCreationService;

impl InstanceCreationService {
    pub async fn create<R: Runtime>(
        app: &AppHandle<R>,
        payload: CreateInstancePayload,
    ) -> AppResult<()> {
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| {
                std::io::Error::new(std::io::ErrorKind::NotFound, "尚未配置基础数据目录")
            })?;
        let base_dir = PathBuf::from(base_path_str);

        let instance_id = payload.folder_name.clone();
        let instance_root = base_dir.join("instances").join(&instance_id);

        let sub_dirs = [
            "mods",
            "config",
            "saves",
            "resourcepacks",
            "screenshots",
            "piconfig",
        ];
        for dir in sub_dirs {
            fs::create_dir_all(instance_root.join(dir))?;
        }

        // 保存封面
        let mut saved_cover_path = None;
        let piconfig_dir = instance_root.join("piconfig");
        if let Some(cover_path_str) = &payload.cover_image {
            let cover_path = Path::new(cover_path_str);
            if cover_path.exists() {
                let ext = cover_path.extension().unwrap_or_default();
                let target_name = format!("cover.{}", ext.to_string_lossy());
                let _ = fs::copy(
                    cover_path,
                    piconfig_dir.join(&target_name),
                );
                saved_cover_path = Some(format!("piconfig/{}", target_name));
            }
        }

        // 写入 instance.json
        let config = InstanceConfig {
            id: instance_id.clone(),
            name: if payload.name.is_empty() {
                payload.folder_name.clone()
            } else {
                payload.name.clone()
            },
            mc_version: payload.game_version.clone(),
            loader: LoaderConfig {
                r#type: payload.loader_type.to_lowercase(),
                version: payload.loader_version.clone().unwrap_or_default(),
            },
            java: JavaConfig {
                path: "auto".to_string(),
                version: "auto".to_string(),
            },
            memory: MemoryConfig {
                min: 1024,
                max: 4096,
            },
            resolution: ResolutionConfig {
                width: 1280,
                height: 720,
            },
            play_time: 0.0,
            last_played: "从未游玩".to_string(),
            created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            cover_image: saved_cover_path,
            gamepad: None,
        };
        fs::write(
            instance_root.join("instance.json"),
            serde_json::to_string_pretty(&config)?,
        )?;

        let global_mc_root = base_dir.join("runtime");

        fs::create_dir_all(global_mc_root.join("assets"))?;
        fs::create_dir_all(global_mc_root.join("libraries"))?;
        fs::create_dir_all(global_mc_root.join("versions"))?;

        // 1. 部署原版核心
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.clone(),
                stage: "VANILLA_CORE".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: format!("正在准备部署 Minecraft {}...", payload.game_version),
            },
        );

        crate::services::downloader::core_installer::install_vanilla_core(
            app,
            &instance_id,
            &payload.game_version,
            &global_mc_root,
        )
        .await?;

        // 2. 下载原版依赖库
        crate::services::downloader::dependencies::download_dependencies(
            app,
            &instance_id,
            &payload.game_version,
            &global_mc_root,
        )
        .await?;

        // ✅ 3. 核心修复：解封 Loader 部署，并区分不同 Loader 类型进行提示和安装
        let loader_type = payload.loader_type.to_lowercase();
        
        if loader_type != "vanilla" && !loader_type.is_empty() {
            let loader_version = payload.loader_version.clone().unwrap_or_default();
            
            // 首字母大写，为了前端显示好看 (如 fabric -> Fabric)
            let display_loader = match loader_type.as_str() {
                "fabric" => "Fabric",
                "forge" => "Forge",
                "neoforge" => "NeoForge",
                "quilt" => "Quilt",
                _ => &payload.loader_type,
            };

            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.clone(),
                    stage: "LOADER_CORE".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("正在部署 {} {} 专属加载器环境...", display_loader, loader_version),
                },
            );

            // 正式调用 Loader 下载安装器
            crate::services::downloader::loader_installer::install_loader(
                app,
                &instance_id,
                &payload.game_version,
                &loader_type,
                &loader_version,
                &global_mc_root,
            ).await?;
        }

        // 4. 完成部署
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.clone(),
                stage: "DONE".to_string(),
                file_name: "".to_string(),
                current: 100,
                total: 100,
                message: "实例创建成功！".to_string(),
            },
        );

        Ok(())
    }
}