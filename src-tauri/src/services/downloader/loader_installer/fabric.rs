use super::*;

pub(super) fn profile_urls(
    dl_settings: &DownloadSettings,
    mc_version: &str,
    loader_version: &str,
) -> Vec<String> {
    const FABRIC_OFFICIAL_BASE: &str = "https://meta.fabricmc.net";
    const FABRIC_BMCLAPI_BASE: &str = "https://bmclapi2.bangbang93.com/fabric-meta";

    source_base_candidates(
        &dl_settings.fabric_source,
        &dl_settings.fabric_source_url,
        FABRIC_OFFICIAL_BASE,
        Some(FABRIC_BMCLAPI_BASE),
    )
    .into_iter()
    .map(|base| {
        format!(
            "{}/v2/versions/loader/{}/{}/profile/json",
            base, mc_version, loader_version
        )
    })
    .collect()
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

    let version_id = format!("fabric-loader-{}-{}", loader_version, mc_version);
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
                message: format!("正在下载 Fabric {} 版本清单...", loader_version),
            },
        );

        let meta_urls = profile_urls(&dl_settings, mc_version, loader_version);
        let profile_json_text =
            download_text_from_candidates(&client, &meta_urls, max_attempts, cancel).await?;
        tokio::fs::write(&json_path, &profile_json_text).await?;

        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "LOADER_CORE".to_string(),
                file_name: version_id.clone(),
                current: 40,
                total: 100,
                message: "Fabric 版本清单已就绪，正在下载依赖...".to_string(),
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
            message: "Fabric 环境部署完成".to_string(),
        },
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_urls_prioritize_selected_source_then_fallbacks() {
        let mut settings = DownloadSettings::default();
        settings.fabric_source = "custom".to_string();
        settings.fabric_source_url = "https://mirror.example.com/fabric-meta/".to_string();

        let urls = profile_urls(&settings, "1.20.1", "0.16.10");

        assert_eq!(
            urls,
            vec![
                "https://mirror.example.com/fabric-meta/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
                "https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
                "https://meta.fabricmc.net/v2/versions/loader/1.20.1/0.16.10/profile/json"
                    .to_string(),
            ]
        );
    }
}
