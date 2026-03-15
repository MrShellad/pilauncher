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
use super::scheduler::{run_downloads, DownloadTask};

/// 获取 Minecraft 格式的系统名称
fn get_mc_os() -> &'static str {
    match env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => env::consts::OS,
    }
}

/// 获取 Minecraft 格式的架构名称 (用于替换 ${arch})
fn get_mc_arch() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "64",
        "x86" => "32",
        "aarch64" => "arm64",
        _ => env::consts::ARCH,
    }
}

/// 评估库的适用规则
fn evaluate_rules(rules: Option<&Vec<Value>>) -> bool {
    let Some(rules) = rules else {
        return true; // 没有 rules 节点，默认适用于所有系统
    };

    let current_os = get_mc_os();
    let mut is_allowed = false; // 如果存在 rules，默认起始状态为不许下载，直到被显式 allow

    for rule in rules {
        let action = rule["action"].as_str().unwrap_or("disallow");
        let os_match = match rule.get("os") {
            Some(os_obj) => os_obj["name"].as_str().unwrap_or("") == current_os,
            None => true, // 规则中没有 os 节点，代表匹配所有系统
        };

        if os_match {
            is_allowed = action == "allow";
        }
    }

    is_allowed
}

/// 辅助函数：校验本地文件并生成下载任务
fn add_download_task(
    tasks: &mut Vec<DownloadTask>,
    global_mc_root: &Path,
    dl_settings: &DownloadSettings,
    name: &str,
    dl_path: &str,
    dl_url: &str,
    expected_size: Option<u64>,
) {
    if dl_path.is_empty() || dl_url.is_empty() {
        return;
    }

    let target_path: PathBuf = global_mc_root.join("libraries").join(dl_path);

    if target_path.exists() {
        if let Some(s) = expected_size {
            if target_path.metadata().map(|m| m.len()).unwrap_or(0) == s {
                return; // 文件大小匹配，无需下载
            }
        } else {
            return; // 存在且无大小校验要求，跳过
        }
    }

    let mirror_url = route_library_url(dl_url, dl_settings);

    tasks.push(DownloadTask {
        url: mirror_url,
        path: target_path,
        name: name.to_string(),
    });
}

/// Loader / 依赖部分：负责根据版本清单解析并下载 libraries (支持 OS 规则和 Natives)
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
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    if let Some(libraries) = manifest["libraries"].as_array() {
        for lib in libraries {
            let name = lib["name"].as_str().unwrap_or("");
            if name.is_empty() {
                continue;
            }

            // 1. 规则过滤：剔除不属于当前操作系统的依赖
            if !evaluate_rules(lib["rules"].as_array()) {
                continue;
            }

            // 2. 提取常规的 Java 依赖 (Artifact)
            if let Some(artifact) = lib.pointer("/downloads/artifact") {
                add_download_task(
                    &mut tasks,
                    global_mc_root,
                    &dl_settings,
                    name,
                    artifact["path"].as_str().unwrap_or(""),
                    artifact["url"].as_str().unwrap_or(""),
                    artifact["size"].as_u64(),
                );
            } else if lib.get("downloads").is_none() {
                // 回退逻辑：处理旧版 Forge/Fabric 没有 downloads 节点的情况
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
                        &dl_settings,
                        name,
                        &dl_path,
                        &dl_url,
                        None,
                    );
                }
            }

            // 3. 提取特定操作系统的原生依赖 (Natives)
            if let Some(natives) = lib["natives"].as_object() {
                let current_os = get_mc_os();
                if let Some(classifier_val) = natives.get(current_os) {
                    let mut classifier_key = classifier_val.as_str().unwrap_or("").to_string();

                    // 替换变量，例如 natives-linux-${arch} -> natives-linux-64
                    if classifier_key.contains("${arch}") {
                        classifier_key = classifier_key.replace("${arch}", get_mc_arch());
                    }

                    // 现代格式：从 classifiers 节点中查找
                    if let Some(classifier_obj) =
                        lib.pointer(&format!("/downloads/classifiers/{}", classifier_key))
                    {
                        add_download_task(
                            &mut tasks,
                            global_mc_root,
                            &dl_settings,
                            &format!("{}-{}", name, classifier_key), // 加后缀以区分
                            classifier_obj["path"].as_str().unwrap_or(""),
                            classifier_obj["url"].as_str().unwrap_or(""),
                            classifier_obj["size"].as_u64(),
                        );
                    } else if lib.get("downloads").is_none() {
                        // 回退逻辑：极早期版本 (如 1.8) 的 natives 处理
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
                                &dl_settings,
                                &format!("{}-{}", name, classifier_key),
                                &dl_path,
                                &dl_url,
                                None,
                            );
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
        cancel,
    )
    .await
}
