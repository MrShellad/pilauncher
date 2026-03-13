// src-tauri/src/commands/modpack_cmd.rs
use crate::services::modpack_service;
use crate::domain::modpack::ModpackMetadata;
use crate::domain::event::DownloadProgressEvent;
use tauri::{AppHandle, Runtime, Emitter};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use crate::services::config_service::ConfigService;

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

// 简单递归拷贝目录
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
    
    let config: crate::domain::instance::InstanceConfig = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    
    let dest_dir = dest_instances_dir.join(&config.id);
    if !dest_dir.exists() {
        copy_dir_all(src_dir, &dest_dir).map_err(|e| e.to_string())?;
    }

    let mut is_missing = false;
    
    // Check core
    let core_json = runtime_dir.join("versions").join(&config.mc_version).join(format!("{}.json", config.mc_version));
    if !core_json.exists() {
        is_missing = true;
    }
    
    // Check loader
    if !config.loader.r#type.eq_ignore_ascii_case("vanilla") && !config.loader.version.is_empty() {
        let loader_folder = match config.loader.r#type.to_lowercase().as_str() {
            "fabric" => format!("fabric-loader-{}-{}", config.loader.version, config.mc_version),
            "forge" => format!("{}-forge-{}", config.mc_version, config.loader.version), 
            "neoforge" => format!("neoforge-{}", config.loader.version),
            _ => "".to_string(),
        };
        
        if !loader_folder.is_empty() {
            let loader_json = runtime_dir.join("versions").join(&loader_folder).join(format!("{}.json", loader_folder));
            if !loader_json.exists() {
                is_missing = true;
            }
        } else {
            // Unrecognized loader, assume missing just in case? Let's just ignore to be safe.
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
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
    let instances_dir = PathBuf::from(&base_path_str).join("instances");
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");
    
    fs::create_dir_all(&instances_dir).map_err(|e| e.to_string())?;

    let mut added_count = 0;
    let mut missing_list = Vec::new();

    for path_str in paths {
        let root = PathBuf::from(&path_str);
        if !root.exists() || !root.is_dir() { continue; }
        
        // Depth 1: The folder itself is an instance
        if root.join("instance.json").exists() {
            if let Ok(missing) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
                added_count += 1;
                if let Some(m) = missing { missing_list.push(m); }
            }
        } else {
            // Depth 2: Child folders might be instances
            if let Ok(entries) = fs::read_dir(&root) {
                for entry in entries.flatten() {
                    let child = entry.path();
                    if child.is_dir() && child.join("instance.json").exists() {
                        if let Ok(missing) = copy_and_check_instance(&child, &instances_dir, &runtime_dir) {
                            added_count += 1;
                            if let Some(m) = missing { missing_list.push(m); }
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
pub async fn download_missing_runtimes<R: Runtime>(
    app: AppHandle<R>,
    missing_list: Vec<MissingRuntime>,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap();
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");

    for m in missing_list {
         let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: m.instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("正在下载缺少的环境: {}", m.mc_version),
        });

        // 补全核心
        let _ = crate::services::downloader::core_installer::install_vanilla_core(
            &app, &m.instance_id, &m.mc_version, &runtime_dir
        ).await;
        
        let _ = crate::services::downloader::dependencies::download_dependencies(
            &app, &m.instance_id, &m.mc_version, &runtime_dir
        ).await;
        
        // 补全 Loader
        let _ = crate::services::downloader::loader_installer::install_loader(
            &app, &m.instance_id, &m.mc_version, &m.loader_type, &m.loader_version, &runtime_dir
        ).await;
        
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: m.instance_id.clone(),
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: format!("环境补全完成"),
        });
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
        // ✅ 修复：提前进行非法字符替换，保证和 execute_import 里的 ID 绝对一致！
        let i_id = instance_name.replace(" ", "_").replace("/", "").replace("\\", "");

        if let Err(e) = modpack_service::execute_import(&app, &zip_path, &instance_name).await {
            eprintln!("整合包导入失败: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id, // 使用统一的 ID
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("导入意外中断: {}", e),
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
        // ✅ 修复：提前进行非法字符替换，保证和 execute_import 里的 ID 绝对一致！
        let i_id = instance_name.replace(" ", "_").replace("/", "").replace("\\", "");

        // 1. 发送最初始的阶段事件 (步骤 0/6)
        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
            instance_id: i_id.clone(), // 使用统一的 ID
            stage: "DOWNLOADING_MODPACK".to_string(), 
            file_name: "整合包压缩文件".to_string(),
            current: 0,
            total: 100,
            message: "正在从服务端拉取整合包...".to_string(),
        });

        let temp_dir = std::env::temp_dir();
        let file_name = url.split('/').last().unwrap_or("modpack.zip");
        let temp_path = temp_dir.join(file_name);

        let client = reqwest::Client::builder().user_agent("OreLauncher/1.0").build().unwrap();
        
        if let Ok(mut res) = client.get(&url).send().await {
            if res.status().is_success() {
                let total_size = res.content_length().unwrap_or(0);
                let mut file_data = Vec::new();
                let mut downloaded = 0;

                while let Ok(Some(chunk)) = res.chunk().await {
                    file_data.extend_from_slice(&chunk);
                    downloaded += chunk.len() as u64;

                    if downloaded % (1024 * 512) < 10000 || downloaded == total_size {
                        let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                            instance_id: i_id.clone(), // 使用统一的 ID
                            stage: "DOWNLOADING_MODPACK".to_string(),
                            file_name: file_name.to_string(),
                            current: downloaded,
                            total: total_size,
                            message: format!("正在下载整合包主体: {:.1} MB", downloaded as f64 / 1048576.0),
                        });
                    }
                }
                let _ = std::fs::write(&temp_path, file_data);
            } else {
                let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                    instance_id: i_id.clone(), // 使用统一的 ID
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("整合包下载失败 (HTTP 错误: {})", res.status()),
                });
                return;
            }
        } else {
             let _ = app.emit("instance-deployment-progress", DownloadProgressEvent {
                instance_id: i_id.clone(), // 使用统一的 ID
                stage: "ERROR".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: "整合包网络请求失败，请检查网络".to_string(),
            });
            return;
        }

        // 3. 魔法交接：下载完成后，依然传入最原始的 instance_name 给服务层
        if let Err(e) = crate::services::modpack_service::execute_import(&app, &temp_path.to_string_lossy(), &instance_name).await {
            eprintln!("整合包部署失败: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id, // 使用统一的 ID
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("部署意外中断: {}", e),
                },
            );
        }

        // 4. 清理临时文件，保护用户硬盘
        let _ = std::fs::remove_file(temp_path);
    });

    Ok(())
}