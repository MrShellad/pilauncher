use super::*;

fn append_installer_urls(
    urls: &mut Vec<String>,
    base: &str,
    mc_version: &str,
    loader_version: &str,
) {
    let Some(base) = normalize_source_base(base) else {
        return;
    };

    let artifact_path = format!(
        "net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar",
        mc_version, loader_version
    );

    if let Some(maven_base) = replace_trailing_segment(&base, "forge", "maven") {
        push_unique_url(urls, format!("{}/{}", maven_base, artifact_path));
    }

    push_unique_url(urls, format!("{}/{}", base, artifact_path));
}

pub(super) fn installer_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    const FORGE_OFFICIAL_BASE: &str = "https://maven.minecraftforge.net";
    const FORGE_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/forge";

    let mut urls = Vec::new();
    for base in source_base_candidates(
        &dl_settings.forge_source,
        &dl_settings.forge_source_url,
        FORGE_OFFICIAL_BASE,
        Some(FORGE_BMCLAPI_BASE),
    ) {
        append_installer_urls(&mut urls, &base, mc_version, loader_version);
    }
    urls
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
    let version_id = format!("{}-forge-{}", mc_version, loader_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    tokio::fs::create_dir_all(&version_dir).await?;
    let json_path = version_dir.join(format!("{}.json", version_id));
    let temp_dir = global_mc_root.join("temp");
    tokio::fs::create_dir_all(&temp_dir).await?;
    let installer_path = temp_dir.join(format!("forge-installer-{}.jar", loader_version));

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
            message: format!("姝ｅ湪涓嬭浇 Forge {} 瀹夎鍖呭厓鏁版嵁...", loader_version),
        },
    );

    let installer_urls = installer_urls(&dl_settings, mc_version, loader_version);
    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let installer_bytes =
            download_bytes_from_candidates(&client, &installer_urls, max_attempts, cancel).await?;
        tokio::fs::write(&installer_path, installer_bytes).await?;
    }
    if needs_loader_manifest_download(&json_path) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        save_loader_manifest_from_installer(
            &client,
            &installer_urls,
            max_attempts,
            cancel,
            &json_path,
            &version_id,
        )
        .await?;
    }

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: format!("{}.json", version_id),
            current: 40,
            total: 100,
            message: "Forge 鐗堟湰娓呭崟宸插氨缁紝姝ｅ湪涓嬭浇渚濊禆...".to_string(),
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
        "姝ｅ湪鎵ц Forge 瀹夎鍣?..",
    );
    run_java_installer(
        app,
        instance_id,
        "Forge",
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
        "Forge 瀹夎瀹屾垚锛屾鍦ㄨˉ榻愬苟鏍￠獙渚濊禆...",
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
            message: "Forge 鐜閮ㄧ讲瀹屾垚".to_string(),
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
        settings.forge_source = "custom".to_string();
        settings.forge_source_url = "https://mirror.example.com/forge".to_string();

        let urls = installer_urls(&settings, "1.20.1", "47.4.18");

        assert_eq!(
            urls,
            vec![
                "https://mirror.example.com/maven/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://mirror.example.com/forge/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/maven/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/forge/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
                "https://maven.minecraftforge.net/net/minecraftforge/forge/1.20.1-47.4.18/forge-1.20.1-47.4.18-installer.jar"
                    .to_string(),
            ]
        );
    }
}
