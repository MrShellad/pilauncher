use crate::domain::event::DownloadProgressEvent;
use crate::domain::mod_manifest::{
    build_file_state, build_manifest_entry, build_manifest_source, compute_file_hash,
    mod_manifest_key, write_mod_manifest, ModManifest, ModSourceKind,
};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::dependencies::{
    run_downloads, sha1_file, DownloadStage, DownloadTask,
};
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use serde::Deserialize;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Runtime};

use super::logic::{
    build_instance_config, resolve_curseforge_install_target, safe_relative_path,
    sanitize_instance_id, CurseForgeInstallTarget, ModpackSourceHint,
};
use super::ops::{
    create_instance_layout, detect_modpack_source, extract_overrides, open_modpack_archive,
    parse_modpack, read_pipack_manifest, read_zip_entry_to_string, resolve_base_dir,
};

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
#[serde(rename_all = "camelCase")]
struct CurseForgeProjectInfo {
    class_id: Option<u64>,
}

#[derive(Deserialize)]
struct CurseForgeHash {
    algo: u32,
    value: String,
}

#[derive(Deserialize)]
struct ModrinthVersionInfo {
    project_id: String,
    files: Vec<ModrinthVersionFile>,
}

#[derive(Deserialize)]
struct ModrinthVersionFile {
    url: String,
    filename: String,
    size: Option<u64>,
    primary: Option<bool>,
    hashes: HashMap<String, String>,
}

fn should_track_mod_manifest(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("jar"))
        .unwrap_or(false)
        && path.starts_with(Path::new("mods"))
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
        "https://edge.forgecdn.net/files/{}/{:03}/{}",
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

async fn fetch_curseforge_project_info(
    client: &Client,
    api_key: &str,
    project_id: u64,
) -> Result<CurseForgeProjectInfo, String> {
    let url = format!("https://api.curseforge.com/v1/mods/{}", project_id);
    let res = client
        .get(&url)
        .header("x-api-key", api_key)
        .send()
        .await
        .map_err(|e| format!("CurseForge project request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "CurseForge project request failed: {} (mod {})",
            res.status(),
            project_id
        ));
    }

    let payload: CurseForgeEnvelope<CurseForgeProjectInfo> = res
        .json()
        .await
        .map_err(|e| format!("CurseForge project parse failed: {}", e))?;
    Ok(payload.data)
}

fn build_curseforge_target_path(
    instance_root: &Path,
    install_target: CurseForgeInstallTarget,
    file_name: &str,
) -> PathBuf {
    instance_root
        .join(install_target.folder_name())
        .join(file_name)
}

async fn fetch_modrinth_version_info(
    client: &Client,
    version_id: &str,
) -> Result<ModrinthVersionInfo, String> {
    let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
    let res = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Modrinth request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "Modrinth request failed: {} (version {})",
            res.status(),
            version_id
        ));
    }

    res.json()
        .await
        .map_err(|e| format!("Modrinth response parse failed: {}", e))
}

async fn file_matches_hash(
    path: &Path,
    hash: &crate::domain::mod_manifest::ModFileHash,
) -> Result<bool, String> {
    if !hash.algorithm.eq_ignore_ascii_case("sha1") {
        return Ok(false);
    }

    let actual = sha1_file(path).await.map_err(|e| e.to_string())?;
    Ok(actual.eq_ignore_ascii_case(&hash.value))
}

fn select_modrinth_file<'a>(
    version_info: &'a ModrinthVersionInfo,
    manifest_entry: &crate::domain::modpack::PiPackModEntry,
) -> Option<&'a ModrinthVersionFile> {
    let expected_hash = manifest_entry.hash.value.to_ascii_lowercase();
    let normalized_name = manifest_entry
        .file_name
        .trim_end_matches(".disabled")
        .to_string();

    version_info
        .files
        .iter()
        .find(|file| {
            file.hashes
                .get("sha1")
                .map(|value| value.eq_ignore_ascii_case(&expected_hash))
                .unwrap_or(false)
        })
        .or_else(|| {
            version_info
                .files
                .iter()
                .find(|file| file.filename == normalized_name)
        })
        .or_else(|| {
            version_info
                .files
                .iter()
                .find(|file| file.primary.unwrap_or(false))
        })
        .or_else(|| version_info.files.first())
}

async fn build_pipack_download_task(
    client: &Client,
    curseforge_api_key: Option<&str>,
    manifest_entry: &crate::domain::modpack::PiPackModEntry,
    target_path: &Path,
    temp_root: &Path,
) -> Result<Option<DownloadTask>, String> {
    let platform = manifest_entry
        .source
        .platform
        .as_deref()
        .map(|value| value.trim().to_ascii_lowercase());
    let project_id = manifest_entry
        .source
        .project_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let file_id = manifest_entry
        .source
        .file_id
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());

    let Some(platform) = platform else {
        return Ok(None);
    };
    let (Some(project_id), Some(file_id)) = (project_id, file_id) else {
        return Ok(None);
    };
    let relative_path = safe_relative_path(&manifest_entry.path).ok_or_else(|| {
        format!(
            "Invalid mod path in PiPack manifest: {}",
            manifest_entry.path
        )
    })?;
    let temp_file_name = format!("{}.tmp", manifest_entry.file_name);

    match platform.as_str() {
        "modrinth" => {
            let version_info = fetch_modrinth_version_info(client, file_id).await?;
            if version_info.project_id != project_id {
                return Err(format!(
                    "Modrinth project mismatch for {}: expected {}, got {}",
                    manifest_entry.file_name, project_id, version_info.project_id
                ));
            }

            let Some(file_info) = select_modrinth_file(&version_info, manifest_entry) else {
                return Ok(None);
            };

            let temp_path = temp_root
                .join(&relative_path)
                .with_file_name(&temp_file_name);

            return Ok(Some(DownloadTask {
                url: file_info.url.clone(),
                fallback_urls: Vec::new(),
                path: target_path.to_path_buf(),
                temp_path,
                name: manifest_entry.file_name.clone(),
                expected_sha1: Some(manifest_entry.hash.value.to_ascii_lowercase()),
                expected_size: file_info.size,
            }));
        }
        "curseforge" => {
            let api_key = curseforge_api_key.ok_or_else(|| {
                "CurseForge API key is missing. Set VITE_CURSEFORGE_API_KEY or CURSEFORGE_API_KEY."
                    .to_string()
            })?;
            let project_id_num = project_id
                .parse::<u64>()
                .map_err(|_| format!("Invalid CurseForge project id: {}", project_id))?;
            let file_id_num = file_id
                .parse::<u64>()
                .map_err(|_| format!("Invalid CurseForge file id: {}", file_id))?;
            let info =
                fetch_curseforge_file_info(client, api_key, project_id_num, file_id_num).await?;
            let file_name = Path::new(&info.file_name)
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
                .unwrap_or_else(|| {
                    manifest_entry
                        .file_name
                        .trim_end_matches(".disabled")
                        .to_string()
                });
            let url = match info.download_url {
                Some(url) if !url.trim().is_empty() => url.replace(" ", "%20"),
                _ => curseforge_edge_url(info.id, &file_name),
            };

            let temp_path = temp_root
                .join(&relative_path)
                .with_file_name(&temp_file_name);

            return Ok(Some(DownloadTask {
                url,
                fallback_urls: Vec::new(),
                path: target_path.to_path_buf(),
                temp_path,
                name: manifest_entry.file_name.clone(),
                expected_sha1: Some(manifest_entry.hash.value.to_ascii_lowercase()),
                expected_size: Some(info.file_length),
            }));
        }
        _ => {}
    }

    Ok(None)
}

pub async fn execute_import<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_name: &str,
    cancel: &Arc<AtomicBool>,
    server_binding: Option<crate::domain::instance::ServerBinding>,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_id = sanitize_instance_id(instance_name);
    let result = execute_import_inner(
        app,
        zip_path,
        &instance_id,
        instance_name,
        &base_dir,
        cancel,
        server_binding,
    )
    .await;

    if result.is_err() || is_cancelled(cancel) {
        cleanup_modpack_artifacts(&base_dir, &instance_id);

        let db = app.state::<crate::services::db_service::AppDatabase>();
        if let Err(error) =
            crate::services::instance::binding::InstanceBindingService::delete_instance_records(
                &db.pool,
                &instance_id,
            )
            .await
        {
            eprintln!(
                "[ModpackImport] Failed to remove database records for {} after cleanup: {}",
                instance_id, error
            );
        }
    }

    result
}

async fn execute_import_inner<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_id: &str,
    instance_name: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
    server_binding: Option<crate::domain::instance::ServerBinding>,
) -> Result<(), String> {
    if is_cancelled(cancel) {
        return Err("Cancelled".to_string());
    }

    let metadata = parse_modpack(zip_path)?;
    let pipack_manifest = read_pipack_manifest(zip_path).ok();
    let effective_server_binding = server_binding.or_else(|| {
        pipack_manifest
            .as_ref()
            .and_then(|manifest| manifest.server.clone())
    });
    let instance_root = base_dir.join("instances").join(instance_id);

    create_instance_layout(&instance_root)?;
    let mut config = build_instance_config(instance_id, instance_name, &metadata);
    config.server_binding = effective_server_binding.clone();
    super::ops::write_instance_config(&instance_root, &config)?;

    let db = app.state::<crate::services::db_service::AppDatabase>();
    crate::services::instance::binding::InstanceBindingService::upsert_instance(&db.pool, &config)
        .await
        .map_err(|e| e.to_string())?;

    if let Some(binding) = &effective_server_binding {
        let canonical_binding =
            crate::services::instance::binding::InstanceBindingService::replace_binding_for_instance(
                &db.pool,
                instance_id,
                binding,
                true,
            )
            .await
            .map_err(|e| e.to_string())?;
        config.server_binding = Some(canonical_binding);
        config.auto_join_server = Some(true);
        super::ops::write_instance_config(&instance_root, &config)?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "EXTRACTING".to_string(),
            file_name: "overrides".to_string(),
            current: 50,
            total: 100,
            message: "Extracting overrides...".to_string(),
        },
    );

    extract_overrides(zip_path, &instance_root)?;

    if is_cancelled(cancel) {
        return Err("Cancelled".to_string());
    }

    let global_mc_root = base_dir.join("runtime");
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("Downloading vanilla core for {}", metadata.version),
        },
    );

    crate::services::downloader::core_installer::install_vanilla_core(
        app,
        instance_id,
        &metadata.version,
        &global_mc_root,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &metadata.version,
        &global_mc_root,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
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
        instance_id,
        &metadata.version,
        &metadata.loader,
        &metadata.loader_version,
        &global_mc_root,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;

    if is_cancelled(cancel) {
        return Err("Cancelled".to_string());
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "DOWNLOADING_MOD".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: "Preparing mod downloads...".to_string(),
        },
    );

    fetch_modpack_mods(app, zip_path, &instance_root, instance_id, base_dir, cancel).await?;

    if is_cancelled(cancel) {
        return Err("Cancelled".to_string());
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "Modpack setup completed".to_string(),
        },
    );

    Ok(())
}

fn cleanup_modpack_artifacts(base_dir: &Path, instance_id: &str) {
    let instance_root = base_dir.join("instances").join(instance_id);
    let temp_root = base_dir.join("temp").join("modpack");

    let _ = fs::remove_dir_all(&instance_root);
    let _ = fs::remove_dir_all(temp_root.join(instance_id));
    let _ = fs::remove_dir_all(temp_root.join("curseforge").join(instance_id));
    let _ = fs::remove_dir_all(temp_root.join("modrinth").join(instance_id));
    let _ = fs::remove_dir_all(temp_root.join("pipack").join(instance_id));
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
        ModpackSourceHint::PiPack => {
            download_pipack_mods(app, zip_path, instance_root, instance_id, base_dir, cancel).await
        }
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

async fn download_pipack_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let manifest = read_pipack_manifest(zip_path)?;
    if manifest.mods.is_empty() {
        return Ok(());
    }

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        8
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);

    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (PiPack)")
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)))
        .build()
        .map_err(|e| e.to_string())?;

    let temp_root = base_dir
        .join("temp")
        .join("modpack")
        .join("pipack")
        .join(instance_id);
    tokio::fs::create_dir_all(&temp_root)
        .await
        .map_err(|e| e.to_string())?;

    let curseforge_api_key = if manifest.mods.iter().any(|entry| {
        entry
            .source
            .platform
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("curseforge"))
            && entry
                .source
                .project_id
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
            && entry
                .source
                .file_id
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
    }) {
        Some(resolve_curseforge_api_key().ok_or_else(|| {
            "CurseForge API key is missing. Set VITE_CURSEFORGE_API_KEY or CURSEFORGE_API_KEY."
                .to_string()
        })?)
    } else {
        None
    };

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let mut manifest_data = ModManifest::new();

    for entry in &manifest.mods {
        if is_cancelled(cancel) {
            return Err("Cancelled".to_string());
        }

        let relative_path = safe_relative_path(&entry.path)
            .ok_or_else(|| format!("Invalid mod path in PiPack manifest: {}", entry.path))?;
        let target_path = instance_root.join(&relative_path);

        if target_path.exists() && file_matches_hash(&target_path, &entry.hash).await? {
            let file_state = build_file_state(&target_path)?;
            let hash = compute_file_hash(&target_path)?;
            manifest_data.insert(
                mod_manifest_key(&entry.file_name),
                build_manifest_entry(entry.source.clone(), hash, file_state),
            );
            continue;
        }

        let remote_task = build_pipack_download_task(
            &client,
            curseforge_api_key.as_deref(),
            entry,
            &target_path,
            &temp_root,
        )
        .await?;

        match remote_task {
            Some(task) => tasks.push(task),
            None => {
                if entry.bundled_path.is_some()
                    && target_path.exists()
                    && file_matches_hash(&target_path, &entry.hash).await?
                {
                    let file_state = build_file_state(&target_path)?;
                    let hash = compute_file_hash(&target_path)?;
                    manifest_data.insert(
                        mod_manifest_key(&entry.file_name),
                        build_manifest_entry(entry.source.clone(), hash, file_state),
                    );
                    continue;
                }

                return Err(format!(
                    "Unable to resolve mod {} from platform and no valid bundled fallback was found",
                    entry.file_name
                ));
            }
        }
    }

    if !tasks.is_empty() {
        run_downloads::<R>(
            app,
            instance_id,
            &client,
            tasks,
            DownloadStage::Mods,
            concurrency,
            speed_limit_bytes_per_sec,
            retry_count,
            verify_hash,
            Duration::from_secs(dl_settings.timeout.max(1).saturating_mul(2).max(30)),
            cancel,
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    for entry in &manifest.mods {
        let relative_path = safe_relative_path(&entry.path)
            .ok_or_else(|| format!("Invalid mod path in PiPack manifest: {}", entry.path))?;
        let target_path = instance_root.join(relative_path);
        if !target_path.exists() {
            continue;
        }

        let file_state = build_file_state(&target_path)?;
        let hash = compute_file_hash(&target_path)?;
        manifest_data.insert(
            mod_manifest_key(&entry.file_name),
            build_manifest_entry(entry.source.clone(), hash, file_state),
        );
    }

    if !manifest_data.is_empty() {
        let manifest_path = instance_root.join("mod_manifest.json");
        let _ = std::fs::create_dir_all(instance_root.join("mods"));
        write_mod_manifest(&manifest_path, &manifest_data)?;
    }

    Ok(())
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
        8
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);

    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (Modpack)")
        // Only limit connection establishment time; do not cap full download time.
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)))
        .build()
        .map_err(|e| e.to_string())?;

    let temp_root = base_dir.join("temp").join("modpack").join(instance_id);
    tokio::fs::create_dir_all(&temp_root)
        .await
        .map_err(|e| e.to_string())?;

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let mut tracked_manifest_sources: Vec<(
        String,
        crate::domain::mod_manifest::ModManifestSource,
        PathBuf,
    )> = Vec::new();

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
        if should_track_mod_manifest(&relative_path) {
            let parts: Vec<&str> = url.split('/').collect();
            if let Some(pos) = parts.iter().position(|&x| x == "data") {
                if parts.len() > pos + 3 && parts[pos + 2] == "versions" {
                    tracked_manifest_sources.push((
                        file_name.clone(),
                        build_manifest_source(
                            ModSourceKind::ModpackDeployment,
                            Some("modrinth".to_string()),
                            Some(parts[pos + 1].to_string()),
                            Some(parts[pos + 3].to_string()),
                        ),
                        target_path.clone(),
                    ));
                }
            }
        }
        let expected_sha1 = file
            .get("hashes")
            .and_then(|v| v.get("sha1"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_lowercase());
        let expected_size = file.get("fileSize").and_then(|v| v.as_u64());

        if target_path.exists() {
            let size_matches = expected_size
                .map(|size| {
                    target_path
                        .metadata()
                        .map(|m| m.len() == size)
                        .unwrap_or(false)
                })
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
        let temp_path = temp_root.join(&relative_path).with_file_name(tmp_file_name);

        tasks.push(DownloadTask {
            url: url.to_string(),
            fallback_urls: Vec::new(),
            path: target_path,
            temp_path,
            name: file_name,
            expected_sha1: if verify_hash { expected_sha1 } else { None },
            expected_size,
        });
    }

    if !tasks.is_empty() {
        run_downloads::<R>(
            app,
            instance_id,
            &client,
            tasks,
            DownloadStage::Mods,
            concurrency,
            speed_limit_bytes_per_sec,
            retry_count,
            verify_hash,
            Duration::from_secs(dl_settings.timeout.max(1).saturating_mul(2).max(30)),
            cancel,
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    let mut manifest_data = ModManifest::new();
    for (file_name, source, target_path) in tracked_manifest_sources {
        if let (Ok(file_state), Ok(hash)) = (
            build_file_state(&target_path),
            compute_file_hash(&target_path),
        ) {
            manifest_data.insert(file_name, build_manifest_entry(source, hash, file_state));
        }
    }

    if !manifest_data.is_empty() {
        let manifest_path = instance_root.join("mod_manifest.json");
        let _ = std::fs::create_dir_all(instance_root.join("mods"));
        let _ = crate::domain::mod_manifest::write_mod_manifest(&manifest_path, &manifest_data);
    }

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
        8
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);

    let client = Client::builder()
        .user_agent("PiLauncher/1.0 (CurseForge)")
        // Only limit connection establishment time; do not cap full download time.
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)))
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
            let (info, project) = tokio::try_join!(
                fetch_curseforge_file_info(&client, &api_key, entry.project_id, entry.file_id),
                fetch_curseforge_project_info(&client, &api_key, entry.project_id)
            )?;
            Ok::<_, String>((entry, info, project))
        }
    });

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let mut tracked_manifest_sources: Vec<(
        String,
        crate::domain::mod_manifest::ModManifestSource,
        PathBuf,
    )> = Vec::new();
    let mut info_results = info_stream.buffer_unordered(info_concurrency);
    while let Some(result) = info_results.next().await {
        let (entry, info, project) = result?;
        let raw_name = info.file_name;
        let file_name = Path::new(&raw_name)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "mod.jar".to_string());

        let url = match info.download_url {
            // Replace spaces with %20 to avoid reqwest URL parse failures.
            Some(url) if !url.trim().is_empty() => url.replace(" ", "%20"),
            _ => curseforge_edge_url(info.id, &file_name),
        };

        let expected_sha1 = info
            .hashes
            .iter()
            .find(|h| h.algo == 1)
            .map(|h| h.value.to_lowercase());
        let expected_size = Some(info.file_length);
        let install_target = resolve_curseforge_install_target(project.class_id);

        let target_path = build_curseforge_target_path(instance_root, install_target, &file_name);
        if target_path.exists() {
            let size_matches = expected_size
                .map(|size| {
                    target_path
                        .metadata()
                        .map(|m| m.len() == size)
                        .unwrap_or(false)
                })
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
            .join(install_target.folder_name())
            .join(tmp_file_name);

        tasks.push(DownloadTask {
            url,
            fallback_urls: Vec::new(),
            path: target_path.clone(),
            temp_path,
            name: file_name.clone(),
            expected_sha1: if verify_hash { expected_sha1 } else { None },
            expected_size,
        });

        if matches!(install_target, CurseForgeInstallTarget::Mod) {
            tracked_manifest_sources.push((
                file_name.clone(),
                build_manifest_source(
                    ModSourceKind::ModpackDeployment,
                    Some("curseforge".to_string()),
                    Some(entry.project_id.to_string()),
                    Some(entry.file_id.to_string()),
                ),
                target_path.clone(),
            ));
        }
    }

    if !tasks.is_empty() {
        run_downloads::<R>(
            app,
            instance_id,
            &client,
            tasks,
            DownloadStage::Mods,
            concurrency,
            speed_limit_bytes_per_sec,
            retry_count,
            verify_hash,
            Duration::from_secs(dl_settings.timeout.max(1).saturating_mul(2).max(30)),
            cancel,
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    let mut manifest_data = ModManifest::new();
    for (file_name, source, target_path) in tracked_manifest_sources {
        if let (Ok(file_state), Ok(hash)) = (
            build_file_state(&target_path),
            compute_file_hash(&target_path),
        ) {
            manifest_data.insert(file_name, build_manifest_entry(source, hash, file_state));
        }
    }

    if !manifest_data.is_empty() {
        let manifest_path = instance_root.join("mod_manifest.json");
        let _ = std::fs::create_dir_all(instance_root.join("mods"));
        let _ = crate::domain::mod_manifest::write_mod_manifest(&manifest_path, &manifest_data);
    }

    Ok(())
}
