// src-tauri/src/commands/modpack_cmd.rs
use crate::domain::event::DownloadProgressEvent;
use crate::domain::modpack::ModpackMetadata;
use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::deployment_cancel;
use crate::services::downloader::dependencies::scheduler::sha1_file;
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use crate::services::modpack_service;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Serialize, Deserialize)]
pub struct MissingRuntime {
    pub instance_id: String,
    pub mc_version: String,
    pub loader_type: String,
    pub loader_version: String,
}

#[derive(Serialize)]
pub struct ImportResult {
    pub added: usize,
    pub missing: Vec<MissingRuntime>,
}

#[derive(Serialize, Deserialize)]
pub struct VerifyInstanceRuntimeResult {
    pub instance_id: String,
    pub needs_repair: bool,
    pub issues: Vec<String>,
    pub repair: Option<MissingRuntime>,
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

fn evaluate_library_rules(rules: Option<&Vec<serde_json::Value>>) -> bool {
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

fn build_modpack_download_client(dl_settings: &DownloadSettings) -> Result<Client, String> {
    let mut builder = Client::builder()
        .user_agent("PiLauncher/1.0 (Modpack)")
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
            builder = builder.proxy(reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?);
        }
    }

    builder.build().map_err(|e| e.to_string())
}

fn normalize_modpack_download_url(url: &str) -> String {
    url.trim().replace(' ', "%20")
}

fn file_name_from_url(url: &str) -> String {
    reqwest::Url::parse(url)
        .ok()
        .and_then(|parsed| {
            parsed
                .path_segments()
                .and_then(|segments| segments.last())
                .map(|name| name.to_string())
        })
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "modpack.zip".to_string())
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

fn resolve_loader_folder(
    loader_type: &str,
    mc_version: &str,
    loader_version: &str,
) -> Option<String> {
    if loader_version.trim().is_empty() || loader_type.eq_ignore_ascii_case("vanilla") {
        return None;
    }

    match loader_type.to_lowercase().as_str() {
        "fabric" => Some(format!("fabric-loader-{}-{}", loader_version, mc_version)),
        "forge" => Some(format!("{}-forge-{}", mc_version, loader_version)),
        "neoforge" => Some(format!("neoforge-{}", loader_version)),
        "quilt" => Some(format!("quilt-loader-{}-{}", loader_version, mc_version)),
        _ => None,
    }
}

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

    for lib in libraries {
        if !evaluate_library_rules(lib["rules"].as_array()) {
            continue;
        }

        let lib_name = lib["name"].as_str().unwrap_or("unknown-library");

        if let Some(artifact) = lib.pointer("/downloads/artifact") {
            if let Some(dl_path) = artifact["path"].as_str() {
                let path = runtime_dir.join("libraries").join(dl_path);
                let key = path.to_string_lossy().to_string();
                if seen_paths.insert(key) {
                    targets.push((
                        path,
                        artifact["sha1"].as_str().map(|s| s.to_lowercase()),
                        lib_name.to_string(),
                    ));
                }
            }
        } else if lib.get("downloads").is_none() {
            if let Some(dl_path) = legacy_library_download_path(lib_name, None) {
                let path = runtime_dir.join("libraries").join(&dl_path);
                let key = path.to_string_lossy().to_string();
                if seen_paths.insert(key) {
                    targets.push((path, None, lib_name.to_string()));
                }
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
                    if let Some(dl_path) = classifier_obj["path"].as_str() {
                        let path = runtime_dir.join("libraries").join(dl_path);
                        let key = path.to_string_lossy().to_string();
                        if seen_paths.insert(key) {
                            targets.push((
                                path,
                                classifier_obj["sha1"].as_str().map(|s| s.to_lowercase()),
                                format!("{} ({})", lib_name, classifier_key),
                            ));
                        }
                    }
                } else if lib.get("downloads").is_none() {
                    if let Some(dl_path) =
                        legacy_library_download_path(lib_name, Some(&classifier_key))
                    {
                        let path = runtime_dir.join("libraries").join(&dl_path);
                        let key = path.to_string_lossy().to_string();
                        if seen_paths.insert(key) {
                            targets.push((
                                path,
                                None,
                                format!("{} ({})", lib_name, classifier_key),
                            ));
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
            asset_index["sha1"].as_str().map(|s| s.to_lowercase()),
            format!("assets-index-{}", index_id),
        ));
    }

    let index_content = match fs::read_to_string(&index_path) {
        Ok(content) => content,
        Err(err) => {
            push_verify_issue(
                issues,
                samples,
                format!(
                    "Failed to read assets index {} ({})",
                    index_path.display(),
                    err
                ),
            );
            return;
        }
    };

    let index_json: serde_json::Value = match serde_json::from_str(&index_content) {
        Ok(value) => value,
        Err(err) => {
            push_verify_issue(
                issues,
                samples,
                format!(
                    "Failed to parse assets index {} ({})",
                    index_path.display(),
                    err
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
            push_verify_issue(
                issues,
                samples,
                format!("Invalid asset hash entry: {}", name),
            );
            continue;
        }

        let prefix = &hash[0..2];
        let asset_path = runtime_dir
            .join("assets")
            .join("objects")
            .join(prefix)
            .join(&hash);

        let key = asset_path.to_string_lossy().to_string();
        if seen_paths.insert(key) {
            targets.push((asset_path, Some(hash), format!("asset {}", name)));
        }
    }
}

/// 辅助函数：深度解析第三方 JSON 内容以获取准确的版本与 Loader
/// 返回: (mc_version, loader_type, loader_version)
fn parse_third_party_json(dir_name: &str, json: &serde_json::Value) -> (String, String, String) {
    let mut mc_version = dir_name.to_string();
    let mut loader_type = "vanilla".to_string();
    let mut loader_version = "".to_string();

    // 1. 如果存在 inheritsFrom（常规的剥离式 JSON），这是最直接的 mc_version 来源。
    if let Some(inherits) = json.get("inheritsFrom").and_then(|v| v.as_str()) {
        mc_version = inherits.to_string();
    }

    // 2. 尝试从 arguments.game 中提取准确的版本信息（Forge/NeoForge 适用）
    if let Some(args) = json
        .get("arguments")
        .and_then(|a| a.get("game"))
        .and_then(|g| g.as_array())
    {
        let mut iter = args.iter();
        while let Some(arg) = iter.next() {
            if let Some(arg_str) = arg.as_str() {
                if arg_str == "--fml.mcVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        mc_version = val.to_string();
                    }
                } else if arg_str == "--fml.forgeVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        loader_type = "forge".to_string();
                        loader_version = val.to_string();
                    }
                } else if arg_str == "--fml.neoForgeVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        loader_type = "neoforge".to_string();
                        loader_version = val.to_string();
                    }
                }
            }
        }
    }

    // 3. 尝试从 libraries 数组中提取（Fabric/Quilt 适用，也兜底其他情况）
    if loader_type == "vanilla" || loader_version.is_empty() || mc_version == dir_name {
        if let Some(libs) = json.get("libraries").and_then(|l| l.as_array()) {
            for lib in libs {
                if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                    // net.fabricmc:fabric-loader:0.18.4
                    if name.starts_with("net.fabricmc:fabric-loader:") {
                        loader_type = "fabric".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("org.quiltmc:quilt-loader:") {
                        loader_type = "quilt".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("net.neoforged:neoforge:") {
                        loader_type = "neoforge".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("net.minecraftforge:forge:") {
                        loader_type = "forge".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            // forge 包格式一般是: {mc_version}-{forge_version}
                            let v_str = ver.to_string();
                            if v_str.contains('-') {
                                loader_version =
                                    v_str.split('-').nth(1).unwrap_or(&v_str).to_string();
                            } else {
                                loader_version = v_str;
                            }
                        }
                    }

                    // 获取 Fabric/Quilt 的 mc_version（通过 intermediary 或 hashed）
                    if mc_version == dir_name || mc_version.is_empty() {
                        if name.starts_with("net.fabricmc:intermediary:")
                            || name.starts_with("org.quiltmc:hashed:")
                        {
                            if let Some(ver) = name.split(':').nth(2) {
                                mc_version = ver.to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. 兜底方案：从文件夹名称启发式推断（如果依然没有任何特征）
    if loader_type == "vanilla" && loader_version.is_empty() {
        let id_lower = dir_name.to_lowercase();
        if id_lower.contains("neoforge") {
            loader_type = "neoforge".to_string();
            let parts: Vec<&str> = dir_name.split("neoforge-").collect();
            if parts.len() >= 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("forge") {
            loader_type = "forge".to_string();
            let parts: Vec<&str> = dir_name.split("-forge-").collect();
            if parts.len() == 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("fabric") {
            loader_type = "fabric".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 && parts[0] == "fabric" && parts[1] == "loader" {
                loader_version = parts[2].to_string();
            } else if parts.len() >= 2 && parts[1].contains("Fabric ") {
                loader_version = parts[1].replace("Fabric ", "");
            }
        } else if id_lower.contains("quilt") {
            loader_type = "quilt".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 {
                loader_version = parts[2].to_string();
            }
        }
    }

    (mc_version, loader_type, loader_version)
}

fn copy_dir_all(src: impl AsRef<Path>, dst: impl AsRef<Path>) -> std::io::Result<()> {
    fs::create_dir_all(&dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(entry.path(), dst.as_ref().join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.as_ref().join(entry.file_name()))?;
        }
    }
    Ok(())
}

fn copy_and_check_instance(
    src_dir: &Path,
    dest_instances_dir: &Path,
    runtime_dir: &Path,
) -> Result<Option<MissingRuntime>, String> {
    let instance_json_path = src_dir.join("instance.json");
    let content = fs::read_to_string(&instance_json_path).map_err(|e| e.to_string())?;

    let config: crate::domain::instance::InstanceConfig =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let dest_dir = dest_instances_dir.join(&config.id);
    if !dest_dir.exists() {
        copy_dir_all(src_dir, &dest_dir).map_err(|e| e.to_string())?;
    }

    let mut is_missing = false;

    let core_json = runtime_dir
        .join("versions")
        .join(&config.mc_version)
        .join(format!("{}.json", config.mc_version));
    if !core_json.exists() {
        is_missing = true;
    }

    if !config.loader.r#type.eq_ignore_ascii_case("vanilla") && !config.loader.version.is_empty() {
        let loader_folder = match config.loader.r#type.to_lowercase().as_str() {
            "fabric" => format!(
                "fabric-loader-{}-{}",
                config.loader.version, config.mc_version
            ),
            "forge" => format!("{}-forge-{}", config.mc_version, config.loader.version),
            "neoforge" => format!("neoforge-{}", config.loader.version),
            "quilt" => format!(
                "quilt-loader-{}-{}",
                config.loader.version, config.mc_version
            ),
            _ => "".to_string(),
        };

        if !loader_folder.is_empty() {
            let loader_json = runtime_dir
                .join("versions")
                .join(&loader_folder)
                .join(format!("{}.json", loader_folder));
            if !loader_json.exists() {
                is_missing = true;
            }
        }
    }

    if is_missing {
        Ok(Some(MissingRuntime {
            instance_id: config.id.clone(),
            mc_version: config.mc_version,
            loader_type: config.loader.r#type,
            loader_version: config.loader.version,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn import_local_instances_folders<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path_str).join("instances");
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");

    fs::create_dir_all(&instances_dir).map_err(|e| e.to_string())?;

    let mut added_count = 0;
    let mut missing_list = Vec::new();

    for path_str in paths {
        let root = PathBuf::from(&path_str);
        if !root.exists() || !root.is_dir() {
            continue;
        }

        if root.join("instance.json").exists() {
            if let Ok(missing) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
                added_count += 1;
                if let Some(m) = missing {
                    missing_list.push(m);
                }
            }
        } else if let Ok(entries) = fs::read_dir(&root) {
            for entry in entries.flatten() {
                let child = entry.path();
                if child.is_dir() && child.join("instance.json").exists() {
                    if let Ok(missing) =
                        copy_and_check_instance(&child, &instances_dir, &runtime_dir)
                    {
                        added_count += 1;
                        if let Some(m) = missing {
                            missing_list.push(m);
                        }
                    }
                }
            }
        }
    }

    Ok(ImportResult {
        added: added_count,
        missing: missing_list,
    })
}

#[tauri::command]
pub async fn import_third_party_instance<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<Option<MissingRuntime>, String> {
    let dir_path = PathBuf::from(&path);
    if !dir_path.exists() || !dir_path.is_dir() {
        return Err("所选路径不是一个有效的文件夹。".to_string());
    }

    let id = dir_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "非法的文件夹名称。".to_string())?;

    let json_path = dir_path.join(format!("{}.json", id));
    if !json_path.exists() {
        return Err(format!(
            "找不到 {}.json。请选择第三方启动器内的 versions/{{版本名}} 目录！",
            id
        ));
    }

    let content = fs::read_to_string(&json_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let (mc_version, loader_type, loader_version) = parse_third_party_json(&id, &json);

    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");
    let instances_dir = PathBuf::from(&base_path_str).join("instances");

    let dest_dir = instances_dir.join(id);
    if !dest_dir.exists() {
        fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    }

    let config = crate::domain::instance::InstanceConfig {
        id: id.to_string(),
        name: id.to_string(),
        mc_version: mc_version.clone(),
        loader: crate::domain::instance::LoaderConfig {
            r#type: loader_type.clone(),
            version: loader_version.clone(),
        },
        java: crate::domain::instance::JavaConfig {
            path: "auto".to_string(),
            version: "8".to_string(), // 自动选择
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
        created_at: chrono::Local::now().to_rfc3339(),
        cover_image: None,
        hero_logo: None,
        gamepad: None,
        custom_buttons: None,
        third_party_path: Some(path.clone()),
        server_binding: None,
    };

    let config_content = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(dest_dir.join("instance.json"), &config_content).map_err(|e| e.to_string())?;
    // Add instance.json to the original directory as well so the launcher core finds it
    let _ = fs::write(dir_path.join("instance.json"), &config_content);

    let mut is_missing = false;
    let core_json = runtime_dir
        .join("versions")
        .join(&mc_version)
        .join(format!("{}.json", mc_version));
    let core_jar = runtime_dir
        .join("versions")
        .join(&mc_version)
        .join(format!("{}.jar", mc_version));
    if !core_json.exists() || !core_jar.exists() {
        is_missing = true;
    }

    if loader_type != "vanilla" && !loader_version.is_empty() {
        let loader_folder = match loader_type.as_str() {
            "fabric" => format!("fabric-loader-{}-{}", loader_version, mc_version),
            "forge" => format!("{}-forge-{}", mc_version, loader_version),
            "neoforge" => format!("neoforge-{}", loader_version),
            "quilt" => format!("quilt-loader-{}-{}", loader_version, mc_version),
            _ => "".to_string(),
        };
        if !loader_folder.is_empty() {
            let loader_json = runtime_dir
                .join("versions")
                .join(&loader_folder)
                .join(format!("{}.json", loader_folder));
            if !loader_json.exists() {
                is_missing = true;
            }
        }
    }

    if is_missing {
        Ok(Some(MissingRuntime {
            instance_id: id.to_string(),
            mc_version,
            loader_type,
            loader_version,
        }))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn verify_instance_runtime<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<VerifyInstanceRuntimeResult, String> {
    emit_verify_progress(
        &app,
        &instance_id,
        0,
        1,
        "Preparing runtime verification...",
    );

    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let base_path = PathBuf::from(&base_path_str);
    let runtime_dir = base_path.join("runtime");
    let instance_json_path = base_path
        .join("instances")
        .join(&instance_id)
        .join("instance.json");

    if !instance_json_path.exists() {
        return Err(format!(
            "Instance config does not exist: {}",
            instance_json_path.display()
        ));
    }

    let config_content = fs::read_to_string(&instance_json_path).map_err(|e| e.to_string())?;
    let config: crate::domain::instance::InstanceConfig =
        serde_json::from_str(&config_content).map_err(|e| e.to_string())?;

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
                .map(|s| s.to_lowercase()),
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
    for (idx, (target_path, expected_sha1, label)) in targets.iter().enumerate() {
        let current = idx as u64 + 1;
        emit_verify_progress(
            &app,
            &instance_id,
            current,
            total,
            format!("Verifying {}", label),
        );

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
                    if actual.to_lowercase() != expected.to_lowercase() {
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
                Err(err) => {
                    push_verify_issue(
                        &mut all_issues,
                        &mut sample_issues,
                        format!("Failed to hash file: {} ({})", target_path.display(), err),
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
        &app,
        &instance_id,
        total,
        total,
        if all_issues.is_empty() {
            "Runtime verification completed."
        } else {
            "Runtime verification completed with issues."
        },
    );

    Ok(VerifyInstanceRuntimeResult {
        instance_id: instance_id.clone(),
        needs_repair: !all_issues.is_empty(),
        issues: sample_issues,
        repair: if all_issues.is_empty() {
            None
        } else {
            Some(MissingRuntime {
                instance_id,
                mc_version: config.mc_version,
                loader_type: config.loader.r#type,
                loader_version: config.loader.version,
            })
        },
    })
}

#[tauri::command]
pub async fn download_missing_runtimes<R: Runtime>(
    app: AppHandle<R>,
    missing_list: Vec<MissingRuntime>,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .unwrap();
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");

    for m in missing_list {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: m.instance_id.clone(),
                stage: "VANILLA_CORE".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: format!("Downloading missing runtime {}", m.mc_version),
            },
        );

        let no_cancel = Arc::new(AtomicBool::new(false));

        let _ = crate::services::downloader::core_installer::install_vanilla_core(
            &app,
            &m.instance_id,
            &m.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::dependencies::download_dependencies_force_hash(
            &app,
            &m.instance_id,
            &m.mc_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = crate::services::downloader::loader_installer::install_loader(
            &app,
            &m.instance_id,
            &m.mc_version,
            &m.loader_type,
            &m.loader_version,
            &runtime_dir,
            &no_cancel,
        )
        .await;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: m.instance_id.clone(),
                stage: "DONE".to_string(),
                file_name: "".to_string(),
                current: 100,
                total: 100,
                message: "Runtime download completed".to_string(),
            },
        );
    }
    Ok(())
}

#[tauri::command]
pub async fn parse_modpack_metadata(path: String) -> Result<ModpackMetadata, String> {
    modpack_service::parse_modpack(&path)
}

#[tauri::command]
pub async fn import_modpack<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
    server_binding: Option<crate::domain::instance::ServerBinding>,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let i_id = instance_name
            .replace(' ', "_")
            .replace('/', "")
            .replace('\\', "");

        let cancel = deployment_cancel::register(&i_id);
        let result = modpack_service::execute_import(
            &app,
            &zip_path,
            &instance_name,
            &cancel,
            server_binding,
        )
        .await;
        deployment_cancel::unregister(&i_id);

        if let Err(e) = result {
            eprintln!("Modpack import failed: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id,
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("Import interrupted: {}", e),
                },
            );
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn download_and_import_modpack<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    instance_name: String,
    server_binding: Option<crate::domain::instance::ServerBinding>,
) -> Result<(), String> {
    tauri::async_runtime::spawn(async move {
        let i_id = instance_name
            .replace(' ', "_")
            .replace('/', "")
            .replace('\\', "");

        let dl_settings = ConfigService::get_download_settings(&app);
        let client = match build_modpack_download_client(&dl_settings) {
            Ok(client) => client,
            Err(err) => {
                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: i_id.clone(),
                        stage: "ERROR".to_string(),
                        file_name: "".to_string(),
                        current: 0,
                        total: 100,
                        message: format!("Modpack download client init failed: {}", err),
                    },
                );
                return;
            }
        };

        let normalized_url = normalize_modpack_download_url(&url);
        let file_name = file_name_from_url(&normalized_url);
        let max_attempts = dl_settings.retry_count.max(1);

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: i_id.clone(),
                stage: "DOWNLOADING_MODPACK".to_string(),
                file_name: "modpack.zip".to_string(),
                current: 0,
                total: 100,
                message: "Downloading modpack archive...".to_string(),
            },
        );

        let temp_dir = std::env::temp_dir();
        let temp_path = temp_dir.join(&file_name);
        let candidate_urls = vec![normalized_url.clone()];
        let speed_limit_bytes_per_sec =
            ConfigService::download_speed_limit_bytes_per_sec(&dl_settings);
        let rate_limiter = if speed_limit_bytes_per_sec > 0 {
            Some(Arc::new(DownloadRateLimiter::new(
                speed_limit_bytes_per_sec,
            )))
        } else {
            None
        };
        let tuning = DownloadTuning {
            chunked_enabled: dl_settings.chunked_download_enabled,
            chunked_threads: dl_settings.chunked_download_threads.max(1),
            chunked_threshold_bytes: ConfigService::chunked_download_min_size_bytes(&dl_settings),
        };
        let no_cancel = Arc::new(AtomicBool::new(false));
        let mut download_result = None;
        let mut last_error: Option<String> = None;

        for attempt in 1..=max_attempts {
            match download_file(
                &client,
                &candidate_urls,
                &temp_path,
                tuning,
                Duration::from_secs(dl_settings.timeout.max(1)),
                &no_cancel,
                rate_limiter.clone(),
                None,
            )
            .await
            {
                Ok(result) => {
                    download_result = Some(result);
                    break;
                }
                Err(err) => {
                    last_error = Some(err.to_string());
                    if attempt < max_attempts {
                        tokio::time::sleep(Duration::from_millis(800 * attempt as u64)).await;
                    }
                }
            }
        }

        let Some(download_result) = download_result else {
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id.clone(),
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!(
                        "Modpack download request failed: {}",
                        last_error.unwrap_or_else(|| "unknown error".to_string())
                    ),
                },
            );
            return;
        };

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: i_id.clone(),
                stage: "DOWNLOADING_MODPACK".to_string(),
                file_name: file_name.clone(),
                current: download_result.total_bytes.max(1),
                total: download_result.total_bytes.max(1),
                message: "Modpack archive downloaded, preparing installation...".to_string(),
            },
        );

        let cancel = deployment_cancel::register(&i_id);
        let result = crate::services::modpack_service::execute_import(
            &app,
            &temp_path.to_string_lossy(),
            &instance_name,
            &cancel,
            server_binding,
        )
        .await;
        deployment_cancel::unregister(&i_id);

        if let Err(e) = result {
            eprintln!("Modpack deployment failed: {}", e);
            let _ = app.emit(
                "instance-deployment-progress",
                DownloadProgressEvent {
                    instance_id: i_id,
                    stage: "ERROR".to_string(),
                    file_name: "".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("Deployment interrupted: {}", e),
                },
            );
        }

        let _ = std::fs::remove_file(temp_path);
    });

    Ok(())
}

/// 扫描一个上级目录，自动识别并批量导入 Minecraft 实例。
/// 支持三种模式：
///   A. 目录本身含 instance.json（PiLauncher 实例）→ 直接导入
///   B. 子目录含 instance.json（PiLauncher 批量实例）→ 批量导入
///   C. 子目录含 {name}.json（第三方启动器 versions 格式）→ 批量第三方导入
#[tauri::command]
pub async fn scan_instances_in_dir<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<ImportResult, String> {
    let root = PathBuf::from(&path);
    if !root.exists() || !root.is_dir() {
        return Err("所选路径不是一个有效的文件夹。".to_string());
    }

    let base_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    let instances_dir = PathBuf::from(&base_path_str).join("instances");
    let runtime_dir = PathBuf::from(&base_path_str).join("runtime");
    fs::create_dir_all(&instances_dir).map_err(|e| e.to_string())?;

    let mut added_count = 0;
    let mut missing_list = Vec::new();

    // Case A: 目录本身是 PiLauncher 实例
    if root.join("instance.json").exists() {
        if let Ok(missing) = copy_and_check_instance(&root, &instances_dir, &runtime_dir) {
            added_count += 1;
            if let Some(m) = missing {
                missing_list.push(m);
            }
        }
        return Ok(ImportResult {
            added: added_count,
            missing: missing_list,
        });
    }

    // Case B & C: 扫描子目录
    let entries = fs::read_dir(&root).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let child = entry.path();
        if !child.is_dir() {
            continue;
        }

        // Case B: 子目录含 instance.json（PiLauncher 实例）
        if child.join("instance.json").exists() {
            if let Ok(missing) = copy_and_check_instance(&child, &instances_dir, &runtime_dir) {
                added_count += 1;
                if let Some(m) = missing {
                    missing_list.push(m);
                }
            }
            continue;
        }

        // Case C: 子目录含 {name}.json（第三方启动器 versions 格式）
        let dir_name = child
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("")
            .to_string();
        if dir_name.is_empty() {
            continue;
        }
        let version_json = child.join(format!("{}.json", dir_name));
        if !version_json.exists() {
            continue;
        }

        // 已经存在则跳过（避免重复）
        let dest_dir = instances_dir.join(&dir_name);
        if dest_dir.exists() {
            continue;
        }

        // 解析第三方版本信息
        let content = match fs::read_to_string(&version_json) {
            Ok(c) => c,
            Err(_) => continue,
        };
        let json: serde_json::Value = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => continue,
        };

        let (mc_version, loader_type, loader_version) = parse_third_party_json(&dir_name, &json);

        fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;

        let config = crate::domain::instance::InstanceConfig {
            id: dir_name.clone(),
            name: dir_name.clone(),
            mc_version: mc_version.clone(),
            loader: crate::domain::instance::LoaderConfig {
                r#type: loader_type.clone(),
                version: loader_version.clone(),
            },
            java: crate::domain::instance::JavaConfig {
                path: "auto".to_string(),
                version: "auto".to_string(),
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
            created_at: chrono::Local::now().to_rfc3339(),
            cover_image: None,
            hero_logo: None,
            gamepad: None,
            custom_buttons: None,
            third_party_path: Some(child.to_string_lossy().to_string()),
            server_binding: None,
        };

        let config_content = match serde_json::to_string_pretty(&config) {
            Ok(c) => c,
            Err(_) => continue,
        };
        if fs::write(dest_dir.join("instance.json"), &config_content).is_err() {
            continue;
        }
        // Add instance.json to the original directory as well so the launcher core finds it
        let _ = fs::write(child.join("instance.json"), &config_content);

        // 检查运行环境
        let mut is_missing = false;
        let core_json = runtime_dir
            .join("versions")
            .join(&mc_version)
            .join(format!("{}.json", mc_version));
        let core_jar = runtime_dir
            .join("versions")
            .join(&mc_version)
            .join(format!("{}.jar", mc_version));
        if !core_json.exists() || !core_jar.exists() {
            is_missing = true;
        }
        if loader_type != "vanilla" && !loader_version.is_empty() {
            let loader_folder = match loader_type.as_str() {
                "fabric" => format!("fabric-loader-{}-{}", loader_version, mc_version),
                "forge" => format!("{}-forge-{}", mc_version, loader_version),
                "neoforge" => format!("neoforge-{}", loader_version),
                "quilt" => format!("quilt-loader-{}-{}", loader_version, mc_version),
                _ => "".to_string(),
            };
            if !loader_folder.is_empty() {
                let loader_json = runtime_dir
                    .join("versions")
                    .join(&loader_folder)
                    .join(format!("{}.json", loader_folder));
                if !loader_json.exists() {
                    is_missing = true;
                }
            }
        }

        added_count += 1;
        if is_missing {
            missing_list.push(MissingRuntime {
                instance_id: dir_name.clone(),
                mc_version,
                loader_type,
                loader_version,
            });
        }
    }

    Ok(ImportResult {
        added: added_count,
        missing: missing_list,
    })
}

use crate::services::modpack_service::export::ExportConfig;

#[tauri::command]
pub async fn export_modpack<R: Runtime>(
    app: AppHandle<R>,
    config: ExportConfig,
) -> Result<(), String> {
    modpack_service::export::execute_export(&app, config).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_parse_third_party_json_forge() {
        let json_data = json!({
            "arguments": {
                "game": [
                    "--fml.mcVersion", "1.20.1",
                    "--fml.forgeVersion", "47.4.18"
                ]
            }
        });
        let (mc, loader, version) = parse_third_party_json("1.20.1-Forge_47.4.18", &json_data);
        assert_eq!(mc, "1.20.1");
        assert_eq!(loader, "forge");
        assert_eq!(version, "47.4.18");
    }

    #[test]
    fn test_parse_third_party_json_neoforge() {
        let json_data = json!({
            "arguments": {
                "game": [
                    "--fml.mcVersion", "1.21.1",
                    "--fml.neoForgeVersion", "21.1.113"
                ]
            }
        });
        let (mc, loader, version) =
            parse_third_party_json("Cobblemon Modpack [NeoForge]", &json_data);
        assert_eq!(mc, "1.21.1");
        assert_eq!(loader, "neoforge");
        assert_eq!(version, "21.1.113");
    }

    #[test]
    fn test_parse_third_party_json_fabric() {
        let json_data = json!({
            "libraries": [
                { "name": "net.fabricmc:fabric-loader:0.18.4" },
                { "name": "net.fabricmc:intermediary:1.20.1" }
            ]
        });
        let (mc, loader, version) = parse_third_party_json("1.20.1-Fabric 0.18.4", &json_data);
        assert_eq!(mc, "1.20.1");
        assert_eq!(loader, "fabric");
        assert_eq!(version, "0.18.4");
    }

    #[test]
    fn test_parse_third_party_json_fallback() {
        let json_data = json!({});
        let (mc, loader, version) = parse_third_party_json("1.19.2-forge-43.2.0", &json_data);
        assert_eq!(mc, "1.19.2-forge-43.2.0");
        assert_eq!(loader, "forge");
        assert_eq!(version, "43.2.0");
    }
}
