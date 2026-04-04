use super::*;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NeoForgeBmclVersion {
    version: String,
    #[serde(default)]
    raw_version: Option<String>,
    #[serde(default)]
    installer_path: Option<String>,
}

fn append_installer_urls(urls: &mut Vec<String>, base: &str, loader_version: &str) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar",
        loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "neoforge", "maven") {
        push_unique_url(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique_url(urls, format!("{}/{}", base, artifact_path));
}

pub(super) fn installer_urls(dl_settings: &DownloadSettings, loader_version: &str) -> Vec<String> {
    const NEOFORGE_OFFICIAL_BASE: &str = "https://maven.neoforged.net/releases";
    const NEOFORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/neoforge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.neoforge_source,
        &dl_settings.neoforge_source_url,
        NEOFORGE_OFFICIAL_BASE,
        Some(NEOFORGE_BMCLAPI_BASE),
    ) {
        append_installer_urls(&mut urls, &base, loader_version);
    }
    urls
}

fn append_list_url(urls: &mut Vec<String>, base: &str, mc_version: &str) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let list_base = if base.ends_with("/neoforge") {
        Some(base)
    } else if base.ends_with("/maven") {
        replace_trailing_segment(&base, "maven", "neoforge")
    } else if base.contains("bangbang93.com") {
        Some(format!("{}/neoforge", base))
    } else {
        None
    };

    if let Some(list_base) = list_base {
        push_unique_url(urls, format!("{}/list/{}", list_base, mc_version));
    }
}

fn list_urls(dl_settings: &DownloadSettings, mc_version: &str) -> Vec<String> {
    const NEOFORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/neoforge";

    let mut urls = Vec::new();

    if let Some(base) = normalize_source_base(&dl_settings.neoforge_source_url) {
        append_list_url(&mut urls, &base, mc_version);
    }

    append_list_url(&mut urls, NEOFORGE_BMCLAPI_BASE, mc_version);
    urls
}

fn normalize_version_token(value: &str, mc_version: &str) -> String {
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

pub(super) fn entry_matches(
    entry: &serde_json::Value,
    mc_version: &str,
    requested_version: &str,
) -> bool {
    let Ok(entry) = serde_json::from_value::<NeoForgeBmclVersion>(entry.clone()) else {
        return false;
    };

    let requested = normalize_version_token(requested_version, mc_version);
    if requested.is_empty() {
        return false;
    }

    let mut candidates = vec![entry.version.as_str()];
    if let Some(raw_version) = entry.raw_version.as_deref() {
        candidates.push(raw_version);
    }

    candidates.into_iter().any(|candidate| {
        let candidate_norm = normalize_version_token(candidate, mc_version);
        !candidate_norm.is_empty() && candidate_norm == requested
    })
}

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

pub(super) fn append_bmcl_installer_urls(
    urls: &mut Vec<String>,
    api_base: &str,
    entry: &serde_json::Value,
) {
    let Some(api_base) = normalize_source_base(api_base) else {
        return;
    };
    let Ok(entry) = serde_json::from_value::<NeoForgeBmclVersion>(entry.clone()) else {
        return;
    };

    push_unique_url(
        urls,
        format!(
            "{}/version/{}/download/installer.jar",
            api_base, entry.version
        ),
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

pub(super) async fn resolve_installer_urls(
    client: &reqwest::Client,
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
    max_attempts: u32,
    cancel: &Arc<AtomicBool>,
) -> AppResult<Vec<String>> {
    let mut urls = Vec::new();
    let fallback_urls = installer_urls(dl_settings, loader_version);
    let list_urls = list_urls(dl_settings, mc_version);

    if !list_urls.is_empty() {
        let list_text =
            match download_text_from_candidates(client, &list_urls, max_attempts, cancel).await {
                Ok(text) => text,
                Err(AppError::Cancelled) => return Err(AppError::Cancelled),
                Err(_) => String::new(),
            };

        if !list_text.is_empty() {
            if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&list_text) {
                if let Some(entry) = entries
                    .iter()
                    .find(|entry| entry_matches(entry, mc_version, loader_version))
                {
                    for list_url in &list_urls {
                        if let Some(api_base) = list_url.rsplit_once("/list/").map(|(base, _)| base)
                        {
                            append_bmcl_installer_urls(&mut urls, api_base, entry);
                        }
                    }
                }
            }
        }
    }

    for fallback_url in fallback_urls {
        push_unique_url(&mut urls, fallback_url);
    }

    Ok(urls)
}

pub(super) async fn install<R: Runtime>(
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

    let installer_urls = resolve_installer_urls(
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
        "正在解析 NeoForge installer 依赖清单...",
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

    #[test]
    fn installer_urls_use_configured_base_and_maven_fallback_shape() {
        let mut settings = DownloadSettings::default();
        settings.neoforge_source = "custom".to_string();
        settings.neoforge_source_url = "https://mirror.example.com/neoforge".to_string();

        let urls = installer_urls(&settings, "21.1.133");

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
    fn entry_matching_accepts_old_and_new_version_formats() {
        let modern_entry = serde_json::json!({
            "version": "21.1.222",
            "rawVersion": "neoforge-21.1.222"
        });
        assert!(entry_matches(&modern_entry, "1.21.1", "21.1.222"));
        assert!(entry_matches(&modern_entry, "1.21.1", "neoforge-21.1.222"));

        let legacy_entry = serde_json::json!({
            "version": "47.1.12",
            "rawVersion": "1.20.1-47.1.12"
        });
        assert!(entry_matches(&legacy_entry, "1.20.1", "47.1.12"));
        assert!(entry_matches(&legacy_entry, "1.20.1", "1.20.1-47.1.12"));
        assert!(entry_matches(
            &legacy_entry,
            "1.20.1",
            "1.20.1-forge-47.1.12"
        ));
    }

    #[test]
    fn bmcl_installer_urls_include_redirect_and_installer_path() {
        let entry = serde_json::json!({
            "version": "21.1.222",
            "rawVersion": "neoforge-21.1.222",
            "installerPath": "/maven/net/neoforged/neoforge/21.1.222/neoforge-21.1.222-installer.jar"
        });

        let mut urls = Vec::new();
        append_bmcl_installer_urls(
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
}
