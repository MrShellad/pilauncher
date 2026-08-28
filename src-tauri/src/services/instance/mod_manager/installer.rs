use crate::domain::gamepad::GamepadModMeta;
use crate::domain::mod_cleanup::{
    ModFileNameCleanupFailure, ModFileNameCleanupItem, ModFileNameCleanupResult,
};
use crate::services::config_service::ConfigService;
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use std::fs::{self, File};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};

pub struct ModInstaller;

impl ModInstaller {
    pub async fn install_remote_mod<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        download_url: &str,
        file_name: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<(), String> {
        let instance_dir = super::ModManagerService::get_instance_dir(app, instance_id)?;
        let mods_dir = instance_dir.join("mods");
        fs::create_dir_all(&mods_dir).ok();

        let target_path = mods_dir.join(file_name);
        let shared_mods_dir = super::icon_storage::IconStorage::get_shared_mods_dir(app)?;
        let shared_target = shared_mods_dir.join(file_name);
        let mut needs_download = true;

        if shared_target.exists() {
            if let Ok(file) = File::open(&shared_target) {
                if zip::ZipArchive::new(file).is_ok() {
                    needs_download = false;
                }
            }
        }

        if needs_download {
            println!("正在下载推荐 Mod: {}", download_url);
            let path_key = shared_target.to_string_lossy().to_string();
            let path_lock = crate::services::file_write_lock::lock_for_path(&path_key);
            let _write_guard = path_lock.lock().await;

            let dl_settings = ConfigService::get_download_settings(app);
            let mut builder = reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(dl_settings.timeout.max(1)));
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
                    builder =
                        builder.proxy(reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?);
                }
            }
            let client = builder.build().map_err(|e| e.to_string())?;

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
                chunked_threshold_bytes: ConfigService::chunked_download_min_size_bytes(
                    &dl_settings,
                ),
            };
            let temp_shared_target = shared_target.with_extension("download");
            let candidate_urls = vec![download_url.to_string()];
            let no_cancel = Arc::new(std::sync::atomic::AtomicBool::new(false));

            let _ = app.emit(
                "resource-download-progress",
                crate::services::resource_service::ResourceProgressPayload {
                    task_id: file_name.to_string(),
                    file_name: file_name.to_string(),
                    stage: "DOWNLOADING_MOD".to_string(),
                    current: 0,
                    total: 100,
                    message: format!("正在下载: {}", file_name),
                },
            );

            let download_result = download_file(
                &client,
                &candidate_urls,
                &temp_shared_target,
                tuning,
                std::time::Duration::from_secs(dl_settings.timeout.max(1)),
                &no_cancel,
                rate_limiter,
                None,
                Some(app),
                Some(instance_id),
                Some("DOWNLOADING_MOD"),
            )
            .await
            .map_err(|e| e.to_string())?;

            let _ = tokio::fs::rename(&temp_shared_target, &shared_target)
                .await
                .map_err(|e| format!("移动缓存文件失败: {}", e))?;

            let _ = app.emit(
                "resource-download-progress",
                crate::services::resource_service::ResourceProgressPayload {
                    task_id: file_name.to_string(),
                    file_name: file_name.to_string(),
                    stage: "DONE".to_string(),
                    current: download_result.total_bytes.max(1),
                    total: download_result.total_bytes.max(1),
                    message: format!("成功: {}", file_name),
                },
            );
        } else {
            println!("从缓存中发现有效的 Mod: {}", file_name);
        }

        fs::copy(&shared_target, &target_path)
            .map_err(|e| format!("复制文件到实例 mods 目录失败: {}", e))?;

        // 更新 gamepad_meta.json 缓存记录
        let cache_key = format!("{}_{}", mc_version, loader_type.to_lowercase());
        let mut meta = super::gamepad::GamepadManager::read_gamepad_meta(app)?;
        meta.insert(
            cache_key,
            GamepadModMeta {
                file_name: file_name.to_string(),
                download_url: download_url.to_string(),
                cached_at: std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs(),
            },
        );
        super::gamepad::GamepadManager::write_gamepad_meta(app, &meta)?;

        if !target_path.is_file() {
            return Err(format!("目标模组文件不存在或复制未成功: {}", target_path.display()));
        }

        let meta = fs::metadata(&target_path).map_err(|e| e.to_string())?;
        let size = meta.len() as i64;
        let mtime = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_secs() as i64)
            .unwrap_or(0);

        let db = app.state::<crate::services::db_service::AppDatabase>();
        let row = crate::services::db_service::InstanceModDbRow {
            instance_id: instance_id.to_string(),
            file_name: file_name.to_string(),
            is_enabled: true,
            file_size: size,
            modified_at: mtime,
            sha1: None,
            curseforge_fingerprint: None,
            mod_id: None,
            version: None,
            source_platform: Some("launcher_download".to_string()),
            source_project_id: None,
            source_file_id: None,
        };
        let _ = crate::services::db_service::DbService::upsert_instance_mods(&db.pool, instance_id, &[row]).await;

        use tauri::Emitter;
        let _ = app.emit(
            "instance-mods-fs-changed",
            serde_json::json!({
                "instanceId": instance_id,
                "action": "install",
                "fileName": file_name
            }),
        );

        Ok(())
    }

    pub async fn execute_mod_file_cleanup<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        items: Vec<ModFileNameCleanupItem>,
    ) -> Result<ModFileNameCleanupResult, String> {
        let mods_dir = super::ModManagerService::get_mods_dir(app, instance_id)?;

        let mut renamed = Vec::new();
        let mut failed = Vec::new();

        for item in items {
            let old_path = mods_dir.join(&item.original_file_name);
            let new_path = mods_dir.join(&item.suggested_file_name);

            if !old_path.exists() {
                failed.push(ModFileNameCleanupFailure {
                    original_file_name: item.original_file_name,
                    suggested_file_name: item.suggested_file_name,
                    error: "源文件不存在".to_string(),
                });
                continue;
            }

            if new_path.exists() {
                failed.push(ModFileNameCleanupFailure {
                    original_file_name: item.original_file_name,
                    suggested_file_name: item.suggested_file_name,
                    error: "目标文件已存在".to_string(),
                });
                continue;
            }

            match tokio::fs::rename(&old_path, &new_path).await {
                Ok(_) => {
                    renamed.push(item.clone());
                }
                Err(e) => {
                    failed.push(ModFileNameCleanupFailure {
                        original_file_name: item.original_file_name,
                        suggested_file_name: item.suggested_file_name,
                        error: e.to_string(),
                    });
                }
            }
        }

        if !renamed.is_empty() {
            let db = app.state::<crate::services::db_service::AppDatabase>();
            for item in &renamed {
                let _ = crate::services::db_service::DbService::toggle_instance_mod(
                    &db.pool,
                    instance_id,
                    &item.original_file_name,
                    &item.suggested_file_name,
                    !item.suggested_file_name.ends_with(".disabled"),
                ).await;
            }

            use tauri::Emitter;
            let _ = app.emit(
                "instance-mods-fs-changed",
                serde_json::json!({
                    "instanceId": instance_id,
                    "action": "rename",
                    "fileNames": renamed.iter().map(|r| r.suggested_file_name.clone()).collect::<Vec<_>>()
                }),
            );
        }

        Ok(ModFileNameCleanupResult {
            total: renamed.len() + failed.len(),
            renamed,
            failed,
            manifest_sync_error: None,
        })
    }
}
