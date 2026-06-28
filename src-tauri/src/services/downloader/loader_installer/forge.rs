use super::*;

pub(super) fn installer_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    crate::services::downloader::dependencies::mirror::route_forge_installer_urls(
        mc_version,
        loader_version,
        dl_settings,
    )
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

    // Construct SimpleVersionInfo for lighty-loaders
    let info = SimpleVersionInfo {
        name: version_id.clone(),
        mc_version: mc_version.to_string(),
        loader_version: loader_version.to_string(),
        game_dir: global_mc_root.to_path_buf(),
        java_dir: global_mc_root.join("runtime/java"),
        loader_type: lighty_loaders::types::Loader::Forge,
    };

    let installer_path = lighty_loaders::loaders::forge::forge::installer_cache_path(&info);
    tokio::fs::create_dir_all(installer_path.parent().unwrap()).await?;

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
            message: format!("正在下载 Forge {} 安装包元数据...", loader_version),
        },
    );

    let installer_urls = installer_urls(&dl_settings, mc_version, loader_version);
    if !installer_path.exists() {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }
        let installer_bytes =
            download_bytes_from_candidates(app, instance_id, &client, &installer_urls, max_attempts, cancel).await?;
        tokio::fs::write(&installer_path, installer_bytes).await?;
    }

    let is_legacy = lighty_loaders::loaders::forge::forge_legacy::is_legacy_forge(mc_version);

    if needs_loader_manifest_download(&json_path) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        if is_legacy {
            let profile = lighty_loaders::loaders::forge::forge_legacy::read_install_profile_from_jar(&installer_path).await.map_err(|e| AppError::Generic(e.to_string()))?;
            let merged_version = lighty_loaders::loaders::forge::forge_legacy::legacy_version_builder(&info, &profile).await.map_err(|e| AppError::Generic(e.to_string()))?;
            let profile_json = version_to_json(&merged_version, &version_id, mc_version);
            let profile_json_text = serde_json::to_string_pretty(&profile_json)?;
            tokio::fs::write(&json_path, profile_json_text).await?;
        } else {
            use lighty_loaders::loaders::forge::forge::{ForgeQuery, FORGE};
            let merged = FORGE.get(&info, ForgeQuery::ForgeBuilder).await.map_err(|e| AppError::Generic(e.to_string()))?;
            let merged_version = match &*merged {
                lighty_loaders::types::VersionMetaData::Version(v) => v,
                _ => return Err(AppError::Generic("Failed to resolve Forge version metadata".into())),
            };
            let profile_json = version_to_json(merged_version, &version_id, mc_version);
            let profile_json_text = serde_json::to_string_pretty(&profile_json)?;
            tokio::fs::write(&json_path, profile_json_text).await?;
        }
    }

    let launcher_profiles = global_mc_root.join("launcher_profiles.json");
    if !launcher_profiles.exists() {
        tokio::fs::write(&launcher_profiles, "{\"profiles\": {}}").await?;
    }

    if is_legacy {
        let profile = lighty_loaders::loaders::forge::forge_legacy::read_install_profile_from_jar(&installer_path).await.map_err(|e| AppError::Generic(e.to_string()))?;
        emit_loader_progress(
            app,
            instance_id,
            "installer.jar",
            60,
            100,
            "正在解压 Legacy Forge 核心库...",
        );
        lighty_loaders::loaders::forge::forge_legacy::extract_universal_jar(&info, &profile).await.map_err(|e| AppError::Generic(e.to_string()))?;
    } else {
        emit_loader_progress(
            app,
            instance_id,
            "installer.jar",
            60,
            100,
            "正在执行 Forge 安装器...",
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
    }

    emit_loader_progress(
        app,
        instance_id,
        format!("{}.json", version_id),
        80,
        100,
        "Forge 安装完成，正在补齐并校验依赖...",
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
            message: "Forge 环境部署完成".to_string(),
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
