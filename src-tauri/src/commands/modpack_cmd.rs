// src-tauri/src/commands/modpack_cmd.rs
use crate::services::modpack_service;
use crate::domain::modpack::ModpackMetadata;
use crate::domain::event::DownloadProgressEvent;
use tauri::{AppHandle, Runtime, Emitter};

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