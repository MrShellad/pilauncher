use std::env;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use reqwest::Client;
use serde_json::Value;
use tauri::{AppHandle, Runtime};

use crate::error::AppResult;
use crate::services::config_service::{ConfigService, DownloadSettings};

use super::mirror::route_library_url;
use super::progress::DownloadStage;
use super::scheduler::{run_downloads, sha1_file, DownloadTask};

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

fn evaluate_rules(rules: Option<&Vec<Value>>) -> bool {
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

async fn add_download_task(
    tasks: &mut Vec<DownloadTask>,
    global_mc_root: &Path,
    temp_root: &Path,
    dl_settings: &DownloadSettings,
    name: &str,
    dl_path: &str,
    dl_url: &str,
    expected_size: Option<u64>,
    expected_sha1: Option<&str>,
) {
    if dl_path.is_empty() || dl_url.is_empty() {
        return;
    }

    let target_path: PathBuf = global_mc_root.join("libraries").join(dl_path);
    let temp_path: PathBuf = temp_root.join("libraries").join(dl_path);

    if target_path.exists() {
        let size_matches = expected_size.map_or(true, |s| {
            target_path.metadata().map(|m| m.len()).unwrap_or(0) == s
        });
        let expected_sha1 = expected_sha1.map(|s| s.to_lowercase());

        if let Some(ref exp) = expected_sha1 {
            if size_matches {
                if let Ok(actual) = sha1_file(&target_path).await {
                    if actual == *exp {
                        return;
                    }
                }
            }
        } else if expected_size.is_none() || size_matches {
            return;
        }

        let _ = tokio::fs::remove_file(&target_path).await;
    }

    let mirror_url = route_library_url(dl_url, dl_settings);

    tasks.push(DownloadTask {
        url: mirror_url,
        path: target_path,
        temp_path,
        name: name.to_string(),
        expected_sha1: expected_sha1.map(|s| s.to_lowercase()),
        expected_size,
    });
}

pub async fn download_libraries<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    manifest: &Value,
    global_mc_root: &Path,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let mut tasks: Vec<DownloadTask> = Vec::new();
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
    let temp_root = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_root).await?;

    if let Some(libraries) = manifest["libraries"].as_array() {
        for lib in libraries {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() {
                continue;
            }

            if !evaluate_rules(lib["rules"].as_array()) {
                continue;
            }

            if let Some(artifact) = lib.pointer("/downloads/artifact") {
                add_download_task(
                    &mut tasks,
                    global_mc_root,
                    &temp_root,
                    &dl_settings,
                    name,
                    artifact["path"].as_str().unwrap_or(""),
                    artifact["url"].as_str().unwrap_or(""),
                    artifact["size"].as_u64(),
                    if verify_hash {
                        artifact["sha1"].as_str()
                    } else {
                        None
                    },
                )
                .await;
            } else if lib.get("downloads").is_none() {
                let parts: Vec<&str> = name.split(':').collect();
                if parts.len() >= 3 {
                    let group = parts[0].replace('.', "/");
                    let artifact = parts[1];
                    let version = parts[2];
                    let dl_path = format!(
                        "{}/{}/{}/{}-{}.jar",
                        group, artifact, version, artifact, version
                    );

                    let base_url = lib["url"]
                        .as_str()
                        .unwrap_or("https://libraries.minecraft.net/");
                    let mut base = base_url.to_string();
                    if !base.ends_with('/') {
                        base.push('/');
                    }
                    let dl_url = format!("{}{}", base, dl_path);

                    add_download_task(
                        &mut tasks,
                        global_mc_root,
                        &temp_root,
                        &dl_settings,
                        name,
                        &dl_path,
                        &dl_url,
                        None,
                        None,
                    )
                    .await;
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
                        add_download_task(
                            &mut tasks,
                            global_mc_root,
                            &temp_root,
                            &dl_settings,
                            &format!("{}-{}", name, classifier_key),
                            classifier_obj["path"].as_str().unwrap_or(""),
                            classifier_obj["url"].as_str().unwrap_or(""),
                            classifier_obj["size"].as_u64(),
                            if verify_hash {
                                classifier_obj["sha1"].as_str()
                            } else {
                                None
                            },
                        )
                        .await;
                    } else if lib.get("downloads").is_none() {
                        let parts: Vec<&str> = name.split(':').collect();
                        if parts.len() >= 3 {
                            let group = parts[0].replace('.', "/");
                            let artifact = parts[1];
                            let version = parts[2];
                            let dl_path = format!(
                                "{}/{}/{}/{}-{}-{}.jar",
                                group, artifact, version, artifact, version, classifier_key
                            );

                            let base_url = lib["url"]
                                .as_str()
                                .unwrap_or("https://libraries.minecraft.net/");
                            let mut base = base_url.to_string();
                            if !base.ends_with('/') {
                                base.push('/');
                            }
                            let dl_url = format!("{}{}", base, dl_path);

                            add_download_task(
                                &mut tasks,
                                global_mc_root,
                                &temp_root,
                                &dl_settings,
                                &format!("{}-{}", name, classifier_key),
                                &dl_path,
                                &dl_url,
                                None,
                                None,
                            )
                            .await;
                        }
                    }
                }
            }
        }
    }

    run_downloads(
        app,
        instance_id,
        client,
        tasks,
        DownloadStage::Libraries,
        concurrency,
        limit_per_thread,
        retry_count,
        verify_hash,
        cancel,
    )
    .await
}
