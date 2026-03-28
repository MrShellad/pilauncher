// src-tauri/src/services/downloader/loader_installer.rs
use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::logging::resolve_logs_dir;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;

fn build_download_client(dl_settings: &DownloadSettings) -> AppResult<reqwest::Client> {
    let mut builder = reqwest::Client::builder()
        .user_agent("PiLauncher/1.0 (Loader Installer)")
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)));

    if dl_settings.proxy_type != "none" {
        let host = dl_settings.proxy_host.trim();
        let port = dl_settings.proxy_port.trim();
        if !host.is_empty() && !port.is_empty() {
            let scheme = match dl_settings.proxy_type.as_str() {
                "http" => "http",
                "https" => "https",
                "socks5" => "socks5h",
                _ => "http",
            };
            let proxy_url = format!("{}://{}:{}", scheme, host, port);
            builder = builder.proxy(reqwest::Proxy::all(&proxy_url)?);
        }
    }

    Ok(builder.build()?)
}

pub async fn install_loader<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_type: &str,
    loader_version: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    if loader_type.eq_ignore_ascii_case("Vanilla") || loader_version.is_empty() {
        return Ok(());
    }

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    if loader_type.eq_ignore_ascii_case("Fabric") {
        install_fabric(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    } else if loader_type.eq_ignore_ascii_case("Forge") {
        install_forge(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    } else if loader_type.eq_ignore_ascii_case("NeoForge") {
        install_neoforge(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    }

    Ok(())
}

async fn install_fabric<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_version: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let client = build_download_client(&dl_settings)?;

    let version_id = format!("fabric-loader-{}-{}", loader_version, mc_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    tokio::fs::create_dir_all(&version_dir).await?;
    let json_path = version_dir.join(format!("{}.json", version_id));

    if !json_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "LOADER_CORE".to_string(),
                file_name: format!("{}.json", version_id),
                current: 10,
                total: 100,
                message: format!("正在下载 Fabric {} 配置清单...", loader_version),
            },
        );

        // 根据配置选择官方或镜像源
        let base_meta_url = if dl_settings.fabric_source == "official" {
            "https://meta.fabricmc.net".to_string()
        } else {
            "https://bmclapi2.bangbang93.com/fabric-meta".to_string() // 兼容 BMCLAPI
        };

        let meta_url = format!(
            "{}/v2/versions/loader/{}/{}/profile/json",
            base_meta_url, mc_version, loader_version
        );
        let profile_json_text = client.get(&meta_url).send().await?.text().await?;
        tokio::fs::write(&json_path, &profile_json_text).await?;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "LOADER_CORE".to_string(),
                file_name: version_id.clone(),
                current: 40,
                total: 100,
                message: "配置清单已就绪，正在下载 Fabric 依赖...".to_string(),
            },
        );
    }

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    // 复用依赖下载器拉取 fabric 核心包
    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &version_id,
        global_mc_root,
        cancel,
    )
    .await?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: version_id.clone(),
            current: 100,
            total: 100,
            message: "Fabric 环境部署完成".to_string(),
        },
    );

    Ok(())
}

async fn install_forge<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_version: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let java_settings = ConfigService::get_java_settings(app);
    let java_runtime = crate::services::runtime_service::resolve_global_java_runtime(
        &java_settings,
        mc_version,
        crate::services::runtime_service::installer_default_java_command(),
    );
    let client = build_download_client(&dl_settings)?;

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "installer.jar".to_string(),
            current: 5,
            total: 100,
            message: format!("正在下载 Forge {} 安装器...", loader_version),
        },
    );

    let installer_url = if dl_settings.forge_source == "official" {
        format!("https://maven.minecraftforge.net/net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar", mc_version, loader_version)
    } else {
        format!("https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar", mc_version, loader_version)
    };

    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("forge-installer-{}.jar", loader_version));

    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let res = client.get(&installer_url).send().await?.bytes().await?;
        tokio::fs::write(&installer_path, res).await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "installer.jar".to_string(),
            current: 30,
            total: 100,
            message: "安装器已就绪，正在准备安装...".to_string(),
        },
    );

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    // ✅ 核心修复：伪造官方 launcher_profiles.json，骗过 Forge 安装器的校验
    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 50,
            total: 100,
            message: "正在后台静默编译 Forge 运行环境，此过程可能需要几分钟，请耐心等待..."
                .to_string(),
        },
    );

    let java_path = java_runtime.java_path.clone();

    let mut cmd = Command::new(&java_path);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(global_mc_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(logs_dir) = resolve_logs_dir(app) {
        let _ = tokio::fs::create_dir_all(&logs_dir).await;
        cmd.current_dir(logs_dir);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn().map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("启动 Java 安装器失败: {}", e),
        )
    })?;

    let app_emit = app.clone();
    let instance_id_emit = instance_id.to_string();

    if let Some(stdout) = child.stdout.take() {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        let cancel_for_reader = Arc::clone(cancel);
        let app_stdout = app_emit.clone();
        let id_stdout = instance_id_emit.clone();
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_for_reader) {
                    break;
                }
                let msg = line.trim().to_string();
                if !msg.is_empty() {
                    let _ = app_stdout.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: id_stdout.clone(),
                            stage: "LOADER_CORE".to_string(),
                            file_name: String::new(),
                            current: 50,
                            total: 100,
                            message: msg,
                        },
                    );
                }
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        let cancel_err = Arc::clone(cancel);
        let app_stderr = app_emit.clone();
        let id_stderr = instance_id_emit.clone();
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_err) {
                    break;
                }
                let msg = line.trim().to_string();
                if !msg.is_empty() {
                    let _ = app_stderr.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: id_stderr.clone(),
                            stage: "LOADER_CORE".to_string(),
                            file_name: String::new(),
                            current: 50,
                            total: 100,
                            message: format!("[stderr] {}", msg),
                        },
                    );
                }
            }
        });
    }

    // 在等待子进程期间，周期性检查取消标志并发送心跳，避免用户误以为卡死
    let wait_start = Instant::now();
    let mut last_heartbeat = wait_start;
    loop {
        if is_cancelled(cancel) {
            let _ = child.kill().await;
            let _ = tokio::fs::remove_file(&installer_path).await;
            return Err(AppError::Cancelled);
        }
        if last_heartbeat.elapsed().as_secs() >= 10 {
            last_heartbeat = Instant::now();
            let elapsed_10s = wait_start.elapsed().as_secs() / 10;
            let sub = (elapsed_10s as u64).min(40);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.to_string(),
                    stage: "LOADER_CORE".to_string(),
                    file_name: String::new(),
                    current: 50 + sub,
                    total: 100,
                    message: "仍在安装 Forge 运行环境，请稍候…".to_string(),
                },
            );
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "Forge 安装器执行失败，请检查控制台日志",
                    )
                    .into());
                }
                break;
            }
            Ok(None) => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            Err(e) => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("检查 Forge 安装器状态失败: {}", e),
                )
                .into());
            }
        }
    }

    let _ = tokio::fs::remove_file(&installer_path).await; // 清理残留

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "Forge 环境部署完成".to_string(),
        },
    );

    Ok(())
}

async fn install_neoforge<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_version: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let java_settings = ConfigService::get_java_settings(app);
    let java_runtime = crate::services::runtime_service::resolve_global_java_runtime(
        &java_settings,
        mc_version,
        crate::services::runtime_service::installer_default_java_command(),
    );
    let client = build_download_client(&dl_settings)?;

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "installer.jar".to_string(),
            current: 5,
            total: 100,
            message: format!("正在下载 NeoForge {} 安装器...", loader_version),
        },
    );

    let installer_url = if dl_settings.neoforge_source == "official" {
        format!("https://maven.neoforged.net/releases/net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar", loader_version)
    } else {
        format!("https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar", loader_version)
    };

    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("neoforge-installer-{}.jar", loader_version));

    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let res = client.get(&installer_url).send().await?.bytes().await?;
        tokio::fs::write(&installer_path, res).await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "installer.jar".to_string(),
            current: 30,
            total: 100,
            message: "安装器已就绪，正在准备安装...".to_string(),
        },
    );

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    // ✅ 核心修复：伪造官方 launcher_profiles.json，骗过 NeoForge 安装器的校验
    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 50,
            total: 100,
            message: "正在后台静默编译 NeoForge 运行环境...".to_string(),
        },
    );

    let java_path = java_runtime.java_path.clone();

    let mut cmd = Command::new(&java_path);
    cmd.arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(global_mc_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(logs_dir) = resolve_logs_dir(app) {
        let _ = tokio::fs::create_dir_all(&logs_dir).await;
        cmd.current_dir(logs_dir);
    }

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let mut child = cmd.spawn().map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("启动 Java 安装器失败: {}", e),
        )
    })?;

    let app_emit = app.clone();
    let instance_id_emit = instance_id.to_string();

    if let Some(stdout) = child.stdout.take() {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        let cancel_for_reader = Arc::clone(cancel);
        let app_stdout = app_emit.clone();
        let id_stdout = instance_id_emit.clone();
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_for_reader) {
                    break;
                }
                let msg = line.trim().to_string();
                if !msg.is_empty() {
                    let _ = app_stdout.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: id_stdout.clone(),
                            stage: "LOADER_CORE".to_string(),
                            file_name: String::new(),
                            current: 50,
                            total: 100,
                            message: msg,
                        },
                    );
                }
            }
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let mut reader = tokio::io::BufReader::new(stderr).lines();
        let cancel_err = Arc::clone(cancel);
        let app_stderr = app_emit.clone();
        let id_stderr = instance_id_emit.clone();
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_err) {
                    break;
                }
                let msg = line.trim().to_string();
                if !msg.is_empty() {
                    let _ = app_stderr.emit(
                        "instance-deployment-progress",
                        DownloadProgressEvent {
                            instance_id: id_stderr.clone(),
                            stage: "LOADER_CORE".to_string(),
                            file_name: String::new(),
                            current: 50,
                            total: 100,
                            message: format!("[stderr] {}", msg),
                        },
                    );
                }
            }
        });
    }

    let wait_start = Instant::now();
    let mut last_heartbeat = wait_start;
    loop {
        if is_cancelled(cancel) {
            let _ = child.kill().await;
            let _ = tokio::fs::remove_file(&installer_path).await;
            return Err(AppError::Cancelled);
        }
        if last_heartbeat.elapsed().as_secs() >= 10 {
            last_heartbeat = Instant::now();
            let elapsed_10s = wait_start.elapsed().as_secs() / 10;
            let sub = (elapsed_10s as u64).min(40);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.to_string(),
                    stage: "LOADER_CORE".to_string(),
                    file_name: String::new(),
                    current: 50 + sub,
                    total: 100,
                    message: "仍在安装 NeoForge 运行环境，请稍候…".to_string(),
                },
            );
        }
        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    return Err(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "NeoForge 安装器执行失败",
                    )
                    .into());
                }
                break;
            }
            Ok(None) => {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            Err(e) => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("检查 NeoForge 安装器状态失败: {}", e),
                )
                .into());
            }
        }
    }

    let _ = tokio::fs::remove_file(&installer_path).await;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "NeoForge 环境部署完成".to_string(),
        },
    );

    Ok(())
}
