// src-tauri/src/commands/modpack_cmd.rs
use crate::services::modpack_service;
use crate::domain::modpack::ModpackMetadata;
use crate::domain::event::DownloadProgressEvent;
use tauri::{AppHandle, Runtime, Emitter};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;

#[derive(Serialize, Deserialize)]
pub struct MissingRuntime {
    pub instance_id: String,
    pub mc_version: String,
    pub loader_type: String,
    pub loader_version: String,
}

#[derive(Serialize)]
pub struct ImportResult {
    pub added: usize,
    pub missing: Vec<MissingRuntime>,
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn copy_and_check_instance(
    src_dir: &Path,
    dest_instances_dir: &Path,
    runtime_dir: &Path,
) -> Result<Option<MissingRuntime>, String> {
    let instance_json_path = src_dir.join("instance.json");
    let content = fs::read_to_string(&instance_json_path).map_err(|e| e.to_string())?;

    let config: crate::domain::instance::InstanceConfig =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let dest_dir = dest_instances_dir.join(&config.id);
    if !dest_dir.exists() {
        copy_dir_all(src_dir, &dest_dir).map_err(|e| e.to_string())?;
    }

    let mut is_missing = false;

    let core_json = runtime_dir
        .join("versions")
        .join(&config.mc_version)
        .join(format!("{}.json", config.mc_version));
    if !core_json.exists() {
        is_missing = true;
    }

    if !config.loader.r#type.eq_ignore_ascii_case("vanilla") && !config.loader.version.is_empty() {
        let loader_folder = match config.loader.r#type.to_lowercase().as_str() {
            "fabric" => format!("fabric-loader-{}-{}", config.loader.version, config.mc_version),
            "forge" => format!("{}-forge-{}", config.mc_version, config.loader.version),
            "neoforge" => format!("neoforge-{}", config.loader.version),
            _ => "".to_string(),
        };

        if !loader_folder.is_empty() {
            let loader_json = runtime_dir
                .join("versions")
                .join(&loader_folder)
                .join(format!("{}.json", loader_folder));
            if !loader_json.exists() {
                is_missing = true;
            }
        }
    }

    if is_missing {
        Ok(Some(MissingRuntime {
            instance_id: config.id.clone(),
            mc_version: config.mc_version,
            loader_type: config.loader.r#type,
            loader_version: config.loader.version,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn import_local_instances_folders<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path_str).join("instances");
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");

    fs::create_dir_all(&instances_dir).map_err(|e| e.to_string())?;

    let mut added_count = 0;
    let mut missing_list = Vec::new();

    for path_str in paths {
        let root = PathBuf::from(&path_str);
        if !root.exists() || !root.is_dir() {
            continue;
        }

        if root.join("instance.json").exists() {
            if let Ok(missing) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
                added_count += 1;
                if let Some(m) = missing {
                    missing_list.push(m);
                }
            }
        } else if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let child = entry.path();
                if child.is_dir() && child.join("instance.json").exists() {
                    if let Ok(missing) = copy_and_check_instance(&child, &instances_dir, &runtime_dir) {
                        added_count += 1;
                        if let Some(m) = missing {
                            missing_list.push(m);
                        }
                    }
                }
            }
        }
    }

    Ok(ImportResult {
        added: added_count,
        missing: missing_list,
    })
}

#[tauri::command]
pub async fn import_third_party_instance<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<Option<MissingRuntime>, String> {
    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("所选路径不是一个有效的文件夹。".to_string());
    }

    let id = dir_path.file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "非法的文件夹名称。".to_string())?;

    let json_path = dir_path.join(format!("{}.json", id));
    if !json_path.exists() {
        return Err(format!("找不到 {}.json。请选择第三方启动器内的 versions/{{版本名}} 目录！", id));
    }

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let mut mc_version = id.to_string();
    let mut loader_type = "vanilla".to_string();
    let mut loader_version = "".to_string();

    if let Some(inherits) = json.get("inheritsFrom").and_then(|v| v.as_str()) {
        mc_version = inherits.to_string();
        let id_lower = id.to_lowercase();
        if id_lower.contains("forge") && !id_lower.contains("neo") {
            loader_type = "forge".to_string();
            // 尝试提取 Forge 版本, 例如 1.19.2-forge-43.2.0 -> 43.2.0
            let parts: Vec<&str> = id.split("-forge-").collect();
            if parts.len() == 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("neoforge") {
            loader_type = "neoforge".to_string();
            let parts: Vec<&str> = id.split("neoforge-").collect();
            if parts.len() >= 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("fabric") {
            loader_type = "fabric".to_string();
            // fabric-loader-0.14.21-1.19.2 -> 0.14.21
            let parts: Vec<&str> = id.split("-").collect();
            if parts.len() >= 3 && parts[0] == "fabric" && parts[1] == "loader" {
                loader_version = parts[2].to_string();
            }
        }
    }

    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");
    let instances_dir = PathBuf::from(&base_path_str).join("instances");

    let dest_dir = instances_dir.join(id);
    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    }

    let config = crate::domain::instance::InstanceConfig {
        id: id.to_string(),
        name: id.to_string(),
        mc_version: mc_version.clone(),
        loader: crate::domain::instance::LoaderConfig {
            r#type: loader_type.clone(),
            version: loader_version.clone(),
        },
        java: crate::domain::instance::JavaConfig {
            path: "auto".to_string(),
            version: "8".to_string(), // 自动选择
        },
        memory: crate::domain::instance::MemoryConfig {
            min: 1024,
            max: 4096,
        },
        resolution: crate::domain::instance::ResolutionConfig {
            width: 854,
            height: 480,
        },
        play_time: 0.0,
        last_played: "".to_string(),
        created_at: chrono::Local::now().to_rfc3339(),
        cover_image: None,
        hero_logo: None,
        gamepad: None,
        custom_buttons: None,
        third_party_path: Some(path.clone()),
    };

    let config_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(dest_dir.join("instance.json"), config_content).map_err(|e| e.to_string())?;

    let mut is_missing = false;
    let core_json = runtime_dir.join("versions").join(&mc_version).join(format!("{}.json", mc_version));
    if !core_json.exists() {
        is_missing = true;
    }

    if loader_type != "vanilla" && !loader_version.is_empty() {
        let loader_folder = match loader_type.as_str() {
            "fabric" => format!("fabric-loader-{}-{}", loader_version, mc_version),
            "forge" => format!("{}-forge-{}", mc_version, loader_version),
            "neoforge" => format!("neoforge-{}", loader_version),
            _ => "".to_string(),
        };
        if !loader_folder.is_empty() {
            let loader_json = runtime_dir.join("versions").join(&loader_folder).join(format!("{}.json", loader_folder));
            if !loader_json.exists() {
                is_missing = true;
            }
        }
    }

    if is_missing {
        Ok(Some(MissingRuntime {
            instance_id: id.to_string(),
            mc_version,
            loader_type,
            loader_version,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn download_missing_runtimes<R: Runtime>(
    app: AppHandle<R>,
    missing_list: Vec<MissingRuntime>,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap();
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");

    for m in missing_list {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: m.instance_id.clone(),
                stage: "VANILLA_CORE".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: format!("Downloading missing runtime {}", m.mc_version),
            },
        );

        let no_cancel = Arc::new(AtomicBool::new(false));

        let _ = crate::services::downloader::core_installer::install_vanilla_core(
            &app,
            &m.instance_id,
            &m.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::dependencies::download_dependencies(
            &app,
            &m.instance_id,
            &m.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::loader_installer::install_loader(
            &app,
            &m.instance_id,
            &m.mc_version,
            &m.loader_type,
            &m.loader_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: m.instance_id.clone(),
                stage: "DONE".to_string(),
                file_name: "".to_string(),
                current: 100,
                total: 100,
                message: "Runtime download completed".to_string(),
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn parse_modpack_metadata(path: String) -> Result<ModpackMetadata, String> {
    modpack_service::parse_modpack(&path)
}

#[tauri::command]
pub async fn import_modpack<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let i_id = instance_name.replace(' ', "_").replace('/', "").replace('\\', "");

        let cancel = deployment_cancel::register(&i_id);
        let result = modpack_service::execute_import(&app, &zip_path, &instance_name, &cancel).await;
        deployment_cancel::unregister(&i_id);

        if let Err(e) = result {
            eprintln!("Modpack import failed: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id,
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("Import interrupted: {}", e),
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn download_and_import_modpack<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    instance_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let i_id = instance_name.replace(' ', "_").replace('/', "").replace('\\', "");

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: i_id.clone(),
                stage: "DOWNLOADING_MODPACK".to_string(),
                file_name: "modpack.zip".to_string(),
                current: 0,
                total: 100,
                message: "Downloading modpack archive...".to_string(),
            },
        );

        let temp_dir = std::env::temp_dir();
        let file_name = url.split('/').last().unwrap_or("modpack.zip");
        let temp_path = temp_dir.join(file_name);

        let client = reqwest::Client::builder()
            .user_agent("PiLauncher/1.0")
            .build()
            .unwrap();

        if let Ok(mut res) = client.get(&url).send().await {
            if res.status().is_success() {
                let total_size = res.content_length().unwrap_or(0);
                let mut file_data = Vec::new();
                let mut downloaded = 0;

                while let Ok(Some(chunk)) = res.chunk().await {
                    file_data.extend_from_slice(&chunk);
                    downloaded += chunk.len() as u64;

                    if downloaded % (1024 * 512) < 10000 || downloaded == total_size {
                        let _ = app.emit(
                            "instance-deployment-progress",
                            DownloadProgressEvent {
                                instance_id: i_id.clone(),
                                stage: "DOWNLOADING_MODPACK".to_string(),
                                file_name: file_name.to_string(),
                                current: downloaded,
                                total: total_size,
                                message: format!(
                                    "Downloading modpack archive {:.1} MB",
                                    downloaded as f64 / 1048576.0
                                ),
                            },
                        );
                    }
                }
                let _ = std::fs::write(&temp_path, file_data);
            } else {
                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: i_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: "".to_string(),
                        current: 0,
                        total: 100,
                        message: format!(
                            "Modpack download failed (HTTP {})",
                            res.status()
                        ),
                    },
                );
                return;
            }
        } else {
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id.clone(),
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: "Modpack download request failed".to_string(),
                },
            );
            return;
        }

        let cancel = deployment_cancel::register(&i_id);
        let result = crate::services::modpack_service::execute_import(
            &app,
            &temp_path.to_string_lossy(),
            &instance_name,
            &cancel,
        )
        .await;
        deployment_cancel::unregister(&i_id);

        if let Err(e) = result {
            eprintln!("Modpack deployment failed: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id,
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("Deployment interrupted: {}", e),
                },
            );
        }

        let _ = std::fs::remove_file(temp_path);
    });

    Ok(())
}

use crate::services::modpack_service::export::ExportConfig;

#[tauri::command]
pub async fn export_modpack<R: Runtime>(
    app: AppHandle<R>,
    config: ExportConfig,
) -> Result<(), String> {
    modpack_service::export::execute_export(&app, config).await
}
