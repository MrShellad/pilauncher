use crate::domain::event::DownloadProgressEvent;
use crate::domain::mod_manifest::{
    build_file_state, build_manifest_entry, build_manifest_source, compute_file_hash,
    mod_manifest_key, upsert_mod_manifest_entry, ModManifestEntry, ModSourceKind,
};
use crate::services::config_service::ConfigService;
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::dependencies::{
    run_downloads, sha1_file, DownloadStage, DownloadTask,
};
use crate::services::downloader::logging::{clear_download_log_path, set_download_log_path};
use crate::services::instance::mod_manifest_service::ModManifestService;
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

use super::logging::ModpackImportLogger;
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

fn extract_modrinth_source_ids(url: &str) -> Option<(String, String)> {
    let sanitized = url
        .split_once('#')
        .map(|(value, _)| value)
        .unwrap_or(url)
        .split_once('?')
        .map(|(value, _)| value)
        .unwrap_or(url);
    let parts: Vec<&str> = sanitized
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();
    let data_index = parts
        .iter()
        .position(|segment| segment.eq_ignore_ascii_case("data"))?;
    let project_id = parts.get(data_index + 1)?;
    let versions_index = parts
        .iter()
        .enumerate()
        .skip(data_index + 2)
        .find_map(|(index, segment)| segment.eq_ignore_ascii_case("versions").then_some(index))?;
    let version_id = parts.get(versions_index + 1)?;

    Some(((*project_id).to_string(), (*version_id).to_string()))
}

fn build_pipack_manifest_entry(
    manifest_entry: &crate::domain::modpack::PiPackModEntry,
    hash: crate::domain::mod_manifest::ModFileHash,
    file_state: crate::domain::mod_manifest::ModFileState,
) -> ModManifestEntry {
    let mut entry = build_manifest_entry(manifest_entry.source.clone(), hash, file_state);
    entry.mod_id = manifest_entry.mod_id.clone();
    entry.name = manifest_entry.name.clone();
    entry.version = manifest_entry.version.clone();
    entry.description = manifest_entry.description.clone();
    entry
}

fn finalize_imported_mod_manifest(
    instance_root: &Path,
    manifest_entries: Vec<(String, ModManifestEntry)>,
) -> Result<(), String> {
    let mods_dir = instance_root.join("mods");
    std::fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    let manifest_path = instance_root.join("mod_manifest.json");
    for (file_name, entry) in manifest_entries {
        upsert_mod_manifest_entry(&manifest_path, &file_name, &entry)?;
    }

    ModManifestService::sync_from_mods_dir(&mods_dir, &manifest_path)?;
    Ok(())
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
    let logger = ModpackImportLogger::new(&base_dir, &instance_id);
    execute_import_with_logger(app, zip_path, instance_name, cancel, server_binding, logger).await
}

pub async fn execute_import_with_logger<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_name: &str,
    cancel: &Arc<AtomicBool>,
    server_binding: Option<crate::domain::instance::ServerBinding>,
    logger: ModpackImportLogger,
) -> Result<(), String> {
    let base_dir = resolve_base_dir(app)?;
    let instance_id = sanitize_instance_id(instance_name);
    logger
        .info(
            "START",
            format!(
                "Starting modpack import: instance_id={} instance_name={} archive={} base_dir={} log={}",
                instance_id,
                instance_name,
                zip_path,
                base_dir.display(),
                logger.path().display()
            ),
        )
        .await;
    set_download_log_path(&instance_id, logger.path().to_path_buf());

    let result = execute_import_inner(
        app,
        zip_path,
        &instance_id,
        instance_name,
        &base_dir,
        cancel,
        server_binding,
        &logger,
    )
    .await;

    if result.is_err() || is_cancelled(cancel) {
        let reason = result
            .as_ref()
            .err()
            .cloned()
            .unwrap_or_else(|| "Cancelled".to_string());
        logger
            .warn(
                "CLEANUP",
                format!("Import did not finish cleanly: {}", reason),
            )
            .await;

        for (path, existed, cleanup_result) in cleanup_modpack_artifacts(&base_dir, &instance_id) {
            match cleanup_result {
                Ok(()) if existed => {
                    logger
                        .info("CLEANUP", format!("Removed {}", path.display()))
                        .await;
                }
                Ok(()) => {
                    logger
                        .info(
                            "CLEANUP",
                            format!("No cleanup needed for {}", path.display()),
                        )
                        .await;
                }
                Err(error) => {
                    logger
                        .warn(
                            "CLEANUP",
                            format!("Failed to remove {}: {}", path.display(), error),
                        )
                        .await;
                }
            }
        }

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
            logger
                .warn(
                    "CLEANUP",
                    format!("Failed to remove database records: {}", error),
                )
                .await;
        } else {
            logger
                .info("CLEANUP", "Removed database records for failed import")
                .await;
        }
    }

    match &result {
        Ok(()) => {
            logger
                .info("DONE", "Modpack import finished successfully")
                .await
        }
        Err(error) => {
            logger
                .error("ERROR", format!("Modpack import failed: {}", error))
                .await
        }
    }
    clear_download_log_path(&instance_id);

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
    logger: &ModpackImportLogger,
) -> Result<(), String> {
    if is_cancelled(cancel) {
        logger
            .warn("CANCEL", "Import was cancelled before parsing")
            .await;
        return Err("Cancelled".to_string());
    }

    logger
        .info("PARSE", format!("Parsing archive {}", zip_path))
        .await;
    let metadata = parse_modpack(zip_path)?;
    logger
        .info(
            "PARSE",
            format!(
                "Metadata parsed: source={} name={} pack_version={:?} minecraft={} loader={} loader_version={} author={}",
                metadata.source,
                metadata.name,
                metadata.pack_version,
                metadata.version,
                metadata.loader,
                metadata.loader_version,
                metadata.author
            ),
        )
        .await;

    let pipack_manifest = read_pipack_manifest(zip_path).ok();
    if let Some(manifest) = &pipack_manifest {
        logger
            .info(
                "PARSE",
                format!(
                    "PiPack manifest found: format_version={} package_uuid={} overrides={} mods={} server_binding={}",
                    manifest.format_version,
                    manifest.package.uuid,
                    manifest.overrides,
                    manifest.mods.len(),
                    manifest.server.is_some()
                ),
            )
            .await;
    }

    let effective_server_binding = server_binding.or_else(|| {
        pipack_manifest
            .as_ref()
            .and_then(|manifest| manifest.server.clone())
    });
    let instance_root = base_dir.join("instances").join(instance_id);
    logger
        .info(
            "INSTANCE",
            format!("Preparing instance directory {}", instance_root.display()),
        )
        .await;

    create_instance_layout(&instance_root)?;
    logger.info("INSTANCE", "Instance layout created").await;
    let mut config = build_instance_config(instance_id, instance_name, &metadata);
    config.server_binding = effective_server_binding.clone();
    super::ops::write_instance_config(&instance_root, &config)?;
    logger
        .info("INSTANCE", "Initial instance.json written")
        .await;

    let db = app.state::<crate::services::db_service::AppDatabase>();
    crate::services::instance::binding::InstanceBindingService::upsert_instance(&db.pool, &config)
        .await
        .map_err(|e| e.to_string())?;
    logger
        .info("INSTANCE", "Instance database record upserted")
        .await;

    if let Some(binding) = &effective_server_binding {
        logger
            .info(
                "SERVER_BINDING",
                format!(
                    "Applying server binding: uuid={} name={} address={}:{}",
                    binding.uuid, binding.name, binding.ip, binding.port
                ),
            )
            .await;
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
        logger
            .info(
                "SERVER_BINDING",
                "Server binding saved to database and instance.json",
            )
            .await;
    }

    logger.info("EXTRACT", "Extracting modpack overrides").await;
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
    logger.info("EXTRACT", "Overrides extracted").await;

    if is_cancelled(cancel) {
        logger
            .warn("CANCEL", "Import was cancelled after extraction")
            .await;
        return Err("Cancelled".to_string());
    }

    let global_mc_root = base_dir.join("runtime");
    logger
        .info(
            "VANILLA_CORE",
            format!(
                "Installing vanilla core and dependencies: minecraft={} runtime_root={}",
                metadata.version,
                global_mc_root.display()
            ),
        )
        .await;
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
    logger.info("VANILLA_CORE", "Vanilla core installed").await;

    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &metadata.version,
        &global_mc_root,
        cancel,
    )
    .await
    .map_err(|e| e.to_string())?;
    logger
        .info("VANILLA_CORE", "Minecraft dependencies installed")
        .await;

    logger
        .info(
            "LOADER",
            format!(
                "Installing loader {} {}",
                metadata.loader, metadata.loader_version
            ),
        )
        .await;
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
    logger.info("LOADER", "Loader installed").await;

    if is_cancelled(cancel) {
        logger
            .warn("CANCEL", "Import was cancelled after loader install")
            .await;
        return Err("Cancelled".to_string());
    }

    logger.info("MODS", "Preparing mod downloads").await;
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

    fetch_modpack_mods(
        app,
        zip_path,
        &instance_root,
        instance_id,
        base_dir,
        cancel,
        logger,
    )
    .await?;

    if is_cancelled(cancel) {
        logger
            .warn("CANCEL", "Import was cancelled after mod downloads")
            .await;
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

fn cleanup_modpack_artifacts(
    base_dir: &Path,
    instance_id: &str,
) -> Vec<(PathBuf, bool, Result<(), String>)> {
    let instance_root = base_dir.join("instances").join(instance_id);
    let temp_root = base_dir.join("temp").join("modpack");

    [
        instance_root,
        temp_root.join(instance_id),
        temp_root.join("curseforge").join(instance_id),
        temp_root.join("modrinth").join(instance_id),
        temp_root.join("pipack").join(instance_id),
    ]
    .into_iter()
    .map(|path| {
        let existed = path.exists();
        let result = if existed {
            fs::remove_dir_all(&path).map_err(|error| error.to_string())
        } else {
            Ok(())
        };
        (path, existed, result)
    })
    .collect()
}

async fn fetch_modpack_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
    logger: &ModpackImportLogger,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let source = detect_modpack_source(&mut archive)?;
    logger
        .info(
            "MODS",
            format!("Detected modpack source for mods: {:?}", source),
        )
        .await;
    match source {
        ModpackSourceHint::PiPack => {
            download_pipack_mods(
                app,
                zip_path,
                instance_root,
                instance_id,
                base_dir,
                cancel,
                logger,
            )
            .await
        }
        ModpackSourceHint::Modrinth => {
            download_modrinth_mods(
                app,
                zip_path,
                instance_root,
                instance_id,
                base_dir,
                cancel,
                logger,
            )
            .await
        }
        ModpackSourceHint::CurseForge => {
            download_curseforge_mods(
                app,
                zip_path,
                instance_root,
                instance_id,
                base_dir,
                cancel,
                logger,
            )
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
    logger: &ModpackImportLogger,
) -> Result<(), String> {
    let manifest = read_pipack_manifest(zip_path)?;
    logger
        .info(
            "PIPACK_MODS",
            format!(
                "PiPack mod manifest loaded: mods={} overrides={} server_binding={}",
                manifest.mods.len(),
                manifest.overrides,
                manifest.server.is_some()
            ),
        )
        .await;
    if manifest.mods.is_empty() {
        logger
            .info("PIPACK_MODS", "No mods declared in PiPack manifest")
            .await;
        return finalize_imported_mod_manifest(instance_root, Vec::new());
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
    logger
        .info(
            "PIPACK_MODS",
            format!(
                "Download settings: concurrency={} retry_count={} verify_hash={} timeout={}s speed_limit={}B/s",
                concurrency,
                retry_count,
                verify_hash,
                dl_settings.timeout,
                speed_limit_bytes_per_sec
            ),
        )
        .await;

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
    logger
        .info(
            "PIPACK_MODS",
            format!("Temporary directory: {}", temp_root.display()),
        )
        .await;

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
    let mut manifest_entries: Vec<(String, ModManifestEntry)> = Vec::new();
    let mut reused_count = 0usize;

    for entry in &manifest.mods {
        if is_cancelled(cancel) {
            return Err("Cancelled".to_string());
        }

        let relative_path = safe_relative_path(&entry.path)
            .ok_or_else(|| format!("Invalid mod path in PiPack manifest: {}", entry.path))?;
        let target_path = instance_root.join(&relative_path);

        if target_path.exists() && file_matches_hash(&target_path, &entry.hash).await? {
            reused_count += 1;
            let file_state = build_file_state(&target_path)?;
            let hash = compute_file_hash(&target_path)?;
            manifest_entries.push((
                mod_manifest_key(&entry.file_name),
                build_pipack_manifest_entry(entry, hash, file_state),
            ));
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
            Some(task) => {
                logger
                    .info(
                        "PIPACK_MODS",
                        format!(
                            "Queued mod download: file={} path={} platform={:?} project={:?} file_id={:?}",
                            entry.file_name,
                            target_path.display(),
                            entry.source.platform,
                            entry.source.project_id,
                            entry.source.file_id
                        ),
                    )
                    .await;
                tasks.push(task)
            }
            None => {
                if entry.bundled_path.is_some()
                    && target_path.exists()
                    && file_matches_hash(&target_path, &entry.hash).await?
                {
                    reused_count += 1;
                    let file_state = build_file_state(&target_path)?;
                    let hash = compute_file_hash(&target_path)?;
                    manifest_entries.push((
                        mod_manifest_key(&entry.file_name),
                        build_pipack_manifest_entry(entry, hash, file_state),
                    ));
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
        logger
            .info(
                "PIPACK_MODS",
                format!(
                    "Running {} PiPack mod downloads (reused={})",
                    tasks.len(),
                    reused_count
                ),
            )
            .await;
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
    } else {
        logger
            .info(
                "PIPACK_MODS",
                format!("No PiPack mod downloads needed (reused={})", reused_count),
            )
            .await;
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
        manifest_entries.push((
            mod_manifest_key(&entry.file_name),
            build_pipack_manifest_entry(entry, hash, file_state),
        ));
    }

    logger
        .info(
            "PIPACK_MODS",
            format!("Finalizing mod manifest entries={}", manifest_entries.len()),
        )
        .await;
    finalize_imported_mod_manifest(instance_root, manifest_entries)
}

async fn download_modrinth_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
    logger: &ModpackImportLogger,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let contents = read_zip_entry_to_string(&mut archive, "modrinth.index.json")?;

    let index: serde_json::Value =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse index: {}", e))?;

    let files = match index["files"].as_array() {
        Some(files) => files,
        None => {
            logger
                .warn("MODRINTH_MODS", "modrinth.index.json has no files array")
                .await;
            return Ok(());
        }
    };
    logger
        .info(
            "MODRINTH_MODS",
            format!("Modrinth index loaded: declared_files={}", files.len()),
        )
        .await;

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        8
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);
    logger
        .info(
            "MODRINTH_MODS",
            format!(
                "Download settings: concurrency={} retry_count={} verify_hash={} timeout={}s speed_limit={}B/s",
                concurrency,
                retry_count,
                verify_hash,
                dl_settings.timeout,
                speed_limit_bytes_per_sec
            ),
        )
        .await;

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
    logger
        .info(
            "MODRINTH_MODS",
            format!("Temporary directory: {}", temp_root.display()),
        )
        .await;

    let mut tasks: Vec<DownloadTask> = Vec::new();
    let mut tracked_manifest_sources: Vec<(
        String,
        crate::domain::mod_manifest::ModManifestSource,
        PathBuf,
    )> = Vec::new();
    let mut skipped_count = 0usize;
    let mut reused_count = 0usize;

    for file in files {
        if let Some(env) = file.get("env") {
            if let Some(client_env) = env.get("client").and_then(|v| v.as_str()) {
                if client_env == "unsupported" {
                    skipped_count += 1;
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
            None => {
                skipped_count += 1;
                continue;
            }
        };

        let path = match file.get("path").and_then(|v| v.as_str()) {
            Some(p) => p,
            None => {
                skipped_count += 1;
                continue;
            }
        };

        let relative_path = match safe_relative_path(path) {
            Some(p) => p,
            None => {
                skipped_count += 1;
                logger
                    .warn("MODRINTH_MODS", format!("Skipped unsafe path: {}", path))
                    .await;
                continue;
            }
        };

        let file_name = relative_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "download.bin".to_string());

        let target_path = instance_root.join(&relative_path);
        if should_track_mod_manifest(&relative_path) {
            if let Some((project_id, version_id)) = extract_modrinth_source_ids(url) {
                tracked_manifest_sources.push((
                    file_name.clone(),
                    build_manifest_source(
                        ModSourceKind::ModpackDeployment,
                        Some("modrinth".to_string()),
                        Some(project_id),
                        Some(version_id),
                    ),
                    target_path.clone(),
                ));
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
                                reused_count += 1;
                                continue;
                            }
                        }
                    } else {
                        reused_count += 1;
                        continue;
                    }
                } else {
                    reused_count += 1;
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
        logger
            .info(
                "MODRINTH_MODS",
                format!(
                    "Running {} Modrinth downloads (reused={} skipped={})",
                    tasks.len(),
                    reused_count,
                    skipped_count
                ),
            )
            .await;
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
    } else {
        logger
            .info(
                "MODRINTH_MODS",
                format!(
                    "No Modrinth downloads needed (reused={} skipped={})",
                    reused_count, skipped_count
                ),
            )
            .await;
    }

    let mut manifest_entries = Vec::new();
    for (file_name, source, target_path) in tracked_manifest_sources {
        if let (Ok(file_state), Ok(hash)) = (
            build_file_state(&target_path),
            compute_file_hash(&target_path),
        ) {
            manifest_entries.push((file_name, build_manifest_entry(source, hash, file_state)));
        }
    }

    logger
        .info(
            "MODRINTH_MODS",
            format!("Finalizing mod manifest entries={}", manifest_entries.len()),
        )
        .await;
    finalize_imported_mod_manifest(instance_root, manifest_entries)
}

async fn download_curseforge_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
    base_dir: &Path,
    cancel: &Arc<AtomicBool>,
    logger: &ModpackImportLogger,
) -> Result<(), String> {
    let mut archive = open_modpack_archive(zip_path)?;
    let contents = read_zip_entry_to_string(&mut archive, "manifest.json")?;
    let manifest: CurseForgeManifest =
        serde_json::from_str(&contents).map_err(|e| format!("Failed to parse manifest: {}", e))?;
    logger
        .info(
            "CURSEFORGE_MODS",
            format!(
                "CurseForge manifest loaded: declared_files={}",
                manifest.files.len()
            ),
        )
        .await;

    let api_key = resolve_curseforge_api_key().ok_or_else(|| {
        "CurseForge API key is missing. Set VITE_CURSEFORGE_API_KEY or CURSEFORGE_API_KEY."
            .to_string()
    })?;
    logger
        .info("CURSEFORGE_MODS", "CurseForge API key resolved")
        .await;

    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        8
    };
    let retry_count = dl_settings.retry_count;
    let verify_hash = dl_settings.verify_after_download;
    let speed_limit_bytes_per_sec = ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);
    logger
        .info(
            "CURSEFORGE_MODS",
            format!(
                "Download settings: concurrency={} retry_count={} verify_hash={} timeout={}s speed_limit={}B/s",
                concurrency,
                retry_count,
                verify_hash,
                dl_settings.timeout,
                speed_limit_bytes_per_sec
            ),
        )
        .await;

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
    logger
        .info(
            "CURSEFORGE_MODS",
            format!("Temporary directory: {}", temp_root.display()),
        )
        .await;

    let entries: Vec<CurseForgeManifestFile> = manifest
        .files
        .into_iter()
        .filter(|entry| entry.required.unwrap_or(true))
        .collect();

    if entries.is_empty() {
        logger
            .info("CURSEFORGE_MODS", "No required CurseForge files declared")
            .await;
        return finalize_imported_mod_manifest(instance_root, Vec::new());
    }
    logger
        .info(
            "CURSEFORGE_MODS",
            format!("Required CurseForge files: {}", entries.len()),
        )
        .await;

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
    let mut reused_count = 0usize;
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
                                reused_count += 1;
                                continue;
                            }
                        }
                    } else {
                        reused_count += 1;
                        continue;
                    }
                } else {
                    reused_count += 1;
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
    }

    if !tasks.is_empty() {
        logger
            .info(
                "CURSEFORGE_MODS",
                format!(
                    "Running {} CurseForge downloads (reused={} info_concurrency={})",
                    tasks.len(),
                    reused_count,
                    info_concurrency
                ),
            )
            .await;
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
    } else {
        logger
            .info(
                "CURSEFORGE_MODS",
                format!("No CurseForge downloads needed (reused={})", reused_count),
            )
            .await;
    }

    let mut manifest_entries = Vec::new();
    for (file_name, source, target_path) in tracked_manifest_sources {
        if let (Ok(file_state), Ok(hash)) = (
            build_file_state(&target_path),
            compute_file_hash(&target_path),
        ) {
            manifest_entries.push((file_name, build_manifest_entry(source, hash, file_state)));
        }
    }

    logger
        .info(
            "CURSEFORGE_MODS",
            format!("Finalizing mod manifest entries={}", manifest_entries.len()),
        )
        .await;
    finalize_imported_mod_manifest(instance_root, manifest_entries)
}
