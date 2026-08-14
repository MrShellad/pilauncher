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
use crate::services::minecraft_service::normalize_loader_version_token;

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

        let loader_type = normalize_loader_type(&payload.loader_type).ok_or_else(|| {
            AppError::Generic(format!("Unsupported loader type: {}", payload.loader_type))
        })?;
        let loader_version = normalize_loader_version(
            &loader_type,
            game_version,
            payload.loader_version.as_deref(),
        );
        if loader_type != "vanilla" && loader_version.is_empty() {
            return Err(AppError::Generic("Loader version is required".to_string()));
        }

        let mut config = InstanceBindingService::load_instance_config(app, instance_id)
            .map_err(AppError::Generic)?;

        if config.mc_version == game_version
            && config.loader.r#type.eq_ignore_ascii_case(&loader_type)
            && config.loader.version == loader_version
        {
            // A previous run can finish its filesystem work but fail before the
            // database write. Treat this as a reconciliation path, not a no-op.
            InstanceBindingService::upsert_instance(&db.pool, &config).await?;
            Self::emit(
                app,
                instance_id,
                "DONE",
                100,
                100,
                "Instance environment is already up to date.".to_string(),
            );
            return Ok(());
        }

        let base_path = ConfigService::get_base_path(app)?.ok_or_else(|| {
            AppError::Generic("Base data directory is not configured".to_string())
        })?;
        let base_dir = PathBuf::from(base_path);
        let runtime_dir = base_dir.join("runtime");
        let instance_root = base_dir.join("instances").join(instance_id);
        let config_path = InstanceBindingService::instance_config_path(app, instance_id)
            .map_err(AppError::Generic)?;
        let previous_config = std::fs::read(&config_path)?;
        let manifest_path = instance_root.join("instance_manifest.json");
        let previous_manifest = std::fs::read(&manifest_path).ok();

        let cancel_guard = DeploymentCancelGuard::new(instance_id)?;
        let cancel = Arc::clone(&cancel_guard.token);
        let result = async {
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
        .await;

        if result.is_err() {
            // Keep instance metadata coherent when a late commit step fails.
            // Downloaded runtime artifacts are shared cache entries and may be
            // reused, but the instance must continue to describe its old state.
            let _ = std::fs::write(&config_path, previous_config);
            restore_optional_file(&manifest_path, previous_manifest.as_deref());

            let runtime_temp = runtime_dir.join("temp");
            if runtime_temp.exists() {
                let _ = std::fs::remove_dir_all(&runtime_temp);
                eprintln!(
                    "[Environment] Cleaned up temporary directory on failure: {:?}",
                    runtime_temp
                );
            }
        }

        result
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

fn normalize_loader_type(loader_type: &str) -> Option<String> {
    match loader_type.trim().to_ascii_lowercase().as_str() {
        "vanilla" | "" => Some("vanilla".to_string()),
        "neoforge" | "neo_forge" | "neo-forge" => Some("neoforge".to_string()),
        "fabric" => Some("fabric".to_string()),
        "forge" => Some("forge".to_string()),
        "quilt" => Some("quilt".to_string()),
        _ => None,
    }
}

fn normalize_loader_version(
    loader_type: &str,
    mc_version: &str,
    loader_version: Option<&str>,
) -> String {
    if loader_type.eq_ignore_ascii_case("vanilla") {
        String::new()
    } else {
        normalize_loader_version_token(loader_type, mc_version, loader_version.unwrap_or_default())
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
    fn new(instance_id: &str) -> AppResult<Self> {
        Ok(Self {
            instance_id: instance_id.to_string(),
            token: deployment_cancel::try_register(instance_id).map_err(AppError::Generic)?,
        })
    }
}

fn restore_optional_file(path: &std::path::Path, content: Option<&[u8]>) {
    match content {
        Some(content) => {
            let _ = std::fs::write(path, content);
        }
        None => {
            if path.exists() {
                let _ = std::fs::remove_file(path);
            }
        }
    }
}

impl Drop for DeploymentCancelGuard {
    fn drop(&mut self) {
        deployment_cancel::unregister(&self.instance_id);
    }
}

#[cfg(test)]
mod tests {
    use super::normalize_loader_type;

    #[test]
    fn rejects_unknown_loader_instead_of_downgrading_to_vanilla() {
        assert_eq!(
            normalize_loader_type("Neo-Forge"),
            Some("neoforge".to_string())
        );
        assert_eq!(
            normalize_loader_type("vanilla"),
            Some("vanilla".to_string())
        );
        assert_eq!(normalize_loader_type("unsupported-loader"), None);
    }
}
