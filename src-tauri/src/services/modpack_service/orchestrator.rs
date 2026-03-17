use crate::domain::event::DownloadProgressEvent;
use crate::services::config_service::ConfigService;
use crate::services::downloader::dependencies::{
    run_downloads, sha1_file, DownloadStage, DownloadTask,
};
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use std::env;
use std::fs;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

use super::logic::{build_instance_config, safe_relative_path, sanitize_instance_id};
use super::ops::{
    create_instance_layout, detect_modpack_source, extract_overrides, open_modpack_archive,
    parse_modpack, read_zip_entry_to_string, resolve_base_dir,
};
use super::logic::ModpackSourceHint;

#[derive(Deserialize)]
struct CurseForgeEnvelope<T> {
    data: T,
}

#[derive(Deserialize)]
struct CurseForgeManifest {
    files: Vec<CurseForgeManifestFile>,
}

#[derive(Deserialize)]
struct CurseForgeManifestFile {
    #[serde(rename = "projectID")]
    project_id: u64,
    #[serde(rename = "fileID")]
    file_id: u64,
    required: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CurseForgeFileInfo {
    id: u64,
    file_name: String,
    download_url: Option<String>,
    file_length: u64,
    hashes: Vec<CurseForgeHash>,
}

#[derive(Deserialize)]
struct CurseForgeHash {
    algo: u32,
    value: String,
}

fn resolve_curseforge_api_key() -> Option<String> {
    let from_vite = env::var("VITE_CURSEFORGE_API_KEY").ok();
    let from_plain = env::var("CURSEFORGE_API_KEY").ok();
    let from_baked = option_env!("CURSEFORGE_API_KEY")
        .map(|v| v.to_string())
        .or_else(|| option_env!("VITE_CURSEFORGE_API_KEY").map(|v| v.to_string()));
    let from_env_file = read_dotenv_key("VITE_CURSEFORGE_API_KEY")
        .or_else(|| read_dotenv_key("CURSEFORGE_API_KEY"));
    let key = from_vite.or(from_plain).or(from_baked).or(from_env_file)?;
    let trimmed = key.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

fn read_dotenv_key(key: &str) -> Option<String> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();

    if let Ok(cwd) = env::current_dir() {
        // common: project root in dev
        candidates.push(cwd.join(".env"));
        // common: running with cwd=src-tauri
        candidates.push(cwd.join("..").join(".env"));
        candidates.push(cwd.join("src-tauri").join(".env"));
        candidates.push(cwd.join("..").join("src-tauri").join(".env"));
    }

    if let Ok(exe) = env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // common: packaged app, cwd not project root
            candidates.push(exe_dir.join(".env"));
            candidates.push(exe_dir.join("..").join(".env"));
            candidates.push(exe_dir.join("src-tauri").join(".env"));
            candidates.push(exe_dir.join("..").join("src-tauri").join(".env"));
        }
    }

    // last resort: check a few parent levels from cwd for a .env
    if let Ok(mut dir) = env::current_dir() {
        for _ in 0..5 {
            candidates.push(dir.join(".env"));
            candidates.push(dir.join("src-tauri").join(".env"));
            if !dir.pop() {
                break;
            }
        }
    }

    candidates.sort();
    candidates.dedup();

    for path in candidates {
        let contents = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let mut parts = line.splitn(2, '=');
            let k = parts.next()?.trim();
            let v = parts.next()?.trim();
            if k == key {
                let unquoted = v.trim_matches('"').trim_matches('\'').to_string();
                if !unquoted.is_empty() {
                    return Some(unquoted);
                }
            }
        }
    }

    None
}

fn percent_encode(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for b in input.as_bytes() {
        let ch = *b;
        if matches!(ch, b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~') {
            out.push(ch as char);
        } else {
            out.push_str(&format!("%{:02X}", ch));
        }
    }
    out
}

fn curseforge_edge_url(file_id: u64, file_name: &str) -> String {
    let prefix = file_id / 1000;
    let suffix = file_id % 1000;
    let encoded = percent_encode(file_name);
    format!(
        "https://edge.forgecdn.net/files/{}/{}/{}",
        prefix, suffix, encoded
    )
}

async fn fetch_curseforge_file_info(
    client: &Client,
    api_key: &str,
    project_id: u64,
    file_id: u64,
) -> Result<CurseForgeFileInfo, String> {
    let url = format!(
        "https://api.curseforge.com/v1/mods/{}/files/{}",
        project_id, file_id
    );
    let res = client
        .get(&url)
        .header("x-api-key", api_key)
        .send()
        .await
        .map_err(|e| format!("CurseForge request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "CurseForge request failed: {} (mod {} file {})",
            res.status(),
            project_id,
            file_id
        ));
    }

    let payload: CurseForgeEnvelope<CurseForgeFileInfo> = res
        .json()
        .await
        .map_err(|e| format!("CurseForge response parse failed: {}", e))?;
    Ok(payload.data)
}

pub async fn execute_import<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_name: &str,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let metadata = parse_modpack(zip_path)?;

    let instance_id = sanitize_instance_id(instance_name);
    let instance_root = base_dir.join("instances").join(&instance_id);

    create_instance_layout(&instance_root)?;
    let config = build_instance_config(&instance_id, instance_name, &metadata);
    super::ops::write_instance_config(&instance_root, &config)?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "EXTRACTING".to_string(),
            file_name: "overrides".to_string(),
            current: 50,
            total: 100,
            message: "Extracting overrides...".to_string(),
        },
    );

    extract_overrides(zip_path, &instance_root)?;

    let global_mc_root = base_dir.join("runtime");
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("Downloading vanilla core for {}", metadata.version),
        },
    );

    let no_cancel = Arc::new(AtomicBool::new(false));

    crate::services::downloader::core_installer::install_vanilla_core(
        app,
        &instance_id,
        &metadata.version,
        &global_mc_root,
        &no_cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    crate::services::downloader::dependencies::download_dependencies(
        app,
        &instance_id,
        &metadata.version,
        &global_mc_root,
        &no_cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 90,
            total: 100,
            message: format!(
                "Installing loader {} {}",
                metadata.loader, metadata.loader_version
            ),
        },
    );

    crate::services::downloader::loader_installer::install_loader(
        app,
        &instance_id,
        &metadata.version,
        &metadata.loader,
        &metadata.loader_version,
        &global_mc_root,
        &no_cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "DOWNLOADING_MOD".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: "Preparing mod downloads...".to_string(),
        },
    );

    fetch_modpack_mods(
        app,
        zip_path,
        &instance_root,
        &instance_id,
        &base_dir,
        &no_cancel,
    )
    .await?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "Modpack setup completed".to_string(),
        },
    );

    Ok(())
}

async fn fetch_modpack_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    match detect_modpack_source(&mut archive)? {
        ModpackSourceHint::Modrinth => {
            download_modrinth_mods(app, zip_path, instance_root, instance_id, base_dir, cancel)
                .await
        }
        ModpackSourceHint::CurseForge => {
            download_curseforge_mods(app, zip_path, instance_root, instance_id, base_dir, cancel)
                .await
        }
    }
}

async fn download_modrinth_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let contents = read_zip_entry_to_string(&mut archive, "modrinth.index.json")?;

    let index: serde_json::Value =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse index: {}", e))?;

    let files = match index["files"].as_array() {
        Some(files) => files,
        None => return Ok(()),
    };

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        16
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (Modpack)")
        .timeout(Duration::from_secs(dl_settings.timeout.max(1)))
        .build()
        .map_err(|e| e.to_string())?;

    let temp_root = base_dir.join("temp").join("modpack").join(instance_id);
    tokio::fs::create_dir_all(&temp_root)
        .await
        .map_err(|e| e.to_string())?;

    let mut tasks: Vec<DownloadTask> = Vec::new();

    for file in files {
        if let Some(env) = file.get("env") {
            if let Some(client_env) = env.get("client").and_then(|v| v.as_str()) {
                if client_env == "unsupported" {
                    continue;
                }
            }
        }

        let url = match file
            .get("downloads")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.as_str())
        {
            Some(url) => url,
            None => continue,
        };

        let path = match file.get("path").and_then(|v| v.as_str()) {
            Some(p) => p,
            None => continue,
        };

        let relative_path = match safe_relative_path(path) {
            Some(p) => p,
            None => continue,
        };

        let file_name = relative_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "download.bin".to_string());

        let target_path = instance_root.join(&relative_path);
        let expected_sha1 = file
            .get("hashes")
            .and_then(|v| v.get("sha1"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase());
        let expected_size = file.get("fileSize").and_then(|v| v.as_u64());

        if target_path.exists() {
            let size_matches = expected_size
                .map(|size| target_path.metadata().map(|m| m.len() == size).unwrap_or(false))
                .unwrap_or(false);

            if size_matches {
                if verify_hash {
                    if let Some(expected) = expected_sha1.as_ref() {
                        if let Ok(actual) = sha1_file(&target_path).await {
                            if actual == *expected {
                                continue;
                            }
                        }
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            }
        }

        let tmp_file_name = format!("{}.tmp", file_name);
        let temp_path = temp_root
            .join(&relative_path)
            .with_file_name(tmp_file_name);

        tasks.push(DownloadTask {
            url: url.to_string(),
            path: target_path,
            temp_path,
            name: file_name,
            expected_sha1: if verify_hash { expected_sha1 } else { None },
            expected_size,
        });
    }

    if tasks.is_empty() {
        return Ok(());
    }

    run_downloads::<R>(
        app,
        instance_id,
        &client,
        tasks,
        DownloadStage::Mods,
        concurrency,
        limit_per_thread,
        retry_count,
        verify_hash,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

async fn download_curseforge_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let contents = read_zip_entry_to_string(&mut archive, "manifest.json")?;
    let manifest: CurseForgeManifest =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse manifest: {}", e))?;

    let api_key = resolve_curseforge_api_key().ok_or_else(|| {
        "CurseForge API key is missing. Set VITE_CURSEFORGE_API_KEY or CURSEFORGE_API_KEY."
            .to_string()
    })?;

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        16
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (CurseForge)")
        .timeout(Duration::from_secs(dl_settings.timeout.max(1)))
        .build()
        .map_err(|e| e.to_string())?;

    let temp_root = base_dir
        .join("temp")
        .join("modpack")
        .join("curseforge")
        .join(instance_id);
    tokio::fs::create_dir_all(&temp_root)
        .await
        .map_err(|e| e.to_string())?;

    let entries: Vec<CurseForgeManifestFile> = manifest
        .files
        .into_iter()
        .filter(|entry| entry.required.unwrap_or(true))
        .collect();

    if entries.is_empty() {
        return Ok(());
    }

    let info_concurrency = std::cmp::max(1, std::cmp::min(concurrency, 8));
    let info_stream = iter(entries.into_iter()).map(|entry| {
        let client = client.clone();
        let api_key = api_key.clone();
        async move {
            fetch_curseforge_file_info(&client, &api_key, entry.project_id, entry.file_id)
                .await
                .map(|info| (entry, info))
        }
    });

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let mut info_results = info_stream.buffer_unordered(info_concurrency);
    while let Some(result) = info_results.next().await {
        let (_entry, info) = result?;
        let raw_name = info.file_name;
        let file_name = Path::new(&raw_name)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "mod.jar".to_string());

        let url = match info.download_url {
            Some(url) if !url.trim().is_empty() => url,
            _ => curseforge_edge_url(info.id, &file_name),
        };

        let expected_sha1 = info
            .hashes
            .iter()
            .find(|h| h.algo == 1)
            .map(|h| h.value.to_lowercase());
        let expected_size = Some(info.file_length);

        let target_path = instance_root.join("mods").join(&file_name);
        if target_path.exists() {
            let size_matches = expected_size
                .map(|size| target_path.metadata().map(|m| m.len() == size).unwrap_or(false))
                .unwrap_or(false);

            if size_matches {
                if verify_hash {
                    if let Some(expected) = expected_sha1.as_ref() {
                        if let Ok(actual) = sha1_file(&target_path).await {
                            if actual == *expected {
                                continue;
                            }
                        }
                    } else {
                        continue;
                    }
                } else {
                    continue;
                }
            }
        }

        let tmp_file_name = format!("{}.tmp", file_name);
        let temp_path = temp_root.join("mods").join(tmp_file_name);

        tasks.push(DownloadTask {
            url,
            path: target_path,
            temp_path,
            name: file_name,
            expected_sha1: if verify_hash { expected_sha1 } else { None },
            expected_size,
        });
    }

    if tasks.is_empty() {
        return Ok(());
    }

    run_downloads::<R>(
        app,
        instance_id,
        &client,
        tasks,
        DownloadStage::Mods,
        concurrency,
        limit_per_thread,
        retry_count,
        verify_hash,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
