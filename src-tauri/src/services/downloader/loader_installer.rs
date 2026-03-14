// src-tauri/src/services/downloader/loader_installer.rs
use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::AsyncBufReadExt;
use tokio::process::Command;

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
        install_neoforge(app, instance_id, loader_version, global_mc_root, cancel).await?;
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
    let client = reqwest::Client::new();

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
                current: 90,
                total: 100,
                message: format!("正在配置 Fabric {} 环境...", loader_version),
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
    let client = reqwest::Client::new();

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 20,
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
            current: 60,
            total: 100,
            message: "正在后台静默编译 Forge 运行环境，此过程可能需要几分钟，请耐心等待..."
                .to_string(),
        },
    );

    let java_path = if java_settings.java_path.is_empty() || java_settings.java_path == "auto" {
        "java".to_string()
    } else {
        java_settings.java_path.clone()
    };

    let mut child = Command::new(&java_path)
        .arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(global_mc_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("启动 Java 安装器失败: {}", e),
            )
        })?;

    if let Some(stdout) = child.stdout.take() {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        let cancel_for_reader = Arc::clone(cancel);
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_for_reader) {
                    break;
                }
                println!("[Forge] {}", line);
            }
        });
    }

    // 在等待子进程期间，周期性检查取消标志
    loop {
        if is_cancelled(cancel) {
            let _ = child.kill().await;
            let _ = tokio::fs::remove_file(&installer_path).await;
            return Err(AppError::Cancelled);
        }
        // 非阻塞检查子进程是否已退出
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
                // 子进程仍在运行，短暂等待后重试
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

    Ok(())
}

async fn install_neoforge<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    loader_version: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let dl_settings = ConfigService::get_download_settings(app);
    let java_settings = ConfigService::get_java_settings(app);
    let client = reqwest::Client::new();

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: "".to_string(),
            current: 20,
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
            current: 60,
            total: 100,
            message: "正在后台静默编译 NeoForge 运行环境...".to_string(),
        },
    );

    let java_path = if java_settings.java_path.is_empty() || java_settings.java_path == "auto" {
        "java".to_string()
    } else {
        java_settings.java_path.clone()
    };

    let mut child = Command::new(&java_path)
        .arg("-jar")
        .arg(&installer_path)
        .arg("--installClient")
        .arg(global_mc_root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("启动 Java 安装器失败: {}", e),
            )
        })?;

    if let Some(stdout) = child.stdout.take() {
        let mut reader = tokio::io::BufReader::new(stdout).lines();
        let cancel_for_reader = Arc::clone(cancel);
        tokio::spawn(async move {
            while let Ok(Some(line)) = reader.next_line().await {
                if is_cancelled(&cancel_for_reader) {
                    break;
                }
                println!("[NeoForge] {}", line);
            }
        });
    }

    // 在等待子进程期间，周期性检查取消标志
    loop {
        if is_cancelled(cancel) {
            let _ = child.kill().await;
            let _ = tokio::fs::remove_file(&installer_path).await;
            return Err(AppError::Cancelled);
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

    Ok(())
}
