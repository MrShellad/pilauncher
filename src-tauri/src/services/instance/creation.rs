use chrono::Local;
use std::fs;
use std::path::{Path, PathBuf};

use tauri::{AppHandle, Emitter, Manager, Runtime};

use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{
    CreateInstancePayload, InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::error::{AppError, AppResult};
use crate::services::db_service::AppDatabase;
use crate::services::deployment_cancel;
use crate::services::downloader::logging::sanitize_filename;
use crate::services::instance::binding::InstanceBindingService;

pub struct InstanceCreationService;

impl InstanceCreationService {
    pub async fn create<R: Runtime>(
        app: &AppHandle<R>,
        payload: CreateInstancePayload,
    ) -> AppResult<()> {
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| {
                std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "Base data directory is not configured",
                )
            })?;
        let base_dir = PathBuf::from(base_path_str);

        let instance_id = sanitize_filename(&payload.folder_name);
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

        let mut saved_cover_path = None;
        let piconfig_dir = instance_root.join("piconfig");
        if let Some(cover_path_str) = &payload.cover_image {
            let cover_path = Path::new(cover_path_str);
            if cover_path.exists() {
                let ext = cover_path.extension().unwrap_or_default();
                let target_name = format!("cover.{}", ext.to_string_lossy());
                let _ = fs::copy(cover_path, piconfig_dir.join(&target_name));
                saved_cover_path = Some(format!("piconfig/{}", target_name));
            }
        }

        let config = InstanceConfig {
            id: instance_id.clone(),
            name: if payload.name.is_empty() {
                instance_id.clone()
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
            last_played: "Never played".to_string(),
            created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            cover_image: saved_cover_path,
            hero_logo: None,
            gamepad: None,
            custom_buttons: None,
            third_party_path: None,
            server_binding: payload.server_binding.clone(),
            auto_join_server: if payload.server_binding.is_some() {
                Some(true)
            } else {
                None
            },
            tags: None,
            jvm_args: None,
            window_width: None,
            window_height: None,
            is_favorite: None,
        };
        fs::write(
            instance_root.join("instance.json"),
            serde_json::to_string_pretty(&config)?,
        )?;

        let db = app.state::<AppDatabase>();
        InstanceBindingService::upsert_instance(&db.pool, &config).await?;

        if let Some(binding) = &payload.server_binding {
            let canonical_binding = InstanceBindingService::replace_binding_for_instance(
                &db.pool,
                &instance_id,
                binding,
                true,
            )
            .await?;
            let mut persisted_config = config;
            persisted_config.server_binding = Some(canonical_binding);
            persisted_config.auto_join_server = Some(true);
            fs::write(
                instance_root.join("instance.json"),
                serde_json::to_string_pretty(&persisted_config)?,
            )?;
        }

        let global_mc_root = base_dir.join("runtime");
        fs::create_dir_all(global_mc_root.join("assets"))?;
        fs::create_dir_all(global_mc_root.join("libraries"))?;
        fs::create_dir_all(global_mc_root.join("versions"))?;

        let cancel = deployment_cancel::register(&instance_id);

        let vanilla_version_dir = global_mc_root.join("versions").join(&payload.game_version);
        let vanilla_version_existed = vanilla_version_dir.exists();

        let loader_type = payload.loader_type.to_lowercase();
        let loader_version = payload.loader_version.clone().unwrap_or_default();
        let loader_version_dir_name = match loader_type.as_str() {
            "fabric" => Some(format!(
                "fabric-loader-{}-{}",
                loader_version, payload.game_version
            )),
            "forge" => Some(format!("{}-forge-{}", payload.game_version, loader_version)),
            "neoforge" => Some(format!("neoforge-{}", loader_version)),
            "quilt" => Some(format!(
                "quilt-loader-{}-{}",
                loader_version, payload.game_version
            )),
            _ => None,
        };
        let loader_version_dir = loader_version_dir_name
            .as_ref()
            .map(|name| global_mc_root.join("versions").join(name));
        let loader_version_existed = loader_version_dir
            .as_ref()
            .map(|p| p.exists())
            .unwrap_or(true);

        let result =
            Self::run_deployment(app, &instance_id, &payload, &global_mc_root, &cancel).await;

        deployment_cancel::unregister(&instance_id);

        match &result {
            Err(AppError::Cancelled) => {
                eprintln!(
                    "[Deployment] Instance {} deployment cancelled by user, cleaning up...",
                    instance_id
                );

                if instance_root.exists() {
                    let _ = fs::remove_dir_all(&instance_root);
                    eprintln!(
                        "[Deployment] Removed instance directory: {:?}",
                        instance_root
                    );
                }

                if !vanilla_version_existed && vanilla_version_dir.exists() {
                    let _ = fs::remove_dir_all(&vanilla_version_dir);
                    eprintln!(
                        "[Deployment] Removed newly created vanilla version directory: {:?}",
                        vanilla_version_dir
                    );
                }

                if !loader_version_existed {
                    if let Some(ref dir) = loader_version_dir {
                        if dir.exists() {
                            let _ = fs::remove_dir_all(dir);
                            eprintln!(
                                "[Deployment] Removed newly created loader version directory: {:?}",
                                dir
                            );
                        }
                    }
                }

                let db = app.state::<AppDatabase>();
                if let Err(error) =
                    InstanceBindingService::delete_instance_records(&db.pool, &instance_id).await
                {
                    eprintln!(
                        "[Deployment] Failed to remove database records for cancelled instance {}: {}",
                        instance_id, error
                    );
                }

                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: instance_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: "".to_string(),
                        current: 0,
                        total: 100,
                        message: "Deployment cancelled by user. Cleanup finished.".to_string(),
                    },
                );
            }
            Err(e) => {
                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: instance_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: "".to_string(),
                        current: 0,
                        total: 100,
                        message: format!("Deployment failed: {}", e),
                    },
                );
            }
            _ => {}
        }

        result
    }

    async fn run_deployment<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        payload: &CreateInstancePayload,
        global_mc_root: &PathBuf,
        cancel: &std::sync::Arc<std::sync::atomic::AtomicBool>,
    ) -> AppResult<()> {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: format!("Preparing Minecraft {} deployment...", payload.game_version),
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

        crate::services::downloader::dependencies::download_dependencies(
            app,
            instance_id,
            &payload.game_version,
            global_mc_root,
            cancel,
        )
        .await?;

        let loader_type = payload.loader_type.to_lowercase();
        if loader_type != "vanilla" && !loader_type.is_empty() {
            let loader_version = payload.loader_version.clone().unwrap_or_default();
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
                    message: format!(
                        "Installing {} {} environment...",
                        display_loader, loader_version
                    ),
                },
            );

            crate::services::downloader::loader_installer::install_loader(
                app,
                instance_id,
                &payload.game_version,
                &loader_type,
                &loader_version,
                global_mc_root,
                cancel,
            )
            .await?;
        }

        let instance_root = global_mc_root
            .parent()
            .unwrap()
            .join("instances")
            .join(instance_id);
        if let Err(e) = crate::services::instance::manifest_builder::build_and_save_manifest(
            payload,
            global_mc_root,
            &instance_root,
        ) {
            eprintln!("[Deployment] Failed to generate instance manifest: {}", e);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "DONE".to_string(),
                file_name: "".to_string(),
                current: 100,
                total: 100,
                message: "Instance created successfully!".to_string(),
            },
        );

        Ok(())
    }
}
