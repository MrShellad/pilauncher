use crate::domain::event::DownloadProgressEvent;
use crate::error::{AppError, AppResult};
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::dependencies::scheduler::sha1_file;
use crate::services::downloader::logging::resolve_logs_dir;
use serde::Deserialize;
use serde_json::Value;
use std::env;
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

mod fabric;
mod forge;
mod neoforge;
mod quilt;

const INSTALLER_OUTPUT_BUFFER_LIMIT: usize = 20;

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NeoForgeBmclVersion {
    version: String,
    #[serde(default)]
    raw_version: Option<String>,
    #[serde(default)]
    installer_path: Option<String>,
}

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

#[allow(dead_code)]
fn fabric_profile_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    fabric::profile_urls(dl_settings, mc_version, loader_version)
}

#[allow(dead_code)]
fn forge_installer_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    forge::installer_urls(dl_settings, mc_version, loader_version)
}

#[allow(dead_code)]
fn neoforge_installer_urls(dl_settings: &DownloadSettings, loader_version: &str) -> Vec<String> {
    neoforge::installer_urls(dl_settings, loader_version)
}

#[allow(dead_code)]
fn normalize_neoforge_version_token(value: &str, mc_version: &str) -> String {
    let mut normalized = value.trim();
    if normalized.is_empty() {
        return String::new();
    }

    if let Some(stripped) = normalized.strip_prefix("neoforge-") {
        normalized = stripped;
    }

    let mc_prefix = format!("{}-", mc_version);
    if let Some(stripped) = normalized.strip_prefix(&mc_prefix) {
        normalized = stripped;
    }

    if let Some(stripped) = normalized.strip_prefix("forge-") {
        normalized = stripped;
    }

    normalized.trim().to_string()
}

#[allow(dead_code)]
fn neoforge_entry_matches(
    entry: &NeoForgeBmclVersion,
    mc_version: &str,
    requested_version: &str,
) -> bool {
    let requested = normalize_neoforge_version_token(requested_version, mc_version);
    if requested.is_empty() {
        return false;
    }

    let mut candidates = vec![entry.version.as_str()];
    if let Some(raw_version) = entry.raw_version.as_deref() {
        candidates.push(raw_version);
    }

    candidates.into_iter().any(|candidate| {
        let candidate_norm = normalize_neoforge_version_token(candidate, mc_version);
        !candidate_norm.is_empty() && candidate_norm == requested
    })
}

#[allow(dead_code)]
fn url_origin(url: &str) -> Option<String> {
    let parsed = reqwest::Url::parse(url).ok()?;
    let host = parsed.host_str()?;
    let mut origin = format!("{}://{}", parsed.scheme(), host);
    if let Some(port) = parsed.port() {
        origin.push(':');
        origin.push_str(&port.to_string());
    }
    Some(origin)
}

#[allow(dead_code)]
fn append_neoforge_bmcl_installer_urls(
    urls: &mut Vec<String>,
    api_base: &str,
    entry: &NeoForgeBmclVersion,
) {
    let Some(api_base) = normalize_source_base(api_base) else {
        return;
    };

    push_unique_url(
        urls,
        format!("{}/version/{}/download/installer.jar", api_base, entry.version),
    );

    if let Some(installer_path) = entry.installer_path.as_deref() {
        let installer_path = installer_path.trim();
        if installer_path.starts_with("http://") || installer_path.starts_with("https://") {
            push_unique_url(urls, installer_path.to_string());
        } else if installer_path.starts_with('/') {
            if let Some(origin) = url_origin(&api_base) {
                push_unique_url(urls, format!("{}{}", origin, installer_path));
            }
        }
    }
}

#[allow(dead_code)]
async fn resolve_neoforge_installer_urls(
    client: &reqwest::Client,
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<Vec<String>> {
    neoforge::resolve_installer_urls(
        client,
        dl_settings,
        mc_version,
        loader_version,
        max_attempts,
        cancel,
    )
    .await
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

async fn load_or_download_installer_archive(
    client: &reqwest::Client,
    candidate_urls: &[String],
    installer_path: &Path,
    required_entries: &[&str],
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<Vec<u8>> {
    if installer_path.exists() {
        if let Ok(installer_bytes) = tokio::fs::read(installer_path).await {
            if required_entries
                .iter()
                .all(|entry_name| extract_zip_entry_text(&installer_bytes, entry_name).is_ok())
            {
                return Ok(installer_bytes);
            }
        }

        let _ = tokio::fs::remove_file(installer_path).await;
    }

    let installer_bytes =
        download_bytes_from_candidates(client, candidate_urls, max_attempts, cancel).await?;

    for entry_name in required_entries {
        extract_zip_entry_text(&installer_bytes, entry_name)?;
    }

    tokio::fs::write(installer_path, &installer_bytes).await?;
    Ok(installer_bytes)
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

            emit_loader_progress(&app, &instance_id, String::new(), 50, 100, message);
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
            emit_loader_progress(
                app,
                instance_id,
                String::new(),
                50 + sub,
                100,
                format!("仍在安装 {} 运行环境，请稍候...", loader_name),
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

fn extract_zip_entry_text(archive_bytes: &[u8], entry_name: &str) -> AppResult<String> {
    let cursor = Cursor::new(archive_bytes);
    let mut archive = zip::ZipArchive::new(cursor)
        .map_err(|e| AppError::Generic(format!("Invalid loader installer archive: {}", e)))?;
    let mut entry = archive.by_name(entry_name).map_err(|e| {
        AppError::Generic(format!(
            "Missing {} in loader installer archive: {}",
            entry_name, e
        ))
    })?;

    let mut text = String::new();
    entry.read_to_string(&mut text)?;
    Ok(text)
}

fn extract_zip_entry_json(archive_bytes: &[u8], entry_name: &str) -> AppResult<Value> {
    let text = extract_zip_entry_text(archive_bytes, entry_name)?;
    Ok(serde_json::from_str(&text)?)
}

fn prepare_loader_version_json(raw_json: &str, expected_version_id: &str) -> AppResult<String> {
    let mut json: Value = serde_json::from_str(raw_json)?;
    json["id"] = Value::String(expected_version_id.to_string());
    Ok(serde_json::to_string_pretty(&json)?)
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct LoaderFileExpectation {
    name: String,
    path: PathBuf,
    expected_size: Option<u64>,
    expected_sha1: Option<String>,
}

fn get_mc_os() -> &'static str {
    match env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => env::consts::OS,
    }
}

fn get_mc_arch() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "64",
        "x86" => "32",
        "aarch64" => "arm64",
        _ => env::consts::ARCH,
    }
}

fn evaluate_library_rules(rules: Option<&Vec<Value>>) -> bool {
    let Some(rules) = rules else {
        return true;
    };

    let current_os = get_mc_os();
    let mut is_allowed = false;

    for rule in rules {
        let action = rule["action"].as_str().unwrap_or("disallow");
        let os_match = match rule.get("os") {
            Some(os_obj) => os_obj["name"].as_str().unwrap_or("") == current_os,
            None => true,
        };

        if os_match {
            is_allowed = action == "allow";
        }
    }

    is_allowed
}

fn legacy_library_download_path(name: &str, classifier: Option<&str>) -> Option<String> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    Some(match classifier {
        Some(classifier) => format!(
            "{}/{}/{}/{}-{}-{}.jar",
            group, artifact, version, artifact, version, classifier
        ),
        None => format!(
            "{}/{}/{}/{}-{}.jar",
            group, artifact, version, artifact, version
        ),
    })
}

fn push_loader_file_expectation(
    expectations: &mut Vec<LoaderFileExpectation>,
    path: PathBuf,
    name: String,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
) {
    let expected_sha1 = expected_sha1
        .map(str::trim)
        .filter(|sha1| !sha1.is_empty())
        .map(|sha1| sha1.to_lowercase());

    if let Some(existing) = expectations.iter_mut().find(|item| item.path == path) {
        if existing.expected_size.is_none() {
            existing.expected_size = expected_size;
        }
        if existing.expected_sha1.is_none() {
            existing.expected_sha1 = expected_sha1;
        }
        if existing.name.is_empty() {
            existing.name = name;
        }
        return;
    }

    expectations.push(LoaderFileExpectation {
        name,
        path,
        expected_size,
        expected_sha1,
    });
}

fn collect_loader_file_expectations(
    manifest: &Value,
    global_mc_root: &Path,
) -> Vec<LoaderFileExpectation> {
    let mut expectations = Vec::new();

    let Some(libraries) = manifest["libraries"].as_array() else {
        return expectations;
    };

    for lib in libraries {
        let name = lib["name"].as_str().unwrap_or("");
        if name.is_empty() || !evaluate_library_rules(lib["rules"].as_array()) {
            continue;
        }

        if let Some(artifact) = lib.pointer("/downloads/artifact") {
            let dl_path = artifact["path"].as_str().unwrap_or("").trim();
            if !dl_path.is_empty() {
                push_loader_file_expectation(
                    &mut expectations,
                    global_mc_root.join("libraries").join(dl_path),
                    name.to_string(),
                    artifact["size"].as_u64(),
                    artifact["sha1"].as_str(),
                );
            }
        } else if lib.get("downloads").is_none() {
            if let Some(dl_path) = legacy_library_download_path(name, None) {
                push_loader_file_expectation(
                    &mut expectations,
                    global_mc_root.join("libraries").join(dl_path),
                    name.to_string(),
                    None,
                    None,
                );
            }
        }

        if let Some(natives) = lib["natives"].as_object() {
            let current_os = get_mc_os();
            if let Some(classifier_val) = natives.get(current_os) {
                let mut classifier_key = classifier_val.as_str().unwrap_or("").to_string();
                if classifier_key.contains("${arch}") {
                    classifier_key = classifier_key.replace("${arch}", get_mc_arch());
                }

                if let Some(classifier_obj) =
                    lib.pointer(&format!("/downloads/classifiers/{}", classifier_key))
                {
                    let dl_path = classifier_obj["path"].as_str().unwrap_or("").trim();
                    if !dl_path.is_empty() {
                        push_loader_file_expectation(
                            &mut expectations,
                            global_mc_root.join("libraries").join(dl_path),
                            format!("{}-{}", name, classifier_key),
                            classifier_obj["size"].as_u64(),
                            classifier_obj["sha1"].as_str(),
                        );
                    }
                } else if lib.get("downloads").is_none() {
                    if let Some(dl_path) = legacy_library_download_path(name, Some(&classifier_key))
                    {
                        push_loader_file_expectation(
                            &mut expectations,
                            global_mc_root.join("libraries").join(dl_path),
                            format!("{}-{}", name, classifier_key),
                            None,
                            None,
                        );
                    }
                }
            }
        }
    }

    expectations
}

async fn scan_loader_installation_issues(
    manifest: &Value,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<Vec<String>> {
    let mut issues = Vec::new();

    if let Some(parent_version) = manifest["inheritsFrom"].as_str() {
        let parent_json = global_mc_root
            .join("versions")
            .join(parent_version)
            .join(format!("{}.json", parent_version));
        if !parent_json.exists() {
            issues.push(format!(
                "missing inherited version manifest: {}",
                parent_json.display()
            ));
        }
    }

    for expectation in collect_loader_file_expectations(manifest, global_mc_root) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        if !expectation.path.exists() {
            issues.push(format!(
                "missing loader dependency: {} ({})",
                expectation.name,
                expectation.path.display()
            ));
            continue;
        }

        let metadata = match tokio::fs::metadata(&expectation.path).await {
            Ok(metadata) => metadata,
            Err(err) => {
                issues.push(format!(
                    "failed to stat loader dependency: {} ({}) - {}",
                    expectation.name,
                    expectation.path.display(),
                    err
                ));
                continue;
            }
        };

        if let Some(expected_size) = expectation.expected_size {
            let actual_size = metadata.len();
            if actual_size != expected_size {
                let _ = tokio::fs::remove_file(&expectation.path).await;
                issues.push(format!(
                    "incomplete loader dependency: {} ({}) expected {} bytes, got {} bytes",
                    expectation.name,
                    expectation.path.display(),
                    expected_size,
                    actual_size
                ));
                continue;
            }
        }

        if let Some(expected_sha1) = expectation.expected_sha1.as_deref() {
            match sha1_file(&expectation.path).await {
                Ok(actual_sha1) if actual_sha1 == expected_sha1 => {}
                Ok(actual_sha1) => {
                    let _ = tokio::fs::remove_file(&expectation.path).await;
                    issues.push(format!(
                        "corrupted loader dependency: {} ({}) expected sha1 {}, got {}",
                        expectation.name,
                        expectation.path.display(),
                        expected_sha1,
                        actual_sha1
                    ));
                }
                Err(err) => {
                    issues.push(format!(
                        "failed to hash loader dependency: {} ({}) - {}",
                        expectation.name,
                        expectation.path.display(),
                        err
                    ));
                }
            }
        }
    }

    Ok(issues)
}

fn emit_loader_progress<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    file_name: impl Into<String>,
    current: u64,
    total: u64,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: file_name.into(),
            current,
            total,
            message: message.into(),
        },
    );
}

async fn verify_loader_installation<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    version_id: &str,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let manifest = crate::services::downloader::dependencies::load_version_manifest(
        global_mc_root,
        version_id,
    )
    .await?;

    verify_loader_manifest_integrity(
        app,
        instance_id,
        version_id,
        &manifest,
        global_mc_root,
        cancel,
        85,
        92,
    )
    .await
}

async fn verify_loader_manifest_integrity<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    manifest_label: &str,
    manifest: &Value,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
    scan_progress: u64,
    verify_progress: u64,
) -> AppResult<()> {
    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    emit_loader_progress(
        app,
        instance_id,
        manifest_label,
        scan_progress,
        100,
        "Scanning installed loader files...",
    );

    emit_loader_progress(
        app,
        instance_id,
        manifest_label,
        verify_progress,
        100,
        "Verifying loader integrity...",
    );

    let issues = scan_loader_installation_issues(manifest, global_mc_root, cancel).await?;
    if !issues.is_empty() {
        let detail = issues.into_iter().take(6).collect::<Vec<_>>().join(" | ");
        return Err(AppError::Generic(format!(
            "Loader installation verification failed for {}: {}",
            manifest_label, detail
        )));
    }

    Ok(())
}

fn needs_loader_manifest_download(json_path: &Path) -> bool {
    if !json_path.exists() {
        return true;
    }

    let content = std::fs::read_to_string(json_path).unwrap_or_default();
    serde_json::from_str::<Value>(&content).is_err()
}

async fn save_loader_manifest_from_installer(
    client: &reqwest::Client,
    candidate_urls: &[String],
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
    json_path: &Path,
    expected_version_id: &str,
) -> AppResult<()> {
    let installer_bytes =
        download_bytes_from_candidates(client, candidate_urls, max_attempts, cancel).await?;
    save_loader_manifest_from_archive_bytes(&installer_bytes, json_path, expected_version_id).await
}

async fn save_loader_manifest_from_archive_bytes(
    archive_bytes: &[u8],
    json_path: &Path,
    expected_version_id: &str,
) -> AppResult<()> {
    let raw_version_json = extract_zip_entry_text(archive_bytes, "version.json")?;
    let version_json = prepare_loader_version_json(&raw_version_json, expected_version_id)?;
    tokio::fs::write(json_path, version_json).await?;
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
        fabric::install(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    } else if loader_type.eq_ignore_ascii_case("Forge") {
        forge::install(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    } else if loader_type.eq_ignore_ascii_case("NeoForge") {
        neoforge::install(
            app,
            instance_id,
            mc_version,
            loader_version,
            global_mc_root,
            cancel,
        )
        .await?;
    } else if loader_type.eq_ignore_ascii_case("Quilt") {
        quilt::install(
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

#[allow(dead_code)]
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

    if needs_loader_manifest_download(&json_path) {
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

    verify_loader_installation(app, instance_id, &version_id, global_mc_root, cancel).await?;

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

#[allow(dead_code)]
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
    let version_id = format!("{}-forge-{}", mc_version, loader_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    tokio::fs::create_dir_all(&version_dir).await?;
    let json_path = version_dir.join(format!("{}.json", version_id));
    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("forge-installer-{}.jar", loader_version));

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
            message: format!("正在下载 Forge {} 安装包元数据...", loader_version),
        },
    );

    let installer_urls = forge_installer_urls(&dl_settings, mc_version, loader_version);
    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let installer_bytes =
            download_bytes_from_candidates(&client, &installer_urls, max_attempts, cancel).await?;
        tokio::fs::write(&installer_path, installer_bytes).await?;
    }
    if needs_loader_manifest_download(&json_path) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        save_loader_manifest_from_installer(
            &client,
            &installer_urls,
            max_attempts,
            cancel,
            &json_path,
            &version_id,
        )
        .await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: format!("{}.json", version_id),
            current: 40,
            total: 100,
            message: "Forge 版本清单已就绪，正在下载依赖...".to_string(),
        },
    );

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }
    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    emit_loader_progress(
        app,
        instance_id,
        "installer.jar",
        60,
        100,
        "正在执行 Forge 安装器...",
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

    emit_loader_progress(
        app,
        instance_id,
        format!("{}.json", version_id),
        80,
        100,
        "Forge 安装完成，正在补齐并校验依赖...",
    );
    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &version_id,
        global_mc_root,
        cancel,
    )
    .await?;

    verify_loader_installation(app, instance_id, &version_id, global_mc_root, cancel).await?;
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

#[allow(dead_code)]
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
    let version_id = format!("neoforge-{}", loader_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    tokio::fs::create_dir_all(&version_dir).await?;
    let json_path = version_dir.join(format!("{}.json", version_id));
    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("neoforge-installer-{}.jar", loader_version));

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
            message: format!("正在下载 NeoForge {} 安装包元数据...", loader_version),
        },
    );

    let installer_urls = resolve_neoforge_installer_urls(
        &client,
        &dl_settings,
        mc_version,
        loader_version,
        max_attempts,
        cancel,
    )
    .await?;
    let installer_bytes = load_or_download_installer_archive(
        &client,
        &installer_urls,
        &installer_path,
        &["version.json", "install_profile.json"],
        max_attempts,
        cancel,
    )
    .await?;
    if needs_loader_manifest_download(&json_path) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        save_loader_manifest_from_archive_bytes(&installer_bytes, &json_path, &version_id).await?;
    }

    let install_profile = extract_zip_entry_json(&installer_bytes, "install_profile.json")?;

    emit_loader_progress(
        app,
        instance_id,
        "install_profile.json",
        20,
        100,
        "姝ｅ湪鎺ョ NeoForge installer 渚濊禆涓嬭浇...",
    );
    crate::services::downloader::dependencies::download_libraries(
        app,
        instance_id,
        &client,
        &install_profile,
        global_mc_root,
        cancel,
    )
    .await?;

    verify_loader_manifest_integrity(
        app,
        instance_id,
        "install_profile.json",
        &install_profile,
        global_mc_root,
        cancel,
        32,
        38,
    )
    .await?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: format!("{}.json", version_id),
            current: 40,
            total: 100,
            message: "NeoForge 版本清单已就绪，正在下载依赖...".to_string(),
        },
    );

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }
    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    emit_loader_progress(
        app,
        instance_id,
        "installer.jar",
        60,
        100,
        "正在执行 NeoForge 安装器...",
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

    emit_loader_progress(
        app,
        instance_id,
        format!("{}.json", version_id),
        80,
        100,
        "NeoForge 安装完成，正在补齐并校验依赖...",
    );
    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &version_id,
        global_mc_root,
        cancel,
    )
    .await?;

    verify_loader_installation(app, instance_id, &version_id, global_mc_root, cancel).await?;
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
    use sha1::{Digest, Sha1};
    use std::sync::atomic::AtomicBool;
    use uuid::Uuid;

    fn sha1_hex(bytes: &[u8]) -> String {
        let digest = Sha1::digest(bytes);
        digest
            .iter()
            .map(|b| format!("{:02x}", b))
            .collect::<String>()
    }

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

    #[test]
    fn neoforge_entry_matching_accepts_old_and_new_version_formats() {
        let modern_entry = NeoForgeBmclVersion {
            version: "21.1.222".to_string(),
            raw_version: Some("neoforge-21.1.222".to_string()),
            installer_path: None,
        };
        assert!(neoforge_entry_matches(&modern_entry, "1.21.1", "21.1.222"));
        assert!(neoforge_entry_matches(
            &modern_entry,
            "1.21.1",
            "neoforge-21.1.222"
        ));

        let legacy_entry = NeoForgeBmclVersion {
            version: "47.1.12".to_string(),
            raw_version: Some("1.20.1-47.1.12".to_string()),
            installer_path: None,
        };
        assert!(neoforge_entry_matches(&legacy_entry, "1.20.1", "47.1.12"));
        assert!(neoforge_entry_matches(
            &legacy_entry,
            "1.20.1",
            "1.20.1-47.1.12"
        ));
        assert!(neoforge_entry_matches(
            &legacy_entry,
            "1.20.1",
            "1.20.1-forge-47.1.12"
        ));
    }

    #[test]
    fn neoforge_bmcl_installer_urls_include_redirect_and_installer_path() {
        let entry = NeoForgeBmclVersion {
            version: "21.1.222".to_string(),
            raw_version: Some("neoforge-21.1.222".to_string()),
            installer_path: Some(
                "/maven/net/neoforged/neoforge/21.1.222/neoforge-21.1.222-installer.jar"
                    .to_string(),
            ),
        };

        let mut urls = Vec::new();
        append_neoforge_bmcl_installer_urls(
            &mut urls,
            "https://bmclapi2.bangbang93.com/neoforge",
            &entry,
        );

        assert_eq!(
            urls,
            vec![
                "https://bmclapi2.bangbang93.com/neoforge/version/21.1.222/download/installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/maven/net/neoforged/neoforge/21.1.222/neoforge-21.1.222-installer.jar"
                    .to_string(),
            ]
        );
    }

    #[test]
    fn collect_loader_file_expectations_resolves_downloads_and_natives() {
        let root = PathBuf::from("C:/runtime");
        let classifier_key = format!("natives-{}", get_mc_arch());
        let classifier_path = format!("org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-{}.jar", classifier_key);

        let manifest = serde_json::json!({
            "libraries": [
                {
                    "name": "org.example:demo:1.0.0",
                    "downloads": {
                        "artifact": {
                            "path": "org/example/demo/1.0.0/demo-1.0.0.jar",
                            "size": 12,
                            "sha1": "ABCDEF"
                        }
                    }
                },
                {
                    "name": "org.lwjgl:lwjgl:3.3.3",
                    "natives": {
                        (get_mc_os()): "natives-${arch}"
                    },
                    "downloads": {
                        "classifiers": {
                            (classifier_key.clone()): {
                                "path": classifier_path.clone(),
                                "size": 34,
                                "sha1": "123456"
                            }
                        }
                    }
                }
            ]
        });

        let expectations = collect_loader_file_expectations(&manifest, &root);

        assert_eq!(expectations.len(), 2);
        assert_eq!(
            expectations[0],
            LoaderFileExpectation {
                name: "org.example:demo:1.0.0".to_string(),
                path: root.join("libraries/org/example/demo/1.0.0/demo-1.0.0.jar"),
                expected_size: Some(12),
                expected_sha1: Some("abcdef".to_string()),
            }
        );
        assert_eq!(
            expectations[1],
            LoaderFileExpectation {
                name: format!("org.lwjgl:lwjgl:3.3.3-{}", classifier_key),
                path: root.join("libraries").join(classifier_path),
                expected_size: Some(34),
                expected_sha1: Some("123456".to_string()),
            }
        );
    }

    #[tokio::test]
    async fn scan_loader_installation_issues_reports_missing_and_corrupt_files() {
        let temp_root =
            std::env::temp_dir().join(format!("pilauncher-loader-test-{}", Uuid::new_v4()));
        let libraries_root = temp_root.join("libraries");
        tokio::fs::create_dir_all(&libraries_root).await.unwrap();

        let good_rel = "org/example/good/1.0.0/good-1.0.0.jar";
        let bad_rel = "org/example/bad/1.0.0/bad-1.0.0.jar";
        let missing_rel = "org/example/missing/1.0.0/missing-1.0.0.jar";

        let good_bytes = b"good-loader-lib";
        let bad_bytes = b"broken";

        let good_path = libraries_root.join(good_rel);
        let bad_path = libraries_root.join(bad_rel);

        tokio::fs::create_dir_all(good_path.parent().unwrap())
            .await
            .unwrap();
        tokio::fs::create_dir_all(bad_path.parent().unwrap())
            .await
            .unwrap();
        tokio::fs::write(&good_path, good_bytes).await.unwrap();
        tokio::fs::write(&bad_path, bad_bytes).await.unwrap();

        let manifest = serde_json::json!({
            "inheritsFrom": "1.20.1",
            "libraries": [
                {
                    "name": "org.example:good:1.0.0",
                    "downloads": {
                        "artifact": {
                            "path": good_rel,
                            "size": good_bytes.len(),
                            "sha1": sha1_hex(good_bytes)
                        }
                    }
                },
                {
                    "name": "org.example:bad:1.0.0",
                    "downloads": {
                        "artifact": {
                            "path": bad_rel,
                            "size": 20,
                            "sha1": sha1_hex(b"expected-content")
                        }
                    }
                },
                {
                    "name": "org.example:missing:1.0.0",
                    "downloads": {
                        "artifact": {
                            "path": missing_rel,
                            "size": 10,
                            "sha1": sha1_hex(b"missing")
                        }
                    }
                }
            ]
        });

        let cancel = Arc::new(AtomicBool::new(false));
        let issues = scan_loader_installation_issues(&manifest, &temp_root, &cancel)
            .await
            .unwrap();

        assert_eq!(issues.len(), 3);
        assert!(issues
            .iter()
            .any(|issue| issue.contains("missing inherited version manifest")));
        assert!(issues
            .iter()
            .any(|issue| issue.contains("incomplete loader dependency")));
        assert!(issues
            .iter()
            .any(|issue| issue.contains("missing loader dependency")));
        assert!(!bad_path.exists());

        let _ = tokio::fs::remove_dir_all(&temp_root).await;
    }
}
