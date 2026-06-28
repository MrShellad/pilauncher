use super::*;

pub(super) fn profile_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    crate::services::downloader::dependencies::mirror::route_quilt_profile_urls(
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
    let client = build_download_client(&dl_settings)?;
    let max_attempts = dl_settings.retry_count.max(1);

    let version_id = format!("quilt-loader-{}-{}", loader_version, mc_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    tokio::fs::create_dir_all(&version_dir).await?;
    let json_path = version_dir.join(format!("{}.json", version_id));

    if needs_loader_manifest_download(&json_path) {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "LOADER_CORE".to_string(),
                file_name: format!("{}.json", version_id),
                current: 10,
                total: 100,
                message: format!("正在下载 Quilt {} 版本清单...", loader_version),
            },
        );

        let meta_urls = profile_urls(&dl_settings, mc_version, loader_version);
        let raw_json_text =
            download_text_from_candidates(app, instance_id, &client, &meta_urls, max_attempts, cancel).await?;

        // Use lighty-loaders to parse and build the version manifest
        let info = SimpleVersionInfo {
            name: version_id.clone(),
            mc_version: mc_version.to_string(),
            loader_version: loader_version.to_string(),
            game_dir: global_mc_root.to_path_buf(),
            java_dir: global_mc_root.join("runtime/java"),
            loader_type: lighty_loaders::types::Loader::Quilt,
        };

        use lighty_loaders::loaders::quilt::quilt::QuiltQuery;
        use lighty_loaders::utils::query::Query;
        let raw_metadata: <QuiltQuery as Query>::Raw = serde_json::from_str(&raw_json_text)?;
        let merged_version = QuiltQuery::version_builder(&info, &raw_metadata).await.map_err(|e| AppError::Generic(e.to_string()))?;

        // Write the merged version to file
        let profile_json = version_to_json(&merged_version, &version_id, mc_version);
        let profile_json_text = serde_json::to_string_pretty(&profile_json)?;
        tokio::fs::write(&json_path, &profile_json_text).await?;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "LOADER_CORE".to_string(),
                file_name: version_id.clone(),
                current: 40,
                total: 100,
                message: "Quilt 版本清单已就绪，正在下载依赖...".to_string(),
            },
        );
    }

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &version_id,
        global_mc_root,
        cancel,
    )
    .await?;

    verify_loader_installation(app, instance_id, &version_id, global_mc_root, cancel).await?;

    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "LOADER_CORE".to_string(),
            file_name: version_id.clone(),
            current: 100,
            total: 100,
            message: "Quilt 环境部署完成".to_string(),
        },
    );

    Ok(())
}
