use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::{MissingRuntime, VerifyInstanceRuntimeResult};
use crate::services::config_service::ConfigService;
use crate::services::downloader::dependencies::scheduler::sha1_file;
use crate::services::minecraft_service::{
    evaluate_library_rules, get_mc_arch, get_mc_os, legacy_library_download_path,
    resolve_loader_folder,
};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};

fn push_sample_issue(samples: &mut Vec<String>, issue: String) {
    if samples.len() < 6 {
        samples.push(issue);
    }
}

fn push_verify_issue(issues: &mut Vec<String>, samples: &mut Vec<String>, issue: String) {
    if issues.len() < 200 {
        issues.push(issue.clone());
    } else if issues.len() == 200 {
        issues.push("Detected too many issues, showing partial result only.".to_string());
    }
    push_sample_issue(samples, issue);
}

fn emit_verify_progress<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    current: u64,
    total: u64,
    message: impl Into<String>,
) {
    let _ = app.emit(
        "instance-runtime-verify-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "VERIFY_RUNTIME".to_string(),
            file_name: String::new(),
            current,
            total,
            message: message.into(),
        },
    );
}

fn collect_manifest_library_targets(
    manifest: &serde_json::Value,
    runtime_dir: &Path,
    seen_paths: &mut HashSet<String>,
    targets: &mut Vec<(PathBuf, Option<String>, String)>,
) {
    let Some(libraries) = manifest["libraries"].as_array() else {
        return;
    };

    for library in libraries {
        if !evaluate_library_rules(library["rules"].as_array()) {
            continue;
        }

        let library_name = library["name"].as_str().unwrap_or("unknown-library");

        if let Some(artifact) = library.pointer("/downloads/artifact") {
            if let Some(download_path) = artifact["path"].as_str() {
                let path = runtime_dir.join("libraries").join(download_path);
                let key = path.to_string_lossy().to_string();
                if seen_paths.insert(key) {
                    targets.push((
                        path,
                        artifact["sha1"].as_str().map(|value| value.to_lowercase()),
                        library_name.to_string(),
                    ));
                }
            }
        } else if library.get("downloads").is_none() {
            if let Some(download_path) = legacy_library_download_path(library_name, None) {
                let path = runtime_dir.join("libraries").join(&download_path);
                let key = path.to_string_lossy().to_string();
                if seen_paths.insert(key) {
                    targets.push((path, None, library_name.to_string()));
                }
            }
        }

        if let Some(natives) = library["natives"].as_object() {
            let current_os = get_mc_os();
            if let Some(classifier_value) = natives.get(current_os) {
                let mut classifier_key = classifier_value.as_str().unwrap_or("").to_string();
                if classifier_key.contains("${arch}") {
                    classifier_key = classifier_key.replace("${arch}", get_mc_arch());
                }

                if let Some(classifier) =
                    library.pointer(&format!("/downloads/classifiers/{}", classifier_key))
                {
                    if let Some(download_path) = classifier["path"].as_str() {
                        let path = runtime_dir.join("libraries").join(download_path);
                        let key = path.to_string_lossy().to_string();
                        if seen_paths.insert(key) {
                            targets.push((
                                path,
                                classifier["sha1"].as_str().map(|value| value.to_lowercase()),
                                format!("{} ({})", library_name, classifier_key),
                            ));
                        }
                    }
                } else if library.get("downloads").is_none() {
                    if let Some(download_path) =
                        legacy_library_download_path(library_name, Some(&classifier_key))
                    {
                        let path = runtime_dir.join("libraries").join(&download_path);
                        let key = path.to_string_lossy().to_string();
                        if seen_paths.insert(key) {
                            targets.push((path, None, format!("{} ({})", library_name, classifier_key)));
                        }
                    }
                }
            }
        }
    }
}

fn collect_asset_targets(
    manifest: &serde_json::Value,
    runtime_dir: &Path,
    seen_paths: &mut HashSet<String>,
    targets: &mut Vec<(PathBuf, Option<String>, String)>,
    issues: &mut Vec<String>,
    samples: &mut Vec<String>,
) {
    let Some(asset_index) = manifest.get("assetIndex") else {
        return;
    };
    if asset_index.is_null() {
        return;
    }

    let index_id = asset_index["id"].as_str().unwrap_or("").trim();
    if index_id.is_empty() {
        push_verify_issue(
            issues,
            samples,
            "Missing assetIndex.id in version manifest.".to_string(),
        );
        return;
    }

    let index_path = runtime_dir
        .join("assets")
        .join("indexes")
        .join(format!("{}.json", index_id));

    if !index_path.exists() {
        push_verify_issue(
            issues,
            samples,
            format!("Missing assets index: {}", index_path.display()),
        );
        return;
    }

    let index_key = index_path.to_string_lossy().to_string();
    if seen_paths.insert(index_key) {
        targets.push((
            index_path.clone(),
            asset_index["sha1"].as_str().map(|value| value.to_lowercase()),
            format!("assets-index-{}", index_id),
        ));
    }

    let index_content = match fs::read_to_string(&index_path) {
        Ok(content) => content,
        Err(error) => {
            push_verify_issue(
                issues,
                samples,
                format!(
                    "Failed to read assets index {} ({})",
                    index_path.display(),
                    error
                ),
            );
            return;
        }
    };

    let index_json: serde_json::Value = match serde_json::from_str(&index_content) {
        Ok(value) => value,
        Err(error) => {
            push_verify_issue(
                issues,
                samples,
                format!(
                    "Failed to parse assets index {} ({})",
                    index_path.display(),
                    error
                ),
            );
            return;
        }
    };

    let Some(objects) = index_json["objects"].as_object() else {
        push_verify_issue(
            issues,
            samples,
            format!(
                "Invalid assets index format (missing objects): {}",
                index_path.display()
            ),
        );
        return;
    };

    for (name, object) in objects {
        let hash = object["hash"].as_str().unwrap_or("").trim().to_lowercase();
        if hash.len() < 2 {
            push_verify_issue(issues, samples, format!("Invalid asset hash entry: {}", name));
            continue;
        }

        let asset_path = runtime_dir
            .join("assets")
            .join("objects")
            .join(&hash[0..2])
            .join(&hash);

        let key = asset_path.to_string_lossy().to_string();
        if seen_paths.insert(key) {
            targets.push((asset_path, Some(hash), format!("asset {}", name)));
        }
    }
}

fn build_runtime_repair(instance_id: &str, config: &InstanceConfig) -> MissingRuntime {
    MissingRuntime {
        instance_id: instance_id.to_string(),
        mc_version: config.mc_version.clone(),
        loader_type: config.loader.r#type.clone(),
        loader_version: config.loader.version.clone(),
    }
}

pub async fn verify_instance_runtime<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
) -> Result<VerifyInstanceRuntimeResult, String> {
    emit_verify_progress(
        app,
        instance_id,
        0,
        1,
        "Preparing runtime verification...",
    );

    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let base_path = PathBuf::from(base_path);
    let runtime_dir = base_path.join("runtime");
    let instance_json_path = base_path
        .join("instances")
        .join(instance_id)
        .join("instance.json");

    if !instance_json_path.exists() {
        return Err(format!(
            "Instance config does not exist: {}",
            instance_json_path.display()
        ));
    }

    let config_content = fs::read_to_string(&instance_json_path).map_err(|error| error.to_string())?;
    let config: InstanceConfig =
        serde_json::from_str(&config_content).map_err(|error| error.to_string())?;

    if config.mc_version.trim().is_empty() {
        return Err("Instance config missing mcVersion".to_string());
    }

    let mut all_issues = Vec::new();
    let mut sample_issues = Vec::new();

    let mc_version = config.mc_version.trim().to_string();
    let core_dir = runtime_dir.join("versions").join(&mc_version);
    let core_json_path = core_dir.join(format!("{}.json", mc_version));
    let core_jar_path = core_dir.join(format!("{}.jar", mc_version));

    let mut core_manifest: Option<serde_json::Value> = None;
    if !core_json_path.exists() {
        push_verify_issue(
            &mut all_issues,
            &mut sample_issues,
            format!("Missing core version json: {}", core_json_path.display()),
        );
    } else {
        match fs::read_to_string(&core_json_path)
            .ok()
            .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        {
            Some(json) => core_manifest = Some(json),
            None => {
                push_verify_issue(
                    &mut all_issues,
                    &mut sample_issues,
                    format!(
                        "Failed to parse core version json: {}",
                        core_json_path.display()
                    ),
                );
            }
        }
    }

    let mut loader_manifest: Option<serde_json::Value> = None;
    if let Some(folder) =
        resolve_loader_folder(&config.loader.r#type, &mc_version, &config.loader.version)
    {
        let loader_json_path = runtime_dir
            .join("versions")
            .join(&folder)
            .join(format!("{}.json", folder));

        if !loader_json_path.exists() {
            push_verify_issue(
                &mut all_issues,
                &mut sample_issues,
                format!(
                    "Missing loader version json: {}",
                    loader_json_path.display()
                ),
            );
        } else {
            match fs::read_to_string(&loader_json_path)
                .ok()
                .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
            {
                Some(json) => loader_manifest = Some(json),
                None => {
                    push_verify_issue(
                        &mut all_issues,
                        &mut sample_issues,
                        format!(
                            "Failed to parse loader version json: {}",
                            loader_json_path.display()
                        ),
                    );
                }
            }
        }
    }

    let mut seen_paths = HashSet::new();
    let mut targets: Vec<(PathBuf, Option<String>, String)> = Vec::new();

    let core_target_key = core_jar_path.to_string_lossy().to_string();
    if seen_paths.insert(core_target_key) {
        targets.push((
            core_jar_path.clone(),
            core_manifest
                .as_ref()
                .and_then(|json| json.pointer("/downloads/client/sha1"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase()),
            format!("minecraft-core-{}", mc_version),
        ));
    }

    if let Some(manifest) = core_manifest.as_ref() {
        collect_manifest_library_targets(manifest, &runtime_dir, &mut seen_paths, &mut targets);
        collect_asset_targets(
            manifest,
            &runtime_dir,
            &mut seen_paths,
            &mut targets,
            &mut all_issues,
            &mut sample_issues,
        );
    }

    if let Some(manifest) = loader_manifest.as_ref() {
        collect_manifest_library_targets(manifest, &runtime_dir, &mut seen_paths, &mut targets);
        collect_asset_targets(
            manifest,
            &runtime_dir,
            &mut seen_paths,
            &mut targets,
            &mut all_issues,
            &mut sample_issues,
        );
    }

    let total = targets.len().max(1) as u64;
    for (index, (target_path, expected_sha1, label)) in targets.iter().enumerate() {
        let current = index as u64 + 1;
        emit_verify_progress(app, instance_id, current, total, format!("Verifying {}", label));

        if !target_path.exists() {
            push_verify_issue(
                &mut all_issues,
                &mut sample_issues,
                format!("Missing file: {}", target_path.display()),
            );
            continue;
        }

        if let Some(expected) = expected_sha1 {
            match sha1_file(target_path).await {
                Ok(actual) => {
                    if !actual.eq_ignore_ascii_case(expected) {
                        push_verify_issue(
                            &mut all_issues,
                            &mut sample_issues,
                            format!(
                                "SHA1 mismatch: {} (expected {}, got {})",
                                target_path.display(),
                                expected,
                                actual
                            ),
                        );
                    }
                }
                Err(error) => {
                    push_verify_issue(
                        &mut all_issues,
                        &mut sample_issues,
                        format!("Failed to hash file: {} ({})", target_path.display(), error),
                    );
                }
            }
        }
    }

    if all_issues.len() > sample_issues.len() {
        sample_issues.push(format!(
            "Found {} issues in total (partial list shown).",
            all_issues.len()
        ));
    }

    emit_verify_progress(
        app,
        instance_id,
        total,
        total,
        if all_issues.is_empty() {
            "Runtime verification completed."
        } else {
            "Runtime verification completed with issues."
        },
    );

    Ok(VerifyInstanceRuntimeResult {
        instance_id: instance_id.to_string(),
        needs_repair: !all_issues.is_empty(),
        issues: sample_issues,
        repair: (!all_issues.is_empty()).then(|| build_runtime_repair(instance_id, &config)),
    })
}

pub async fn download_missing_runtimes<R: Runtime>(
    app: &AppHandle<R>,
    missing_list: Vec<MissingRuntime>,
) -> Result<(), String> {
    let base_path = ConfigService::get_base_path(app)
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let runtime_dir = PathBuf::from(base_path).join("runtime");

    for missing in missing_list {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: missing.instance_id.clone(),
                stage: "VANILLA_CORE".to_string(),
                file_name: String::new(),
                current: 0,
                total: 100,
                message: format!("Downloading missing runtime {}", missing.mc_version),
            },
        );

        let no_cancel = Arc::new(AtomicBool::new(false));

        let _ = crate::services::downloader::core_installer::install_vanilla_core(
            app,
            &missing.instance_id,
            &missing.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::dependencies::download_dependencies_force_hash(
            app,
            &missing.instance_id,
            &missing.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::loader_installer::install_loader(
            app,
            &missing.instance_id,
            &missing.mc_version,
            &missing.loader_type,
            &missing.loader_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: missing.instance_id,
                stage: "DONE".to_string(),
                file_name: String::new(),
                current: 100,
                total: 100,
                message: "Runtime download completed".to_string(),
            },
        );
    }

    Ok(())
}
