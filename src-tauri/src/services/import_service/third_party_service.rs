use crate::domain::instance::{
    InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::domain::modpack::{
    MissingRuntime, ThirdPartyImportFailure, ThirdPartyImportInstance,
    ThirdPartyImportProgressEvent, ThirdPartyImportResult, ThirdPartyImportSource,
};
use crate::services::config_service::ConfigService;
use crate::services::minecraft_service::{detect_missing_runtime, parse_third_party_json};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Debug, Clone)]
pub(crate) struct ThirdPartyInstanceCandidate {
    pub id: String,
    pub name: String,
    pub path: String,
    pub version_json_path: String,
    pub mc_version: String,
    pub loader_type: String,
    pub loader_version: String,
}

fn build_third_party_instance_config(candidate: &ThirdPartyInstanceCandidate) -> InstanceConfig {
    InstanceConfig {
        id: candidate.id.clone(),
        name: candidate.name.clone(),
        mc_version: candidate.mc_version.clone(),
        loader: LoaderConfig {
            r#type: candidate.loader_type.clone(),
            version: candidate.loader_version.clone(),
        },
        java: JavaConfig {
            path: "auto".to_string(),
            version: "auto".to_string(),
        },
        memory: MemoryConfig {
            min: 1024,
            max: 4096,
        },
        resolution: ResolutionConfig {
            width: 854,
            height: 480,
        },
        play_time: 0.0,
        last_played: String::new(),
        created_at: chrono::Local::now().to_rfc3339(),
        cover_image: None,
        hero_logo: None,
        gamepad: None,
        custom_buttons: None,
        third_party_path: Some(candidate.path.clone()),
        server_binding: None,
        auto_join_server: None,
        tags: None,
        jvm_args: None,
        window_width: None,
        window_height: None,
        is_favorite: None,
    }
}

fn to_import_instance(
    candidate: &ThirdPartyInstanceCandidate,
    status: impl Into<String>,
) -> ThirdPartyImportInstance {
    ThirdPartyImportInstance {
        id: candidate.id.clone(),
        name: candidate.name.clone(),
        path: candidate.path.clone(),
        version_json_path: candidate.version_json_path.clone(),
        mc_version: candidate.mc_version.clone(),
        loader_type: candidate.loader_type.clone(),
        loader_version: candidate.loader_version.clone(),
        status: status.into(),
    }
}

fn emit_third_party_import_progress<R: Runtime>(
    app: &AppHandle<R>,
    source_path: &str,
    phase: &str,
    level: &str,
    current: u64,
    total: u64,
    message: impl Into<String>,
    instance_id: Option<&str>,
) {
    let _ = app.emit(
        "third-party-import-progress",
        ThirdPartyImportProgressEvent {
            source_path: source_path.to_string(),
            phase: phase.to_string(),
            level: level.to_string(),
            current,
            total,
            message: message.into(),
            instance_id: instance_id.map(|value| value.to_string()),
        },
    );
}

fn resolve_third_party_source(
    path: &Path,
    label: String,
    kind: String,
) -> Option<ThirdPartyImportSource> {
    let mut root_path = path.to_path_buf();
    let mut versions_path = path.join("versions");

    if path.file_name().and_then(|value| value.to_str()) == Some("versions") {
        versions_path = path.to_path_buf();
        if let Some(parent) = path.parent() {
            root_path = parent.to_path_buf();
        }
    } else if !versions_path.exists() {
        return None;
    }

    Some(ThirdPartyImportSource {
        source_path: path.to_string_lossy().to_string(),
        root_path: root_path.to_string_lossy().to_string(),
        versions_path: versions_path.to_string_lossy().to_string(),
        source_kind: kind,
        source_label: label,
        launcher_hint: "Minecraft".to_string(),
        has_assets: root_path.join("assets").exists(),
        has_libraries: root_path.join("libraries").exists(),
        instance_count: 0,
        importable_count: 0,
        already_imported_count: 0,
        conflict_count: 0,
        instances: Vec::new(),
    })
}

fn scan_third_party_source(
    source: &ThirdPartyImportSource,
    instances_dir: &Path,
) -> Option<ThirdPartyImportSource> {
    let mut result = source.clone();
    let versions_dir = PathBuf::from(&source.versions_path);

    if !versions_dir.exists() {
        return None;
    }

    if let Ok(entries) = fs::read_dir(versions_dir) {
        for entry in entries.flatten() {
            let child = entry.path();
            if !child.is_dir() {
                continue;
            }

            let candidate = match read_candidate_from_dir(&child) {
                Ok(Some(candidate)) => candidate,
                _ => continue,
            };

            result.instance_count += 1;

            let dest_dir = instances_dir.join(&candidate.id);
            let status = if dest_dir.exists() {
                if dest_dir.join("instance.json").exists() {
                    let json_content =
                        fs::read_to_string(dest_dir.join("instance.json")).unwrap_or_default();
                    if json_content.contains(&candidate.path) {
                        result.already_imported_count += 1;
                        "already_imported"
                    } else {
                        result.conflict_count += 1;
                        "name_conflict"
                    }
                } else {
                    result.conflict_count += 1;
                    "name_conflict"
                }
            } else {
                result.importable_count += 1;
                "importable"
            };

            result.instances.push(to_import_instance(&candidate, status));
        }
    }

    Some(result)
}

pub(crate) fn read_candidate_from_dir(
    dir: &Path,
) -> Result<Option<ThirdPartyInstanceCandidate>, String> {
    if !dir.exists() || !dir.is_dir() {
        return Ok(None);
    }

    let Some(dir_name) = dir.file_name().and_then(|value| value.to_str()) else {
        return Ok(None);
    };

    if dir_name.trim().is_empty() {
        return Ok(None);
    }

    let version_json_path = dir.join(format!("{}.json", dir_name));
    if !version_json_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&version_json_path).map_err(|error| error.to_string())?;
    let json: serde_json::Value =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    let (mc_version, loader_type, loader_version) = parse_third_party_json(dir_name, &json);

    Ok(Some(ThirdPartyInstanceCandidate {
        id: dir_name.to_string(),
        name: dir_name.to_string(),
        path: dir.to_string_lossy().to_string(),
        version_json_path: version_json_path.to_string_lossy().to_string(),
        mc_version,
        loader_type,
        loader_version,
    }))
}

pub(crate) fn register_candidate_instance(
    candidate: &ThirdPartyInstanceCandidate,
    instances_dir: &Path,
) -> Result<(), String> {
    let dest_dir = instances_dir.join(&candidate.id);
    fs::create_dir_all(&dest_dir).map_err(|error| error.to_string())?;

    let config = build_third_party_instance_config(candidate);
    let config_content =
        serde_json::to_string_pretty(&config).map_err(|error| error.to_string())?;

    fs::write(dest_dir.join("instance.json"), &config_content)
        .map_err(|error| error.to_string())?;
    fs::write(PathBuf::from(&candidate.path).join("instance.json"), &config_content)
        .map_err(|error| error.to_string())?;

    Ok(())
}

pub async fn import_single_instance<R: Runtime>(
    app: &AppHandle<R>,
    path: String,
) -> Result<Option<MissingRuntime>, String> {
    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("Selected path is not a valid directory.".to_string());
    }

    let candidate = read_candidate_from_dir(&dir_path)?.ok_or_else(|| {
        let id = dir_path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("instance");
        format!(
            "Could not find {}.json. Select a third-party launcher versions/<instance> directory.",
            id
        )
    })?;

    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let runtime_dir = PathBuf::from(&base_path).join("runtime");
    let instances_dir = PathBuf::from(&base_path).join("instances");

    fs::create_dir_all(&instances_dir).map_err(|error| error.to_string())?;
    register_candidate_instance(&candidate, &instances_dir)?;

    Ok(detect_missing_runtime(
        &runtime_dir,
        &candidate.id,
        &candidate.mc_version,
        &candidate.loader_type,
        &candidate.loader_version,
    ))
}

pub async fn detect_launcher_sources<R: Runtime>(
    app: &AppHandle<R>,
    path: Option<String>,
) -> Result<Vec<ThirdPartyImportSource>, String> {
    let instances_dir = ConfigService::get_base_path(app)
        .ok()
        .flatten()
        .map(|base_path| PathBuf::from(base_path).join("instances"))
        .unwrap_or_else(|| PathBuf::from("__missing_instances_dir__"));

    let mut sources = Vec::new();

    if let Some(raw_path) = path {
        let trimmed_path = raw_path.trim();
        if !trimmed_path.is_empty() {
            if let Some(source) = resolve_third_party_source(
                Path::new(trimmed_path),
                "Manual Selection".to_string(),
                "manual".to_string(),
            ) {
                if let Some(scanned) = scan_third_party_source(&source, &instances_dir) {
                    sources.push(scanned);
                }
            }
        }
    }

    Ok(sources)
}

pub async fn import_launcher_source<R: Runtime>(
    app: &AppHandle<R>,
    path: String,
) -> Result<ThirdPartyImportResult, String> {
    let trimmed_path = path.trim();
    if trimmed_path.is_empty() {
        return Err("Import path cannot be empty".to_string());
    }

    let resolved = resolve_third_party_source(
        Path::new(trimmed_path),
        "Manual Selection".to_string(),
        "manual".to_string(),
    )
    .ok_or_else(|| {
        "Directory is not a recognized .minecraft root or versions folder.".to_string()
    })?;

    let source_path = resolved.source_path.clone();
    emit_third_party_import_progress(
        app,
        &source_path,
        "PREPARING",
        "info",
        0,
        1,
        "Inspecting launcher directory structure...",
        None,
    );

    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path).join("instances");
    let runtime_dir = PathBuf::from(&base_path).join("runtime");
    fs::create_dir_all(&instances_dir).map_err(|error| error.to_string())?;

    let source = scan_third_party_source(&resolved, &instances_dir).ok_or_else(|| {
        "No importable third-party instances were found in this directory.".to_string()
    })?;

    let total = source.instance_count.max(1) as u64;
    emit_third_party_import_progress(
        app,
        &source_path,
        "DISCOVERED",
        "info",
        0,
        total,
        format!(
            "Discovered {} candidate instances. Starting import...",
            source.instance_count
        ),
        None,
    );

    let mut result = ThirdPartyImportResult {
        source_path: source.source_path.clone(),
        root_path: source.root_path.clone(),
        source_kind: source.source_kind.clone(),
        added: 0,
        skipped: 0,
        failed: 0,
        missing: Vec::new(),
        imported_instances: Vec::new(),
        skipped_instances: Vec::new(),
        failed_instances: Vec::new(),
    };

    for (index, instance) in source.instances.into_iter().enumerate() {
        let current = index as u64 + 1;

        match instance.status.as_str() {
            "already_imported" => {
                emit_third_party_import_progress(
                    app,
                    &source_path,
                    "SKIPPED",
                    "warning",
                    current,
                    total,
                    format!("{} was already imported. Skipping.", instance.name),
                    Some(&instance.id),
                );
                result.skipped += 1;
                result.skipped_instances.push(instance);
                continue;
            }
            "name_conflict" => {
                emit_third_party_import_progress(
                    app,
                    &source_path,
                    "SKIPPED",
                    "warning",
                    current,
                    total,
                    format!(
                        "{} conflicts with an existing local instance. Skipping.",
                        instance.name
                    ),
                    Some(&instance.id),
                );
                result.skipped += 1;
                result.skipped_instances.push(instance);
                continue;
            }
            _ => {}
        }

        emit_third_party_import_progress(
            app,
            &source_path,
            "IMPORTING",
            "info",
            current,
            total,
            format!("Registering instance {}...", instance.name),
            Some(&instance.id),
        );

        let candidate = ThirdPartyInstanceCandidate {
            id: instance.id.clone(),
            name: instance.name.clone(),
            path: instance.path.clone(),
            version_json_path: instance.version_json_path.clone(),
            mc_version: instance.mc_version.clone(),
            loader_type: instance.loader_type.clone(),
            loader_version: instance.loader_version.clone(),
        };

        match register_candidate_instance(&candidate, &instances_dir) {
            Ok(()) => {
                if let Some(missing_runtime) = detect_missing_runtime(
                    &runtime_dir,
                    &candidate.id,
                    &candidate.mc_version,
                    &candidate.loader_type,
                    &candidate.loader_version,
                ) {
                    emit_third_party_import_progress(
                        app,
                        &source_path,
                        "VERIFY_RUNTIME",
                        "warning",
                        current,
                        total,
                        format!(
                            "{} was imported, but runtime files are still missing.",
                            instance.name
                        ),
                        Some(&instance.id),
                    );
                    result.missing.push(missing_runtime);
                } else {
                    emit_third_party_import_progress(
                        app,
                        &source_path,
                        "IMPORTED",
                        "success",
                        current,
                        total,
                        format!("{} was imported successfully.", instance.name),
                        Some(&instance.id),
                    );
                }

                let mut imported_instance = instance;
                imported_instance.status = "imported".to_string();
                result.added += 1;
                result.imported_instances.push(imported_instance);
            }
            Err(error) => {
                emit_third_party_import_progress(
                    app,
                    &source_path,
                    "FAILED",
                    "error",
                    current,
                    total,
                    format!("{} import failed: {}", instance.name, error),
                    Some(&instance.id),
                );
                result.failed += 1;
                result.failed_instances.push(ThirdPartyImportFailure {
                    instance_id: instance.id.clone(),
                    path: instance.path.clone(),
                    reason: error,
                });
            }
        }
    }

    emit_third_party_import_progress(
        app,
        &source_path,
        "DONE",
        if result.failed > 0 { "warning" } else { "success" },
        total,
        total,
        format!(
            "Import finished: added {}, skipped {}, failed {}.",
            result.added, result.skipped, result.failed
        ),
        None,
    );

    Ok(result)
}
