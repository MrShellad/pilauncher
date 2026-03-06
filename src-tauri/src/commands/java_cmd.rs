// src-tauri/src/commands/java_cmd.rs
use tauri::{AppHandle, Emitter, Runtime};
use std::env;
use serde_json::Value;

// 此处复用你现存的事件定义，借用 Resource 下载的通道来通知全局管理器
#[derive(serde::Serialize, Clone)]
struct ResourceDownloadEvent {
    pub task_id: String,
    pub file_name: String,
    pub stage: String,
    pub current: u64,
    pub total: u64,
    pub message: String,
}

#[tauri::command]
pub async fn download_java_env<R: Runtime>(
    app: AppHandle<R>,
    version: u8,
    provider: String,
) -> Result<(), String> {
    // 1. 自动侦测当前操作系统和 CPU 架构
    let os = match env::consts::OS {
        "windows" => "windows",
        "macos" => "mac",
        "linux" => "linux",
        _ => "linux",
    };
    
    let arch = match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64", // Apple M1/M2 或者 Linux ARM
        "x86" => "x86",
        _ => "x64",
    };

    // 2. 路由扩展：目前对接 Adoptium API，未来可增加 Zulu 或阿里 Dragonwell
    let api_url = if provider == "adoptium" {
        format!(
            "https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os={}",
            version, arch, os
        )
    } else {
        return Err("不支持的下载源".into());
    };

    // 这里启动一个异步任务放置在后台下载，不阻塞前端界面
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        
        // 步骤 1：查询 API 获取真实下载直链
        let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
            task_id: "java_download".to_string(),
            file_name: format!("Java {} ({}_{})", version, os, arch),
            stage: "DOWNLOADING_MOD".to_string(), // 借用现有的进度条阶段
            current: 0,
            total: 100,
            message: "正在向服务器查询对应系统的 Java 下载地址...".to_string(),
        });

        match client.get(&api_url).send().await {
            Ok(res) => {
                if let Ok(json) = res.json::<Value>().await {
                    // 从 Adoptium 复杂的 JSON 中提取包的直链
                    if let Some(binary) = json.as_array()
                        .and_then(|arr| arr.get(0))
                        .and_then(|obj| obj.get("binaries"))
                        .and_then(|arr| arr.get(0))
                        .and_then(|obj| obj.get("package")) 
                    {
                        let download_url = binary.get("link").and_then(|l| l.as_str()).unwrap_or("");
                        let size = binary.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
                        
                        let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
                            task_id: "java_download".to_string(),
                            file_name: format!("Java {} JDK", version),
                            stage: "DOWNLOADING_MOD".to_string(),
                            current: 0,
                            total: size,
                            message: "正在下载 Java 运行库...".to_string(),
                        });

                        // 此处仅做示例：真实环境中，你要向 url 发起请求并将流写入 [basePath]/runtime/java/ 文件夹中并解压。
                        // 由于你已经有了强大的 dependencies.rs，你可以直接在此处发起 HTTP Chunk 获取文件。
                        
                    } else {
                        let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
                            task_id: "java_download".to_string(),
                            file_name: format!("Java {}", version),
                            stage: "ERROR".to_string(),
                            current: 0, total: 0, message: "该系统架构目前没有对应的官方 Java 包".to_string(),
                        });
                    }
                }
            },
            Err(_) => {
                let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
                    task_id: "java_download".to_string(),
                    file_name: format!("Java {}", version),
                    stage: "ERROR".to_string(),
                    current: 0, total: 0, message: "无法连接到 Adoptium 官方服务器".to_string(),
                });
            }
        }
    });

    Ok(())
}