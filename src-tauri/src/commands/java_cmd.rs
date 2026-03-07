// src-tauri/src/commands/java_cmd.rs
use tauri::{AppHandle, Emitter, Runtime};
use std::env;
use std::path::{Path, PathBuf};
use serde_json::Value;

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
    let os = match env::consts::OS {
        "windows" => "windows",
        "macos" => "mac",
        "linux" => "linux",
        _ => "linux",
    };
    
    let arch = match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64", 
        "x86" => "x86",
        _ => "x64",
    };

    let ext = if os == "windows" { "zip" } else { "tar.gz" };

    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(15))
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            .build()
            .unwrap();
        
        let emit_err = |msg: &str| {
            let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
                task_id: "java_download".to_string(),
                file_name: format!("Java {}", version),
                stage: "ERROR".to_string(),
                current: 0, total: 0, message: msg.to_string(),
            });
        };

        let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
            task_id: "java_download".to_string(), file_name: format!("Java {} ({}_{})", version, os, arch),
            stage: "DOWNLOADING_MOD".to_string(), current: 0, total: 100, message: "正在向 API 查询最新版本直链...".to_string(),
        });

        let mut download_url = String::new();
        let mut file_name = String::new();

        // ✅ 去除清华源逻辑，保留纯净的 Adoptium 与 Zulu 路由
        if provider == "adoptium" {
            let mut api_url = format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os={}", version, arch, os);
            let mut json = match client.get(&api_url).send().await {
                Ok(r) => r.json::<Value>().await.unwrap_or(Value::Null),
                Err(_) => Value::Null,
            };

            if json.as_array().map(|a| a.is_empty()).unwrap_or(true) {
                api_url = format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os={}", version, arch, os);
                if let Ok(r) = client.get(&api_url).send().await { json = r.json().await.unwrap_or(Value::Null); }
            }

            if let Some(pkg) = json.as_array().and_then(|arr| arr.get(0)).and_then(|obj| obj.get("binaries")).and_then(|arr| arr.get(0)).and_then(|obj| obj.get("package")) {
                download_url = pkg.get("link").and_then(|l| l.as_str()).unwrap_or("").to_string();
                file_name = pkg.get("name").and_then(|n| n.as_str()).unwrap_or(&format!("jre-{}.{}", version, ext)).to_string();
            }
        } else if provider == "zulu" {
            let zulu_os = match os { "mac" => "macos", _ => os };
            let zulu_arch = match arch { "x64" => "x86", "aarch64" => "arm64", _ => "x86" };
            let hw_bitness = if arch == "x86" { "32" } else { "64" };
            let mut api_url = format!("https://api.azul.com/metadata/v1/zulu/packages?java_version={}&os={}&arch={}&hw_bitness={}&archive_type={}&java_package_type=jre&latest=true", version, zulu_os, zulu_arch, hw_bitness, ext);
            
            let mut json = match client.get(&api_url).send().await { Ok(r) => r.json::<Value>().await.unwrap_or(Value::Null), Err(_) => Value::Null, };
            if json.as_array().map(|a| a.is_empty()).unwrap_or(true) {
                api_url = format!("https://api.azul.com/metadata/v1/zulu/packages?java_version={}&os={}&arch={}&hw_bitness={}&archive_type={}&java_package_type=jdk&latest=true", version, zulu_os, zulu_arch, hw_bitness, ext);
                if let Ok(r) = client.get(&api_url).send().await { json = r.json().await.unwrap_or(Value::Null); }
            }

            if let Some(pkg) = json.as_array().and_then(|arr| arr.get(0)) {
                download_url = pkg.get("download_url").and_then(|l| l.as_str()).unwrap_or("").to_string();
                file_name = pkg.get("name").and_then(|n| n.as_str()).unwrap_or(&format!("zulu-{}.{}", version, ext)).to_string();
            }
        }

        if download_url.is_empty() { emit_err("该镜像源暂无适用于当前系统架构的 Java 包或网络异常"); return; }

        let _ = app.emit("resource-download-progress", ResourceDownloadEvent {
            task_id: "java_download".to_string(), file_name: file_name.clone(), stage: "DOWNLOADING_MOD".to_string(), current: 0, total: 100, message: "正在连接下载服务器...".to_string(),
        });

        match client.get(&download_url).send().await {
            Ok(mut res) if res.status().is_success() => {
                let actual_size = res.content_length().unwrap_or(100_000_000); 
                
                use crate::services::config_service::ConfigService;
                if let Ok(Some(base_path_str)) = ConfigService::get_base_path(&app) {
                    let java_dir = PathBuf::from(&base_path_str).join("runtime").join("java");
                    let _ = tokio::fs::create_dir_all(&java_dir).await;
                    let target_file = java_dir.join(&file_name);

                    if let Ok(mut file) = tokio::fs::File::create(&target_file).await {
                        use tokio::io::AsyncWriteExt;
                        let mut downloaded = 0;
                        let mut last_emit = std::time::Instant::now();
                        
                        while let Ok(Some(chunk)) = res.chunk().await {
                            if file.write_all(&chunk).await.is_err() { break; }
                            downloaded += chunk.len() as u64;
                            if last_emit.elapsed().as_millis() > 250 || downloaded == actual_size {
                                let _ = app.emit("resource-download-progress", ResourceDownloadEvent { task_id: "java_download".to_string(), file_name: file_name.clone(), stage: "DOWNLOADING_MOD".to_string(), current: downloaded, total: actual_size, message: format!("正在高速下载: {}", file_name) });
                                last_emit = std::time::Instant::now();
                            }
                        }
                        
                        let _ = app.emit("resource-download-progress", ResourceDownloadEvent { task_id: "java_download".to_string(), file_name: file_name.clone(), stage: "EXTRACTING".to_string(), current: actual_size, total: actual_size, message: "正在解压 Java 运行环境...".to_string() });

                        let extract_target = java_dir.join(format!("jre-{}", version));
                        let is_zip = ext == "zip";
                        let target_file_clone = target_file.clone();
                        let base_path_clone = base_path_str.clone();

                        let extract_result = tokio::task::spawn_blocking(move || {
                            let res = extract_archive(&target_file_clone, &extract_target, is_zip);
                            if res.is_ok() {
                                // 1. 让后端触发一次物理扫描，将新解压的 Java 录入 config/java_cache.json
                                let cache_file = PathBuf::from(&base_path_clone).join("config").join("java_cache.json");
                                let _ = crate::services::runtime_service::scan_java_environments(&cache_file);

                                // 2. 深入解压出来的文件夹，揪出实际能运行的 java.exe
                                let mut new_java_path = String::new();
                                for entry in walkdir::WalkDir::new(&extract_target).into_iter().filter_map(|e| e.ok()) {
                                    let p = entry.path();
                                    let is_java = if env::consts::OS == "windows" { p.is_file() && p.file_name().unwrap_or_default() == "java.exe" } else { p.is_file() && p.file_name().unwrap_or_default() == "java" };
                                    if is_java { new_java_path = p.to_string_lossy().to_string(); break; }
                                }
                                return Ok(new_java_path);
                            }
                            Err("Java 压缩包解压失败，文件可能已损坏".to_string())
                        }).await;

                        let _ = tokio::fs::remove_file(&target_file).await;

                        match extract_result {
                            Ok(Ok(new_java_path)) => {
                                let _ = app.emit("resource-download-progress", ResourceDownloadEvent { task_id: "java_download".to_string(), file_name: file_name.clone(), stage: "DONE".to_string(), current: actual_size, total: actual_size, message: format!("Java {} 部署完成！", version) });
                                
                                // ✅ 将找到的新 Java 路径发给前端，通知它设为默认
                                if !new_java_path.is_empty() {
                                    let _ = app.emit("java-installed-auto-set", new_java_path);
                                }
                            },
                            Ok(Err(e)) => emit_err(&e),
                            _ => emit_err("解压线程意外崩溃"),
                        }
                    }
                }
            },
            _ => emit_err("下载服务器拒绝连接或超时"),
        }
    });

    Ok(())
}

fn extract_archive(archive_path: &Path, extract_to: &Path, is_zip: bool) -> Result<(), String> {
    std::fs::create_dir_all(extract_to).map_err(|e| e.to_string())?;
    let file = std::fs::File::open(archive_path).map_err(|e| e.to_string())?;
    if is_zip {
        let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
        archive.extract(extract_to).map_err(|e| e.to_string())?;
    } else {
        let tar = flate2::read::GzDecoder::new(file);
        let mut archive = tar::Archive::new(tar);
        archive.unpack(extract_to).map_err(|e| e.to_string())?;
    }
    Ok(())
}