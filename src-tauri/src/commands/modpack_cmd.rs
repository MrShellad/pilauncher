// src-tauri/src/commands/modpack_cmd.rs
use crate::services::modpack_service;
use crate::domain::modpack::ModpackMetadata;
use crate::domain::event::DownloadProgressEvent;
use tauri::{AppHandle, Runtime, Emitter};

#[tauri::command]
pub async fn parse_modpack_metadata(path: String) -> Result<ModpackMetadata, String> {
    // 直接调用 service 层的业务逻辑
    modpack_service::parse_modpack(&path)
}

#[tauri::command]
pub async fn import_modpack<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
) -> Result<(), String> {
    // ✅ 核心魔法：开启后台异步任务，立刻返回前端允许其跳转页面
    tauri::async_runtime::spawn(async move {
        if let Err(e) = modpack_service::execute_import(&app, &zip_path, &instance_name).await {
            eprintln!("整合包导入失败: {}", e);
            // 失败时，通过全局事件通知右下角的 TaskItem 标红报错
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_name.clone(),
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