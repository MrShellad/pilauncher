use crate::domain::instance::InstanceConfig;
use crate::domain::mod_manifest::{mod_manifest_key, ModManifestEntry};
use crate::domain::modpack::{
    PiPackManifest, PiPackMinecraftInfo, PiPackModEntry, PiPackPackageInfo, PIPACK_FORMAT_VERSION,
    PIPACK_MANIFEST_FILE, PIPACK_OVERRIDES_DIR,
};
use crate::services::config_service::ConfigService;
use crate::services::instance::mod_manifest_service::ModManifestService;
use chrono::Utc;
use reqwest::Client;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

#[derive(Serialize, Deserialize, Clone)]
pub struct ExportProgress {
    pub current: u64,
    pub total: u64,
    pub message: String,
    pub stage: String,
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExportConfig {
    pub instance_id: String,
    pub name: String,
    pub version: String,
    pub author: String,
    pub description: String,
    pub format: String, // "zip", "curseforge", "mrpack", "pipack"
    pub manifest_mode: bool,
    pub include_mods: bool,
    pub include_configs: bool,
    pub include_resource_packs: bool,
    pub include_shader_packs: bool,
    pub include_saves: bool,
    pub additional_paths: Vec<String>,
    pub output_path: String,
}

#[derive(Default, Clone)]
struct ExportedJarMeta {
    mod_id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
}

struct PlannedArchiveFile {
    source_path: PathBuf,
    archive_path: String,
    relative_path: PathBuf,
}

#[derive(Default)]
struct ExportArtifacts {
    pipack_manifest: Option<PiPackManifest>,
    skipped_files: HashSet<String>,
    curseforge_files: Vec<CurseForgeManifestFileReference>,
    mrpack_files: Vec<MrpackManifestFile>,
}

struct ExportableModFile {
    file_name: String,
    path: PathBuf,
    relative_path_str: String,
    manifest_entry: ModManifestEntry,
}

#[derive(Serialize)]
struct CurseForgeManifestFileReference {
    #[serde(rename = "projectID")]
    project_id: u64,
    #[serde(rename = "fileID")]
    file_id: u64,
    required: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MrpackManifestFile {
    path: String,
    hashes: MrpackManifestHashes,
    downloads: Vec<String>,
    file_size: u64,
}

#[derive(Serialize)]
struct MrpackManifestHashes {
    sha1: String,
    sha512: String,
}

#[derive(Deserialize)]
struct ModrinthExportVersion {
    project_id: String,
    files: Vec<ModrinthExportFile>,
}

#[derive(Deserialize)]
struct ModrinthExportFile {
    url: String,
    filename: String,
    hashes: HashMap<String, String>,
    size: Option<u64>,
    primary: Option<bool>,
}

pub async fn execute_export<R: Runtime>(
    app: &AppHandle<R>,
    config: ExportConfig,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;

    let instance_dir = PathBuf::from(&base_path_str)
        .join("instances")
        .join(&config.instance_id);
    if !instance_dir.exists() {
        return Err("Instance directory not found".to_string());
    }

    let instance_meta = load_instance_meta(&instance_dir, &config)?;
    let overrides_prefix = resolve_overrides_prefix(&config.format);

    let _ = app.emit(
        "export-progress",
        ExportProgress {
            current: 0,
            total: 100,
            message: "Initializing export...".to_string(),
            stage: "INIT".to_string(),
        },
    );

    let artifacts = prepare_export_artifacts(app, &instance_dir, &instance_meta, &config).await?;
    let files_to_pack = collect_files_to_pack(
        &instance_dir,
        &config,
        overrides_prefix.as_deref(),
        &artifacts.skipped_files,
    )?;

    let output_file = File::create(&config.output_path).map_err(|e| e.to_string())?;
    let mut zip = ZipWriter::new(output_file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    let total_files = std::cmp::max(files_to_pack.len() as u64, 1);
    for (index, planned) in files_to_pack.iter().enumerate() {
        zip.start_file(planned.archive_path.as_str(), options)
            .map_err(|e| e.to_string())?;

        let mut file = File::open(&planned.source_path).map_err(|e| e.to_string())?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
        zip.write_all(&buffer).map_err(|e| e.to_string())?;

        let _ = app.emit(
            "export-progress",
            ExportProgress {
                current: (index + 1) as u64,
                total: total_files,
                message: format!("Packing {:?}", planned.relative_path),
                stage: "PACKING".to_string(),
            },
        );
    }

    write_export_manifest(&mut zip, options, &config, &instance_meta, artifacts)?;

    zip.finish().map_err(|e| e.to_string())?;

    let _ = app.emit(
        "export-progress",
        ExportProgress {
            current: 100,
            total: 100,
            message: "Export completed successfully.".to_string(),
            stage: "DONE".to_string(),
        },
    );

    Ok(())
}

fn load_instance_meta(
    instance_dir: &Path,
    config: &ExportConfig,
) -> Result<InstanceConfig, String> {
    let instance_json_path = instance_dir.join("instance.json");
    let content = fs::read_to_string(&instance_json_path).unwrap_or_default();
    Ok(
        serde_json::from_str(&content).unwrap_or_else(|_| InstanceConfig {
            id: config.instance_id.clone(),
            name: config.name.clone(),
            mc_version: "1.20.1".to_string(),
            loader: crate::domain::instance::LoaderConfig {
                r#type: "vanilla".to_string(),
                version: "".to_string(),
            },
            java: crate::domain::instance::JavaConfig {
                path: "".to_string(),
                version: "".to_string(),
            },
            memory: crate::domain::instance::MemoryConfig {
                min: 1024,
                max: 4096,
            },
            resolution: crate::domain::instance::ResolutionConfig {
                width: 854,
                height: 480,
            },
            play_time: 0.0,
            last_played: "".to_string(),
            created_at: "".to_string(),
            cover_image: None,
            hero_logo: None,
            gamepad: None,
            custom_buttons: None,
            third_party_path: None,
            server_binding: None,
            auto_join_server: None,
            tags: None,
            jvm_args: None,
            window_width: None,
            window_height: None,
            is_favorite: None,
        }),
    )
}

fn resolve_overrides_prefix(format: &str) -> Option<String> {
    match format {
        "zip" => None,
        "curseforge" | "mrpack" | "pipack" => Some(format!("{}/", PIPACK_OVERRIDES_DIR)),
        _ => Some(format!("{}/", PIPACK_OVERRIDES_DIR)),
    }
}

async fn prepare_export_artifacts<R: Runtime>(
    app: &AppHandle<R>,
    instance_dir: &Path,
    instance_meta: &InstanceConfig,
    config: &ExportConfig,
) -> Result<ExportArtifacts, String> {
    let mut artifacts = ExportArtifacts::default();

    if config.format == "pipack" {
        let (pipack_manifest, skipped_files) =
            prepare_pipack_manifest(instance_dir, instance_meta, config)?;
        artifacts.pipack_manifest = pipack_manifest;
        artifacts.skipped_files = skipped_files;
        return Ok(artifacts);
    }

    if !config.include_mods || !config.manifest_mode {
        return Ok(artifacts);
    }

    let exportable_mods = load_exportable_mod_files(instance_dir)?;
    match config.format.as_str() {
        "curseforge" => {
            let (files, skipped_files) = build_curseforge_manifest_files(&exportable_mods);
            artifacts.curseforge_files = files;
            artifacts.skipped_files = skipped_files;
        }
        "mrpack" => {
            let (files, skipped_files) = build_mrpack_manifest_files(app, &exportable_mods).await?;
            artifacts.mrpack_files = files;
            artifacts.skipped_files = skipped_files;
        }
        _ => {}
    }

    Ok(artifacts)
}

fn prepare_pipack_manifest(
    instance_dir: &Path,
    instance_meta: &InstanceConfig,
    config: &ExportConfig,
) -> Result<(Option<PiPackManifest>, HashSet<String>), String> {
    if config.format != "pipack" {
        return Ok((None, HashSet::new()));
    }

    let mut skip_mods = HashSet::new();
    let mut mods = Vec::new();

    if config.include_mods {
        let mods_dir = instance_dir.join("mods");
        let manifest_path = instance_dir.join("mod_manifest.json");
        let manifest_entries = ModManifestService::sync_from_mods_dir(&mods_dir, &manifest_path)?;

        if mods_dir.exists() {
            for entry in fs::read_dir(&mods_dir).map_err(|e| e.to_string())? {
                let entry = match entry {
                    Ok(entry) => entry,
                    Err(_) => continue,
                };
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }

                let file_name = entry.file_name().to_string_lossy().to_string();
                if !is_mod_archive(&file_name) {
                    continue;
                }

                let base_name = mod_manifest_key(&file_name);
                let Some(manifest_entry) = manifest_entries.get(&base_name).cloned() else {
                    continue;
                };

                let relative_path = PathBuf::from("mods").join(&file_name);
                let relative_path_str = normalize_zip_path(&relative_path);
                let platform_scanned = has_platform_reference(&manifest_entry);
                if platform_scanned {
                    skip_mods.insert(relative_path_str.clone());
                }

                let jar_meta = parse_jar_metadata(&path);
                mods.push(PiPackModEntry {
                    file_name: file_name.clone(),
                    path: relative_path_str.clone(),
                    enabled: !file_name.ends_with(".disabled"),
                    mod_id: jar_meta.mod_id,
                    name: jar_meta.name,
                    version: jar_meta.version,
                    description: jar_meta.description,
                    source: manifest_entry.source,
                    hash: manifest_entry.hash,
                    file_state: manifest_entry.file_state,
                    bundled_path: if platform_scanned {
                        None
                    } else {
                        Some(format!("{}/{}", PIPACK_OVERRIDES_DIR, relative_path_str))
                    },
                });
            }
        }
    }

    mods.sort_by(|left, right| left.file_name.cmp(&right.file_name));

    let manifest = PiPackManifest {
        format_version: PIPACK_FORMAT_VERSION,
        package: PiPackPackageInfo {
            name: config.name.clone(),
            version: config.version.clone(),
            author: config.author.clone(),
            description: config.description.clone(),
            uuid: build_pack_uuid(&instance_meta.id),
            packaged_at: Utc::now().to_rfc3339(),
        },
        minecraft: PiPackMinecraftInfo {
            version: instance_meta.mc_version.clone(),
            loader: normalize_loader_name(&instance_meta.loader.r#type),
            loader_version: instance_meta.loader.version.clone(),
            instance_id: instance_meta.id.clone(),
            instance_name: instance_meta.name.clone(),
        },
        overrides: PIPACK_OVERRIDES_DIR.to_string(),
        mods,
        server: instance_meta.server_binding.clone(),
    };

    Ok((Some(manifest), skip_mods))
}

fn load_exportable_mod_files(instance_dir: &Path) -> Result<Vec<ExportableModFile>, String> {
    let mods_dir = instance_dir.join("mods");
    let manifest_path = instance_dir.join("mod_manifest.json");
    let manifest_entries = ModManifestService::sync_from_mods_dir(&mods_dir, &manifest_path)?;
    let mut files = Vec::new();

    if !mods_dir.exists() {
        return Ok(files);
    }

    for entry in fs::read_dir(&mods_dir).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(entry) => entry,
            Err(_) => continue,
        };
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        if !is_mod_archive(&file_name) {
            continue;
        }

        let key = mod_manifest_key(&file_name);
        let Some(manifest_entry) = manifest_entries.get(&key).cloned() else {
            continue;
        };

        let relative_path = PathBuf::from("mods").join(&file_name);
        let relative_path_str = normalize_zip_path(&relative_path);
        files.push(ExportableModFile {
            file_name,
            path,
            relative_path_str,
            manifest_entry,
        });
    }

    Ok(files)
}

fn build_curseforge_manifest_files(
    exportable_mods: &[ExportableModFile],
) -> (Vec<CurseForgeManifestFileReference>, HashSet<String>) {
    let mut files = Vec::new();
    let mut skipped_files = HashSet::new();
    let mut referenced_projects = HashSet::new();

    for item in exportable_mods {
        if item.file_name.ends_with(".disabled") {
            continue;
        }

        let source = &item.manifest_entry.source;
        if !source
            .platform
            .as_deref()
            .is_some_and(|platform| platform.eq_ignore_ascii_case("curseforge"))
        {
            continue;
        }

        let Some(project_id) = source
            .project_id
            .as_deref()
            .and_then(|value| value.trim().parse::<u64>().ok())
        else {
            continue;
        };
        let Some(file_id) = source
            .file_id
            .as_deref()
            .and_then(|value| value.trim().parse::<u64>().ok())
        else {
            continue;
        };

        if !referenced_projects.insert(project_id) {
            continue;
        }

        files.push(CurseForgeManifestFileReference {
            project_id,
            file_id,
            required: true,
        });
        skipped_files.insert(item.relative_path_str.clone());
    }

    (files, skipped_files)
}

async fn build_mrpack_manifest_files<R: Runtime>(
    app: &AppHandle<R>,
    exportable_mods: &[ExportableModFile],
) -> Result<(Vec<MrpackManifestFile>, HashSet<String>), String> {
    let client = build_export_http_client(app)?;
    let mut files = Vec::new();
    let mut skipped_files = HashSet::new();

    for item in exportable_mods {
        let Some(manifest_file) = build_mrpack_manifest_file(&client, item).await? else {
            continue;
        };
        files.push(manifest_file);
        skipped_files.insert(item.relative_path_str.clone());
    }

    Ok((files, skipped_files))
}

fn build_export_http_client<R: Runtime>(app: &AppHandle<R>) -> Result<Client, String> {
    let settings = ConfigService::get_download_settings(app);
    let mut builder = Client::builder()
        .user_agent("PiLauncher/1.0 (Export)")
        .connect_timeout(std::time::Duration::from_secs(settings.timeout.max(1)));

    if settings.proxy_type != "none" {
        let host = settings.proxy_host.trim();
        let port = settings.proxy_port.trim();
        if !host.is_empty() && !port.is_empty() {
            let scheme = match settings.proxy_type.as_str() {
                "http" => "http",
                "https" => "https",
                "socks5" => "socks5h",
                _ => "http",
            };
            let proxy_url = format!("{}://{}:{}", scheme, host, port);
            builder = builder.proxy(reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?);
        }
    }

    builder.build().map_err(|e| e.to_string())
}

async fn build_mrpack_manifest_file(
    client: &Client,
    item: &ExportableModFile,
) -> Result<Option<MrpackManifestFile>, String> {
    let source = &item.manifest_entry.source;
    if !source
        .platform
        .as_deref()
        .is_some_and(|platform| platform.eq_ignore_ascii_case("modrinth"))
    {
        return Ok(None);
    }

    let Some(project_id) = source.project_id.as_deref().map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let Some(version_id) = source.file_id.as_deref().map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    let version = fetch_modrinth_export_version(client, version_id).await?;
    if version.project_id != project_id {
        return Ok(None);
    }

    let Some(remote_file) = select_modrinth_export_file(&version, item) else {
        return Ok(None);
    };
    let Some(remote_sha1) = remote_file.hashes.get("sha1").cloned() else {
        return Ok(None);
    };
    let Some(remote_sha512) = remote_file.hashes.get("sha512").cloned() else {
        return Ok(None);
    };

    if !item
        .manifest_entry
        .hash
        .value
        .eq_ignore_ascii_case(&remote_sha1)
    {
        return Ok(None);
    }

    Ok(Some(MrpackManifestFile {
        path: item.relative_path_str.clone(),
        hashes: MrpackManifestHashes {
            sha1: remote_sha1,
            sha512: remote_sha512,
        },
        downloads: vec![remote_file.url.clone()],
        file_size: remote_file
            .size
            .or_else(|| item.manifest_entry.file_state.as_ref().map(|state| state.size))
            .unwrap_or_else(|| fs::metadata(&item.path).map(|metadata| metadata.len()).unwrap_or(0)),
    }))
}

async fn fetch_modrinth_export_version(
    client: &Client,
    version_id: &str,
) -> Result<ModrinthExportVersion, String> {
    let url = format!("https://api.modrinth.com/v2/version/{}", version_id);
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Modrinth request failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!(
            "Modrinth request failed: {} (version {})",
            response.status(),
            version_id
        ));
    }

    response
        .json()
        .await
        .map_err(|e| format!("Modrinth response parse failed: {}", e))
}

fn select_modrinth_export_file<'a>(
    version: &'a ModrinthExportVersion,
    item: &ExportableModFile,
) -> Option<&'a ModrinthExportFile> {
    let expected_hash = item.manifest_entry.hash.value.to_ascii_lowercase();
    let normalized_name = item.file_name.trim_end_matches(".disabled");

    version
        .files
        .iter()
        .find(|file| {
            file.hashes
                .get("sha1")
                .is_some_and(|value| value.eq_ignore_ascii_case(&expected_hash))
        })
        .or_else(|| version.files.iter().find(|file| file.filename == normalized_name))
        .or_else(|| version.files.iter().find(|file| file.primary.unwrap_or(false)))
        .or_else(|| version.files.first())
}

fn collect_files_to_pack(
    instance_dir: &Path,
    config: &ExportConfig,
    overrides_prefix: Option<&str>,
    skipped_files: &HashSet<String>,
) -> Result<Vec<PlannedArchiveFile>, String> {
    let mut folders_to_include = Vec::new();
    if config.include_mods {
        folders_to_include.push("mods");
    }
    if config.include_configs {
        folders_to_include.push("config");
    }
    if config.include_resource_packs {
        folders_to_include.push("resourcepacks");
    }
    if config.include_shader_packs {
        folders_to_include.push("shaderpacks");
    }
    if config.include_saves {
        folders_to_include.push("saves");
    }
    for path in &config.additional_paths {
        folders_to_include.push(path.as_str());
    }

    let mut files = Vec::new();
    for folder in folders_to_include {
        let folder_path = instance_dir.join(folder);
        if !folder_path.exists() {
            continue;
        }

        for entry in WalkDir::new(&folder_path) {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let relative_path = path
                .strip_prefix(instance_dir)
                .map_err(|e| e.to_string())?
                .to_path_buf();
            let relative_path_str = normalize_zip_path(&relative_path);

            if skipped_files.contains(&relative_path_str) {
                continue;
            }

            let archive_path = if let Some(prefix) = overrides_prefix {
                format!("{}{}", prefix, relative_path_str)
            } else {
                format!("{}/{}", config.name, relative_path_str)
            };

            files.push(PlannedArchiveFile {
                source_path: path.to_path_buf(),
                archive_path,
                relative_path,
            });
        }
    }

    Ok(files)
}

fn write_export_manifest(
    zip: &mut ZipWriter<File>,
    options: SimpleFileOptions,
    config: &ExportConfig,
    instance_meta: &InstanceConfig,
    artifacts: ExportArtifacts,
) -> Result<(), String> {
    match config.format.as_str() {
        "curseforge" => {
            let manifest = serde_json::json!({
                "minecraft": {
                    "version": instance_meta.mc_version,
                    "modLoaders": [
                        {
                            "id": format!("{}-{}", instance_meta.loader.r#type, instance_meta.loader.version),
                            "primary": true
                        }
                    ]
                },
                "manifestType": "minecraftModpack",
                "manifestVersion": 1,
                "name": config.name,
                "version": config.version,
                "author": config.author,
                "files": artifacts.curseforge_files,
                "overrides": PIPACK_OVERRIDES_DIR
            });
            let manifest_str =
                serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
            zip.start_file("manifest.json", options)
                .map_err(|e| e.to_string())?;
            zip.write_all(manifest_str.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        "mrpack" => {
            let mut dependencies = serde_json::Map::new();
            dependencies.insert(
                "minecraft".to_string(),
                serde_json::Value::String(instance_meta.mc_version.clone()),
            );
            dependencies.insert(
                instance_meta.loader.r#type.clone(),
                serde_json::Value::String(instance_meta.loader.version.clone()),
            );
            let modrinth_index = serde_json::json!({
                "formatVersion": 1,
                "game": "minecraft",
                "versionId": config.version,
                "name": config.name,
                "summary": config.description,
                "dependencies": dependencies,
                "files": artifacts.mrpack_files
            });
            let index_str =
                serde_json::to_string_pretty(&modrinth_index).map_err(|e| e.to_string())?;
            zip.start_file("modrinth.index.json", options)
                .map_err(|e| e.to_string())?;
            zip.write_all(index_str.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        "pipack" => {
            let manifest = artifacts
                .pipack_manifest
                .ok_or_else(|| "PiPack manifest missing".to_string())?;
            let manifest_str =
                serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
            zip.start_file(PIPACK_MANIFEST_FILE, options)
                .map_err(|e| e.to_string())?;
            zip.write_all(manifest_str.as_bytes())
                .map_err(|e| e.to_string())?;
        }
        _ => {}
    }

    Ok(())
}

fn build_pack_uuid(instance_id: &str) -> String {
    Uuid::new_v5(
        &Uuid::NAMESPACE_URL,
        format!("pilauncher:pipack:{}", instance_id).as_bytes(),
    )
    .to_string()
}

fn has_platform_reference(entry: &ModManifestEntry) -> bool {
    entry
        .source
        .platform
        .as_deref()
        .is_some_and(|value| !value.trim().is_empty())
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
}

fn normalize_zip_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn is_mod_archive(file_name: &str) -> bool {
    file_name.ends_with(".jar") || file_name.ends_with(".jar.disabled")
}

fn normalize_loader_name(loader: &str) -> String {
    let lower = loader.trim().to_ascii_lowercase();
    match lower.as_str() {
        "fabric" => "Fabric".to_string(),
        "forge" => "Forge".to_string(),
        "neoforge" => "NeoForge".to_string(),
        "quilt" => "Quilt".to_string(),
        "vanilla" => "Vanilla".to_string(),
        _ => loader.to_string(),
    }
}

fn parse_jar_metadata(jar_path: &Path) -> ExportedJarMeta {
    let file = match File::open(jar_path) {
        Ok(file) => file,
        Err(_) => return ExportedJarMeta::default(),
    };
    let mut archive = match zip::ZipArchive::new(file) {
        Ok(archive) => archive,
        Err(_) => return ExportedJarMeta::default(),
    };

    if let Ok(mut file) = archive.by_name("fabric.mod.json") {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                return ExportedJarMeta {
                    mod_id: json["id"].as_str().map(|value| value.to_string()),
                    name: json["name"].as_str().map(|value| value.to_string()),
                    version: json["version"].as_str().map(|value| value.to_string()),
                    description: json["description"].as_str().map(|value| value.to_string()),
                };
            }
        }
    }

    if let Ok(mut file) = archive.by_name("quilt.mod.json") {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&contents) {
                let quilt_loader = json.get("quilt_loader").cloned().unwrap_or_default();
                let metadata = quilt_loader.get("metadata").cloned().unwrap_or_default();
                return ExportedJarMeta {
                    mod_id: quilt_loader
                        .get("id")
                        .and_then(|value| value.as_str())
                        .or_else(|| json.get("id").and_then(|value| value.as_str()))
                        .map(|value| value.to_string()),
                    name: metadata
                        .get("name")
                        .and_then(|value| value.as_str())
                        .or_else(|| json.get("name").and_then(|value| value.as_str()))
                        .map(|value| value.to_string()),
                    version: quilt_loader
                        .get("version")
                        .and_then(|value| value.as_str())
                        .or_else(|| json.get("version").and_then(|value| value.as_str()))
                        .map(|value| value.to_string()),
                    description: metadata
                        .get("description")
                        .and_then(|value| value.as_str())
                        .or_else(|| json.get("description").and_then(|value| value.as_str()))
                        .map(|value| value.to_string()),
                };
            }
        }
    }

    if let Ok(mut file) = archive.by_name("META-INF/neoforge.mods.toml") {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            return parse_toml_like_mod_metadata(&contents);
        }
    }

    if let Ok(mut file) = archive.by_name("META-INF/mods.toml") {
        let mut contents = String::new();
        if file.read_to_string(&mut contents).is_ok() {
            return parse_toml_like_mod_metadata(&contents);
        }
    }

    ExportedJarMeta::default()
}

fn parse_toml_like_mod_metadata(contents: &str) -> ExportedJarMeta {
    let capture = |pattern: &str| {
        Regex::new(pattern)
            .ok()
            .and_then(|regex| regex.captures(contents))
            .and_then(|captures| captures.get(1))
            .map(|value| value.as_str().trim().to_string())
    };

    ExportedJarMeta {
        mod_id: capture(r#"(?m)^\s*modId\s*=\s*["']([^"']+)["']"#),
        name: capture(r#"(?m)^\s*displayName\s*=\s*["']([^"']+)["']"#),
        version: capture(r#"(?m)^\s*version\s*=\s*["']([^"']+)["']"#),
        description: capture(r#"(?m)^\s*description\s*=\s*["']([^"']+)["']"#),
    }
}
