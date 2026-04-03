use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::stream::{iter, StreamExt};
use reqwest::Client;
use sha1::{Digest, Sha1};
use tauri::{AppHandle, Runtime};
use tokio::io::AsyncReadExt;

use crate::error::{AppError, AppResult};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::logging::{log_download_event, DownloadLogLevel};
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};

use super::progress::{emit_download_progress, emit_download_speed, DownloadStage};

const RETRY_DELAY_MS: u64 = 1200;
const PROGRESS_EMIT_INTERVAL_MS: u64 = 100;
const HASH_READ_BUFFER_SIZE: usize = 64 * 1024;

fn stage_label(stage: DownloadStage) -> &'static str {
    match stage {
        DownloadStage::Libraries => "Libraries",
        DownloadStage::Assets => "Assets",
        DownloadStage::Mods => "Mods",
    }
}

pub struct DownloadTask {
    pub url: String,
    pub fallback_urls: Vec<String>,
    pub path: PathBuf,
    pub temp_path: PathBuf,
    pub name: String,
    pub expected_sha1: Option<String>,
    pub expected_size: Option<u64>,
}

pub async fn sha1_file(path: &Path) -> AppResult<String> {
    let mut file = tokio::fs::File::open(path).await?;
    let mut hasher = Sha1::new();
    let mut buffer = vec![0u8; HASH_READ_BUFFER_SIZE];

    loop {
        let read = file.read(&mut buffer).await?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }

    let digest = hasher.finalize();
    Ok(digest
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect::<String>())
}

pub async fn run_downloads<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    tasks: Vec<DownloadTask>,
    stage: DownloadStage,
    concurrency: usize,
    speed_limit_bytes_per_sec: u64,
    retry_count: u32,
    verify_hash: bool,
    stall_timeout: Duration,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let total = tasks.len() as u64;
    if total == 0 {
        return Ok(());
    }

    let stage_name = stage.stage_name();
    let stage_label = stage_label(stage);
    log_download_event(
        app,
        instance_id,
        stage_name,
        DownloadLogLevel::Info,
        &format!("Starting download of {} ({} files)", stage_label, total),
        None,
        true,
    )
    .await;

    let dl_settings = crate::services::config_service::ConfigService::get_download_settings(app);
    let chunked_tuning = DownloadTuning {
        chunked_enabled: dl_settings.chunked_download_enabled,
        chunked_threads: dl_settings.chunked_download_threads.max(1),
        chunked_threshold_bytes:
            crate::services::config_service::ConfigService::chunked_download_min_size_bytes(
                &dl_settings,
            ),
    };

    let completed = Arc::new(tokio::sync::Mutex::new(0u64));
    let last_emit = Arc::new(tokio::sync::Mutex::new(
        Instant::now() - Duration::from_millis(PROGRESS_EMIT_INTERVAL_MS),
    ));
    let downloaded_bytes = Arc::new(AtomicU64::new(0));
    let last_speed_emit = Arc::new(std::sync::Mutex::new(
        Instant::now() - Duration::from_millis(PROGRESS_EMIT_INTERVAL_MS),
    ));
    let expected_total_bytes = tasks.iter().fold(0u64, |acc, task| {
        acc.saturating_add(task.expected_size.unwrap_or(0))
    });
    let failure_reason = Arc::new(tokio::sync::Mutex::new(None::<String>));
    let rate_limiter = if speed_limit_bytes_per_sec > 0 {
        Some(Arc::new(DownloadRateLimiter::new(speed_limit_bytes_per_sec)))
    } else {
        None
    };

    let fetches = iter(tasks)
        .map(|task: DownloadTask| {
            let client = client.clone();
            let completed = Arc::clone(&completed);
            let last_emit = Arc::clone(&last_emit);
            let downloaded_bytes = Arc::clone(&downloaded_bytes);
            let last_speed_emit = Arc::clone(&last_speed_emit);
            let failure_reason = Arc::clone(&failure_reason);
            let rate_limiter = rate_limiter.clone();
            let app = app.clone();
            let instance_id = instance_id.to_string();
            let cancel = Arc::clone(cancel);
            let stage_name = stage_name;
            let tuning = chunked_tuning;
            let speed_total = expected_total_bytes;

            async move {
                if is_cancelled(&cancel) {
                    return;
                }

                if let Some(parent) = task.path.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }

                let tmp_path = task.temp_path.clone();
                let mut attempt = 0u32;
                let mut success = false;
                let mut last_error: Option<String> = None;
                let max_attempts = retry_count.max(1);

                let candidate_urls = {
                    let mut urls = Vec::with_capacity(1 + task.fallback_urls.len());
                    urls.push(task.url.clone());
                    urls.extend(task.fallback_urls.clone());
                    urls
                };

                while attempt < max_attempts {
                    attempt += 1;

                    if is_cancelled(&cancel) {
                        let _ = tokio::fs::remove_file(&tmp_path).await;
                        return;
                    }

                    let _ = tokio::fs::remove_file(&tmp_path).await;

                    let on_bytes: Arc<dyn Fn(u64) + Send + Sync> = {
                        let downloaded_bytes = Arc::clone(&downloaded_bytes);
                        let last_speed_emit = Arc::clone(&last_speed_emit);
                        let app = app.clone();
                        let instance_id = instance_id.clone();
                        let task_name = task.name.clone();

                        Arc::new(move |bytes| {
                            let current_stage_bytes =
                                downloaded_bytes.fetch_add(bytes, Ordering::Relaxed) + bytes;
                            let should_emit_speed = {
                                let now = Instant::now();
                                let mut last = last_speed_emit.lock().unwrap();
                                if now.duration_since(*last).as_millis()
                                    >= PROGRESS_EMIT_INTERVAL_MS as u128
                                {
                                    *last = now;
                                    true
                                } else {
                                    false
                                }
                            };

                            if should_emit_speed {
                                emit_download_speed(
                                    &app,
                                    &instance_id,
                                    stage,
                                    task_name.clone(),
                                    current_stage_bytes,
                                    speed_total.max(current_stage_bytes).max(1),
                                );
                            }
                        })
                    };

                    match download_file(
                        &client,
                        &candidate_urls,
                        &tmp_path,
                        tuning,
                        stall_timeout,
                        &cancel,
                        rate_limiter.clone(),
                        Some(on_bytes),
                    )
                    .await
                    {
                        Ok(outcome) => {
                            let downloaded_size = outcome.downloaded_bytes;

                            if let Some(expected) = task.expected_size {
                                if downloaded_size != expected {
                                    last_error = Some(format!(
                                        "size mismatch (expected {}, got {})",
                                        expected, downloaded_size
                                    ));
                                    let _ = tokio::fs::remove_file(&tmp_path).await;
                                    if attempt < max_attempts {
                                        let ui_msg = format!(
                                            "Size check failed, retrying ({}/{}) for {}",
                                            attempt, max_attempts, task.name
                                        );
                                        let raw_msg = format!(
                                            "size mismatch (attempt {}/{}): primary={} fallbacks={:?} expected={} got={}",
                                            attempt,
                                            max_attempts,
                                            task.url,
                                            task.fallback_urls,
                                            expected,
                                            downloaded_size
                                        );
                                        log_download_event(
                                            &app,
                                            &instance_id,
                                            stage_name,
                                            DownloadLogLevel::Warn,
                                            &ui_msg,
                                            Some(&raw_msg),
                                            true,
                                        )
                                        .await;
                                        tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS))
                                            .await;
                                        continue;
                                    }
                                    break;
                                }
                            }

                            if verify_hash {
                                if let Some(expected) = task.expected_sha1.as_ref() {
                                    let actual = sha1_file(&tmp_path).await.unwrap_or_default();
                                    if actual != *expected {
                                        last_error = Some(format!(
                                            "sha1 mismatch (expected {}, got {})",
                                            expected, actual
                                        ));
                                        let _ = tokio::fs::remove_file(&tmp_path).await;
                                        if attempt < max_attempts {
                                            let ui_msg = format!(
                                                "SHA-1 check failed, retrying ({}/{}) for {}",
                                                attempt, max_attempts, task.name
                                            );
                                            let raw_msg = format!(
                                                "sha1 mismatch (attempt {}/{}): primary={} fallbacks={:?} expected={} got={}",
                                                attempt,
                                                max_attempts,
                                                task.url,
                                                task.fallback_urls,
                                                expected,
                                                actual
                                            );
                                            log_download_event(
                                                &app,
                                                &instance_id,
                                                stage_name,
                                                DownloadLogLevel::Warn,
                                                &ui_msg,
                                                Some(&raw_msg),
                                                true,
                                            )
                                            .await;
                                            tokio::time::sleep(Duration::from_millis(
                                                RETRY_DELAY_MS,
                                            ))
                                            .await;
                                            continue;
                                        }
                                        break;
                                    }
                                }
                            }

                            if task.path.exists() {
                                let _ = tokio::fs::remove_file(&task.path).await;
                            }

                            if let Err(e) = tokio::fs::rename(&tmp_path, &task.path).await {
                                last_error = Some(format!("rename failed: {}", e));
                                let _ = tokio::fs::remove_file(&tmp_path).await;
                                if attempt < max_attempts {
                                    let ui_msg = format!(
                                        "Write failed, retrying ({}/{}) for {}",
                                        attempt, max_attempts, task.name
                                    );
                                    let raw_msg = format!(
                                        "rename failed (attempt {}/{}): tmp={} target={} err={}",
                                        attempt,
                                        max_attempts,
                                        tmp_path.display(),
                                        task.path.display(),
                                        e
                                    );
                                    log_download_event(
                                        &app,
                                        &instance_id,
                                        stage_name,
                                        DownloadLogLevel::Warn,
                                        &ui_msg,
                                        Some(&raw_msg),
                                        true,
                                    )
                                    .await;
                                    tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS))
                                        .await;
                                    continue;
                                }
                                break;
                            }

                            success = true;
                            break;
                        }
                        Err(err) => {
                            last_error = Some(err.to_string());
                            let _ = tokio::fs::remove_file(&tmp_path).await;
                            if attempt < max_attempts {
                                let reason = last_error
                                    .clone()
                                    .unwrap_or_else(|| "download failed".to_string());
                                let ui_msg = format!(
                                    "Download interrupted, retrying ({}/{}) for {}",
                                    attempt, max_attempts, task.name
                                );
                                let raw_msg = format!(
                                    "download failed (attempt {}/{}): primary={} fallbacks={:?} err={}",
                                    attempt, max_attempts, task.url, task.fallback_urls, reason
                                );
                                log_download_event(
                                    &app,
                                    &instance_id,
                                    stage_name,
                                    DownloadLogLevel::Warn,
                                    &ui_msg,
                                    Some(&raw_msg),
                                    true,
                                )
                                .await;
                                tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                                continue;
                            }
                            break;
                        }
                    }
                }

                if !success {
                    let reason = last_error
                        .clone()
                        .unwrap_or_else(|| "unknown error".to_string());

                    let ui_msg = format!(
                        "Download failed after {} attempts for {}",
                        max_attempts, task.name
                    );
                    let raw_msg = format!(
                        "download failed after {} attempts: primary={} fallbacks={:?} err={}",
                        max_attempts, task.url, task.fallback_urls, reason
                    );
                    log_download_event(
                        &app,
                        &instance_id,
                        stage_name,
                        DownloadLogLevel::Error,
                        &ui_msg,
                        Some(&raw_msg),
                        true,
                    )
                    .await;

                    let mut failed = failure_reason.lock().await;
                    if failed.is_none() {
                        *failed = Some(format!("{} ({})", task.name, reason));
                    }
                }

                let time_ok;
                let c_val: u64;
                {
                    let mut c = completed.lock().await;
                    *c += 1;
                    c_val = *c;

                    let now = Instant::now();
                    let mut last = last_emit.lock().await;
                    time_ok =
                        now.duration_since(*last).as_millis() >= PROGRESS_EMIT_INTERVAL_MS as u128;

                    if c_val == total || time_ok {
                        *last = now;
                    }
                } // 锁在这里释放

                if c_val == total || time_ok {
                    emit_download_progress(&app, &instance_id, stage, task.name, c_val, total);
                }
            }
        })
        .buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;

    if is_cancelled(cancel) {
        return Err(AppError::Cancelled);
    }

    if let Some(reason) = failure_reason.lock().await.clone() {
        let summary = format!("{} downloads finished with errors", stage_label);
        log_download_event(
            app,
            instance_id,
            stage_name,
            DownloadLogLevel::Error,
            &summary,
            Some(&reason),
            true,
        )
        .await;

        return Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            format!("{} download failed: {}", stage_label, reason),
        )
        .into());
    }

    log_download_event(
        app,
        instance_id,
        stage_name,
        DownloadLogLevel::Info,
        &format!("Completed {} downloads", stage_label),
        None,
        true,
    )
    .await;

    Ok(())
}
