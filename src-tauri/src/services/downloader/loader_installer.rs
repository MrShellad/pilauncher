use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::logging::resolve_logs_dir;
use std::path::Path;
use std::process::Stdio;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

const INSTALLER_OUTPUT_BUFFER_LIMIT: usize = 20;

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

fn normalize_source_base(url: &str) -> Option<String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn push_unique_url(urls: &mut Vec<String>, url: String) {
    if !urls.iter().any(|existing| existing == &url) {
        urls.push(url);
    }
}

fn replace_trailing_segment(base: &str, from: &str, to: &str) -> Option<String> {
    let suffix = format!("/{}", from);
    base.strip_suffix(&suffix)
        .map(|prefix| format!("{}/{}", prefix, to))
}

fn source_base_candidates(
    selected_source: &str,
    selected_url: &str,
    official_base: &str,
    mirror_base: Option<&str>,
) -> Vec<String> {
    let mut bases = Vec::new();

    if let Some(base) = normalize_source_base(selected_url) {
        push_unique_url(&mut bases, base);
    }

    match selected_source {
        "official" => {
            push_unique_url(&mut bases, official_base.to_string());
            if let Some(mirror_base) = mirror_base {
                push_unique_url(&mut bases, mirror_base.to_string());
            }
        }
        "bmclapi" => {
            if let Some(mirror_base) = mirror_base {
                push_unique_url(&mut bases, mirror_base.to_string());
            }
            push_unique_url(&mut bases, official_base.to_string());
        }
        _ => {
            if let Some(mirror_base) = mirror_base {
                push_unique_url(&mut bases, mirror_base.to_string());
            }
            push_unique_url(&mut bases, official_base.to_string());
        }
    }

    if bases.is_empty() {
        push_unique_url(&mut bases, official_base.to_string());
        if let Some(mirror_base) = mirror_base {
            push_unique_url(&mut bases, mirror_base.to_string());
        }
    }

    bases
}

fn fabric_profile_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    const FABRIC_OFFICIAL_BASE: &str = "https://meta.fabricmc.net";
    const FABRIC_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/fabric-meta";

    source_base_candidates(
        &dl_settings.fabric_source,
        &dl_settings.fabric_source_url,
        FABRIC_OFFICIAL_BASE,
        Some(FABRIC_BMCLAPI_BASE),
    )
    .into_iter()
    .map(|base| {
        format!(
            "{}/v2/versions/loader/{}/{}/profile/json",
            base, mc_version, loader_version
        )
    })
    .collect()
}

fn append_forge_installer_urls(
    urls: &mut Vec<String>,
    base: &str,
    mc_version: &str,
    loader_version: &str,
) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar",
        mc_version, loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "forge", "maven") {
        push_unique_url(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique_url(urls, format!("{}/{}", base, artifact_path));
}

fn forge_installer_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    const FORGE_OFFICIAL_BASE: &str = "https://maven.minecraftforge.net";
    const FORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/forge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.forge_source,
        &dl_settings.forge_source_url,
        FORGE_OFFICIAL_BASE,
        Some(FORGE_BMCLAPI_BASE),
    ) {
        append_forge_installer_urls(&mut urls, &base, mc_version, loader_version);
    }
    urls
}

fn append_neoforge_installer_urls(urls: &mut Vec<String>, base: &str, loader_version: &str) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar",
        loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "neoforge", "maven") {
        push_unique_url(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique_url(urls, format!("{}/{}", base, artifact_path));
}

fn neoforge_installer_urls(dl_settings: &DownloadSettings, loader_version: &str) -> Vec<String> {
    const NEOFORGE_OFFICIAL_BASE: &str = "https://maven.neoforged.net/releases";
    const NEOFORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/neoforge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.neoforge_source,
        &dl_settings.neoforge_source_url,
        NEOFORGE_OFFICIAL_BASE,
        Some(NEOFORGE_BMCLAPI_BASE),
    ) {
        append_neoforge_installer_urls(&mut urls, &base, loader_version);
    }
    urls
}

async fn send_from_candidates(
    client: &reqwest::Client,
    urls: &[String],
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<reqwest::Response> {
    let attempts = max_attempts.max(1);
    let mut errors = Vec::new();

    for round in 1..=attempts {
        for url in urls {
            if is_cancelled(cancel) {
                return Err(AppError::Cancelled);
            }

            match client.get(url).send().await {
                Ok(response) if response.status().is_success() => return Ok(response),
                Ok(response) => {
                    errors.push(format!(
                        "[attempt {}] {} -> {}",
                        round,
                        url,
                        response.status()
                    ));
                }
                Err(err) => {
                    errors.push(format!("[attempt {}] {} -> {}", round, url, err));
                }
            }
        }
    }

    let detail = errors.into_iter().take(6).collect::<Vec<_>>().join(" | ");
    let detail = if detail.is_empty() {
        "no candidate URL available".to_string()
    } else {
        detail
    };

    Err(AppError::Generic(format!(
        "Failed to download loader resource from all candidate sources: {}",
        detail
    )))
}

async fn download_text_from_candidates(
    client: &reqwest::Client,
    urls: &[String],
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<String> {
    let response = send_from_candidates(client, urls, max_attempts, cancel).await?;
    Ok(response.text().await?)
}

async fn download_bytes_from_candidates(
    client: &reqwest::Client,
    urls: &[String],
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<Vec<u8>> {
    let response = send_from_candidates(client, urls, max_attempts, cancel).await?;
    Ok(response.bytes().await?.to_vec())
}

fn remember_installer_output(lines: &Arc<Mutex<Vec<String>>>, line: String) {
    let mut guard = lines.lock().unwrap();
    guard.push(line);
    if guard.len() > INSTALLER_OUTPUT_BUFFER_LIMIT {
        let overflow = guard.len() - INSTALLER_OUTPUT_BUFFER_LIMIT;
        guard.drain(0..overflow);
    }
}

fn summarize_installer_output(lines: &Arc<Mutex<Vec<String>>>) -> Option<String> {
    let guard = lines.lock().unwrap();
    if guard.is_empty() {
        None
    } else {
        Some(guard.join(" | "))
    }
}

fn spawn_installer_stream_reader<R, T>(
    app: AppHandle<R>,
    instance_id: String,
    cancel: Arc<AtomicBool>,
    stream: T,
    prefix: Option<&'static str>,
    recent_output: Arc<Mutex<Vec<String>>>,
) where
    R: Runtime,
    T: tokio::io::AsyncRead + Unpin + Send + 'static,
{
    tokio::spawn(async move {
        let mut reader = BufReader::new(stream).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            if is_cancelled(&cancel) {
                break;
            }

            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            remember_installer_output(&recent_output, trimmed.to_string());

            let message = match prefix {
                Some(prefix) => format!("{}{}", prefix, trimmed),
                None => trimmed.to_string(),
            };

            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: instance_id.clone(),
                    stage: "LOADER_CORE".to_string(),
                    file_name: String::new(),
                    current: 50,
                    total: 100,
                    message,
                },
            );
        }
    });
}

async fn run_java_installer<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    loader_name: &str,
    java_path: &str,
    required_java_major: &str,
    installer_path: &Path,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let mut cmd = Command::new(java_path);
    cmd.arg("-jar")
        .arg(installer_path)
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
        AppError::Generic(format!(
            "启动 {} Java 安装器失败。当前为 Minecraft 选择的 Java {} 路径是: {}。请检查 Java 配置或该路径是否仍然存在。底层错误: {}",
            loader_name, required_java_major, java_path, e
        ))
    })?;

    let recent_output = Arc::new(Mutex::new(Vec::new()));

    if let Some(stdout) = child.stdout.take() {
        spawn_installer_stream_reader(
            app.clone(),
            instance_id.to_string(),
            Arc::clone(cancel),
            stdout,
            None,
            Arc::clone(&recent_output),
        );
    }

    if let Some(stderr) = child.stderr.take() {
        spawn_installer_stream_reader(
            app.clone(),
            instance_id.to_string(),
            Arc::clone(cancel),
            stderr,
            Some("[stderr] "),
            Arc::clone(&recent_output),
        );
    }

    let wait_start = Instant::now();
    let mut last_heartbeat = wait_start;
    loop {
        if is_cancelled(cancel) {
            let _ = child.kill().await;
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
                    message: format!("仍在安装 {} 运行环境，请稍候...", loader_name),
                },
            );
        }

        match child.try_wait() {
            Ok(Some(status)) => {
                if !status.success() {
                    let status_text = status
                        .code()
                        .map(|code| format!("退出码 {}", code))
                        .unwrap_or_else(|| "进程被异常终止".to_string());
                    let detail = summarize_installer_output(&recent_output)
                        .unwrap_or_else(|| "安装器没有输出更多细节，请检查下载日志。".to_string());
                    return Err(AppError::Generic(format!(
                        "{} 安装器执行失败（{}）。使用的 Java 路径: {}。最近输出: {}",
                        loader_name, status_text, java_path, detail
                    )));
                }
                break;
            }
            Ok(None) => {
                tokio::time::sleep(Duration::from_millis(500)).await;
            }
            Err(e) => {
                return Err(AppError::Generic(format!(
                    "检查 {} 安装器状态失败。使用的 Java 路径: {}。底层错误: {}",
                    loader_name, java_path, e
                )));
            }
        }
    }

    Ok(())
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
    let max_attempts = dl_settings.retry_count.max(1);

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

        let meta_urls = fabric_profile_urls(&dl_settings, mc_version, loader_version);
        let profile_json_text =
            download_text_from_candidates(&client, &meta_urls, max_attempts, cancel).await?;
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
    let java_runtime = crate::services::runtime_service::resolve_global_installer_java_runtime(
        &java_settings,
        mc_version,
        crate::services::runtime_service::installer_default_java_command(),
    );
    let client = build_download_client(&dl_settings)?;
    let max_attempts = dl_settings.retry_count.max(1);

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

    let installer_urls = forge_installer_urls(&dl_settings, mc_version, loader_version);

    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("forge-installer-{}.jar", loader_version));

    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let res =
            download_bytes_from_candidates(&client, &installer_urls, max_attempts, cancel).await?;
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

    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: String::new(),
            current: 50,
            total: 100,
            message: "正在后台静默安装 Forge 运行环境，这个过程可能需要几分钟，请耐心等待..."
                .to_string(),
        },
    );

    run_java_installer(
        app,
        instance_id,
        "Forge",
        &java_runtime.java_path,
        &java_runtime.required_java_major,
        &installer_path,
        global_mc_root,
        cancel,
    )
    .await?;

    let _ = tokio::fs::remove_file(&installer_path).await;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: String::new(),
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
    let java_runtime = crate::services::runtime_service::resolve_global_installer_java_runtime(
        &java_settings,
        mc_version,
        crate::services::runtime_service::installer_default_java_command(),
    );
    let client = build_download_client(&dl_settings)?;
    let max_attempts = dl_settings.retry_count.max(1);

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

    let installer_urls = neoforge_installer_urls(&dl_settings, loader_version);

    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("neoforge-installer-{}.jar", loader_version));

    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let res =
            download_bytes_from_candidates(&client, &installer_urls, max_attempts, cancel).await?;
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

    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: String::new(),
            current: 50,
            total: 100,
            message: "正在后台静默安装 NeoForge 运行环境，请稍候...".to_string(),
        },
    );

    run_java_installer(
        app,
        instance_id,
        "NeoForge",
        &java_runtime.java_path,
        &java_runtime.required_java_major,
        &installer_path,
        global_mc_root,
        cancel,
    )
    .await?;

    let _ = tokio::fs::remove_file(&installer_path).await;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: String::new(),
            current: 100,
            total: 100,
            message: "NeoForge 环境部署完成".to_string(),
        },
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fabric_profile_urls_prioritize_selected_source_then_fallbacks() {
        let mut settings = DownloadSettings::default();
        settings.fabric_source = "custom".to_string();
        settings.fabric_source_url = "https://mirror.example.com/fabric-meta/".to_string();

        let urls = fabric_profile_urls(&settings, "1.20.1", "0.16.10");

        assert_eq!(
            urls,
            vec![
                "https://mirror.example.com/fabric-meta/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
                "https://meta.fabricmc.net/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
            ]
        );
    }

    #[test]
    fn forge_installer_urls_use_configured_base_and_maven_fallback_shape() {
        let mut settings = DownloadSettings::default();
        settings.forge_source = "custom".to_string();
        settings.forge_source_url = "https://mirror.example.com/forge".to_string();

        let urls = forge_installer_urls(&settings, "1.20.1", "47.4.18");

        assert_eq!(
            urls,
            vec![
                "https://mirror.example.com/maven/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://mirror.example.com/forge/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/forge/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
            ]
        );
    }

    #[test]
    fn neoforge_installer_urls_use_configured_base_and_maven_fallback_shape() {
        let mut settings = DownloadSettings::default();
        settings.neoforge_source = "custom".to_string();
        settings.neoforge_source_url = "https://mirror.example.com/neoforge".to_string();

        let urls = neoforge_installer_urls(&settings, "21.1.133");

        assert_eq!(
            urls,
            vec![
                "https://mirror.example.com/maven/net/neoforged/neoforge/21.1.133/neoforge-21.1.133-installer.jar"
                    .to_string(),
                "https://mirror.example.com/neoforge/net/neoforged/neoforge/21.1.133/neoforge-21.1.133-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/21.1.133/neoforge-21.1.133-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/neoforge/net/neoforged/neoforge/21.1.133/neoforge-21.1.133-installer.jar"
                    .to_string(),
                "https://maven.neoforged.net/releases/net/neoforged/neoforge/21.1.133/neoforge-21.1.133-installer.jar"
                    .to_string(),
            ]
        );
    }
}
