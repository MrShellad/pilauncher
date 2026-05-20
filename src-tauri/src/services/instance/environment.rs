use std::path::PathBuf;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};

use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{CreateInstancePayload, UpdateInstanceEnvironmentPayload};
use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::db_service::AppDatabase;
use crate::services::deployment_cancel;
use crate::services::instance::binding::InstanceBindingService;

pub struct InstanceEnvironmentService;

impl InstanceEnvironmentService {
    pub async fn update<R: Runtime>(
        app: &AppHandle<R>,
        db: &AppDatabase,
        payload: UpdateInstanceEnvironmentPayload,
    ) -> AppResult<()> {
        let instance_id = payload.instance_id.trim();
        if instance_id.is_empty() {
            return Err(AppError::Generic("Instance id is required".to_string()));
        }

        let game_version = payload.game_version.trim();
        if game_version.is_empty() {
            return Err(AppError::Generic(
                "Minecraft version is required".to_string(),
            ));
        }

        let loader_type = normalize_loader_type(&payload.loader_type);
        let loader_version =
            normalize_loader_version(&loader_type, payload.loader_version.as_deref());
        if loader_type != "vanilla" && loader_version.is_empty() {
            return Err(AppError::Generic("Loader version is required".to_string()));
        }

        let mut config = InstanceBindingService::load_instance_config(app, instance_id)
            .map_err(AppError::Generic)?;

        if config.mc_version == game_version
            && config.loader.r#type.eq_ignore_ascii_case(&loader_type)
            && config.loader.version == loader_version
        {
            return Ok(());
        }

        let base_path = ConfigService::get_base_path(app)?.ok_or_else(|| {
            AppError::Generic("Base data directory is not configured".to_string())
        })?;
        let base_dir = PathBuf::from(base_path);
        let runtime_dir = base_dir.join("runtime");
        let instance_root = base_dir.join("instances").join(instance_id);

        let cancel_guard = DeploymentCancelGuard::new(instance_id);
        let cancel = Arc::clone(&cancel_guard.token);
        Self::emit(
            app,
            instance_id,
            "VANILLA_CORE",
            0,
            100,
            format!("Preparing Minecraft {} environment...", game_version),
        );

        crate::services::downloader::core_installer::install_vanilla_core(
            app,
            instance_id,
            game_version,
            &runtime_dir,
            &cancel,
        )
        .await?;

        if cancel.load(Ordering::Relaxed) {
            return Err(AppError::Cancelled);
        }

        crate::services::downloader::dependencies::download_dependencies(
            app,
            instance_id,
            game_version,
            &runtime_dir,
            &cancel,
        )
        .await?;

        if loader_type != "vanilla" {
            Self::emit(
                app,
                instance_id,
                "LOADER_CORE",
                0,
                100,
                format!(
                    "Installing {} {} environment...",
                    display_loader_type(&loader_type),
                    loader_version
                ),
            );

            crate::services::downloader::loader_installer::install_loader(
                app,
                instance_id,
                game_version,
                &loader_type,
                &loader_version,
                &runtime_dir,
                &cancel,
            )
            .await?;
        }

        config.mc_version = game_version.to_string();
        config.loader.r#type = loader_type.clone();
        config.loader.version = loader_version.clone();

        let manifest_payload = CreateInstancePayload {
            name: config.name.clone(),
            folder_name: config.id.clone(),
            game_version: config.mc_version.clone(),
            loader_type: config.loader.r#type.clone(),
            loader_version: Some(config.loader.version.clone()),
            save_path: String::new(),
            cover_image: None,
            server_binding: config.server_binding.clone(),
        };

        crate::services::instance::manifest_builder::build_and_save_manifest(
            &manifest_payload,
            &runtime_dir,
            &instance_root,
        )?;

        InstanceBindingService::write_instance_config(app, instance_id, &config)
            .map_err(AppError::Generic)?;
        InstanceBindingService::upsert_instance(&db.pool, &config).await?;

        Self::emit(
            app,
            instance_id,
            "DONE",
            100,
            100,
            "Instance environment updated successfully.".to_string(),
        );

        Ok(())
    }

    fn emit<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        stage: &str,
        current: u64,
        total: u64,
        message: String,
    ) {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: stage.to_string(),
                file_name: String::new(),
                current,
                total,
                message,
            },
        );
    }
}

fn normalize_loader_type(loader_type: &str) -> String {
    match loader_type.trim().to_lowercase().as_str() {
        "neoforge" | "neo_forge" | "neo-forge" => "neoforge".to_string(),
        "fabric" => "fabric".to_string(),
        "forge" => "forge".to_string(),
        "quilt" => "quilt".to_string(),
        _ => "vanilla".to_string(),
    }
}

fn normalize_loader_version(loader_type: &str, loader_version: Option<&str>) -> String {
    if loader_type.eq_ignore_ascii_case("vanilla") {
        String::new()
    } else {
        loader_version.unwrap_or_default().trim().to_string()
    }
}

fn display_loader_type(loader_type: &str) -> &str {
    match loader_type {
        "fabric" => "Fabric",
        "forge" => "Forge",
        "neoforge" => "NeoForge",
        "quilt" => "Quilt",
        _ => "Vanilla",
    }
}

struct DeploymentCancelGuard {
    instance_id: String,
    token: Arc<AtomicBool>,
}

impl DeploymentCancelGuard {
    fn new(instance_id: &str) -> Self {
        Self {
            instance_id: instance_id.to_string(),
            token: deployment_cancel::register(instance_id),
        }
    }
}

impl Drop for DeploymentCancelGuard {
    fn drop(&mut self) {
        deployment_cancel::unregister(&self.instance_id);
    }
}
