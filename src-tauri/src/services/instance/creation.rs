// src-tauri/src/services/instance/creation.rs
use chrono::Local;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::error::{AppError, AppResult};
use crate::services::deployment_cancel;

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

        // ✅ 注册取消令牌
        let cancel = deployment_cancel::register(&instance_id);

        // ✅ 记录部署前哪些 runtime/versions 目录已经存在（取消时只删新建的）
        let vanilla_version_dir = global_mc_root.join("versions").join(&payload.game_version);
        let vanilla_version_existed = vanilla_version_dir.exists();

        let loader_type = payload.loader_type.to_lowercase();
        let loader_version = payload.loader_version.clone().unwrap_or_default();
        let loader_version_dir_name = match loader_type.as_str() {
            "fabric" => Some(format!("fabric-loader-{}-{}", loader_version, payload.game_version)),
            "forge" => Some(format!("{}-forge-{}", payload.game_version, loader_version)),
            "neoforge" => Some(format!("neoforge-{}", loader_version)),
            _ => None,
        };
        let loader_version_dir = loader_version_dir_name
            .as_ref()
            .map(|name| global_mc_root.join("versions").join(name));
        let loader_version_existed = loader_version_dir
            .as_ref()
            .map(|p| p.exists())
            .unwrap_or(true); // 如果没有 loader 目录，标记为已存在（不需要删除）

        // 部署结果处理闭包：无论成功/失败/取消，都注销令牌
        let result = Self::run_deployment(
            app,
            &instance_id,
            &payload,
            &global_mc_root,
            &cancel,
        )
        .await;

        deployment_cancel::unregister(&instance_id);

        match &result {
            Err(AppError::Cancelled) => {
                eprintln!("[Deployment] 实例 {} 部署已被用户取消，开始清理...", instance_id);

                // 清理实例目录
                if instance_root.exists() {
                    let _ = fs::remove_dir_all(&instance_root);
                    eprintln!("[Deployment] 已清理实例目录: {:?}", instance_root);
                }

                // 清理本次新创建的 vanilla version 目录
                if !vanilla_version_existed && vanilla_version_dir.exists() {
                    let _ = fs::remove_dir_all(&vanilla_version_dir);
                    eprintln!("[Deployment] 已清理新创建的版本目录: {:?}", vanilla_version_dir);
                }

                // 清理本次新创建的 loader version 目录
                if !loader_version_existed {
                    if let Some(ref dir) = loader_version_dir {
                        if dir.exists() {
                            let _ = fs::remove_dir_all(dir);
                            eprintln!("[Deployment] 已清理新创建的 Loader 版本目录: {:?}", dir);
                        }
                    }
                }

                // 通知前端取消完成
                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: instance_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: "".to_string(),
                        current: 0,
                        total: 100,
                        message: "用户已取消部署，环境已清理。".to_string(),
                    },
                );
            }
            _ => {}
        }

        result
    }

    /// 实际部署流程（分离出来便于统一处理取消逻辑）
    async fn run_deployment<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        payload: &CreateInstancePayload,
        global_mc_root: &PathBuf,
        cancel: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> AppResult<()> {
        // 1. 部署原版核心
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: format!("正在准备部署 Minecraft {}...", payload.game_version),
            },
        );

        crate::services::downloader::core_installer::install_vanilla_core(
            app,
            instance_id,
            &payload.game_version,
            global_mc_root,
            cancel,
        )
        .await?;

        // 2. 下载原版依赖库
        crate::services::downloader::dependencies::download_dependencies(
            app,
            instance_id,
            &payload.game_version,
            global_mc_root,
            cancel,
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
                    instance_id: instance_id.to_string(),
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
                instance_id,
                &payload.game_version,
                &loader_type,
                &loader_version,
                global_mc_root,
                cancel,
            ).await?;
        }

        // 4. 完成部署
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
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