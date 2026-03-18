use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::stream::{iter, StreamExt};
use reqwest::Client;
use sha1::{Digest, Sha1};
use tauri::{AppHandle, Runtime};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use crate::error::{AppError, AppResult};
use crate::services::deployment_cancel::is_cancelled;
use crate::services::downloader::logging::{log_download_event, DownloadLogLevel};

use super::progress::{emit_download_progress, DownloadStage};

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
    limit_per_thread: u64,
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

    let completed = Arc::new(tokio::sync::Mutex::new(0u64));
    let last_emit = Arc::new(tokio::sync::Mutex::new(
        Instant::now() - Duration::from_millis(PROGRESS_EMIT_INTERVAL_MS),
    ));
    let failure_reason = Arc::new(tokio::sync::Mutex::new(None::<String>));

    let fetches = iter(tasks)
        .map(|task: DownloadTask| {
            let client = client.clone();
            let completed = Arc::clone(&completed);
            let last_emit = Arc::clone(&last_emit);
            let failure_reason = Arc::clone(&failure_reason);
            let app = app.clone();
            let instance_id = instance_id.to_string();
            let cancel = Arc::clone(cancel);
            let stage_name = stage_name;

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

                while attempt < max_attempts {
                    attempt += 1;

                    if is_cancelled(&cancel) {
                        let _ = tokio::fs::remove_file(&tmp_path).await;
                        return;
                    }

                    let _ = tokio::fs::remove_file(&tmp_path).await;

                    let response = match client.get(&task.url).send().await {
                        Ok(res) => res,
                        Err(e) => {
                            last_error = Some(format!("connect failed: {}", e));
                            if attempt < max_attempts {
                                let ui_msg = format!(
                                    "Download failed, retrying ({}/{}) for {}",
                                    attempt, max_attempts, task.name
                                );
                                let raw_msg = format!(
                                    "connect failed (attempt {}/{}): url={} err={}",
                                    attempt, max_attempts, task.url, e
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
                    };

                    if !response.status().is_success() {
                        last_error = Some(format!("status {}", response.status()));
                        if attempt < max_attempts {
                            let ui_msg = format!(
                                "Server error, retrying ({}/{}) for {}",
                                attempt, max_attempts, task.name
                            );
                            let raw_msg = format!(
                                "http status {} (attempt {}/{}): url={}",
                                response.status(),
                                attempt,
                                max_attempts,
                                task.url
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

                    if let Some(parent) = tmp_path.parent() {
                        let _ = tokio::fs::create_dir_all(parent).await;
                    }

                    let mut file = match tokio::fs::File::create(&tmp_path).await {
                        Ok(f) => f,
                        Err(e) => {
                            last_error = Some(format!("create temp file failed: {}", e));
                            break;
                        }
                    };

                    let mut hasher = if verify_hash && task.expected_sha1.is_some() {
                        Some(Sha1::new())
                    } else {
                        None
                    };
                    let mut downloaded_size: u64 = 0;
                    let mut stream_ok = true;

                    let mut res = response;
                    loop {
                        let next_chunk = tokio::time::timeout(stall_timeout, res.chunk()).await;
                        match next_chunk {
                            Ok(Ok(Some(chunk))) => {
                                if is_cancelled(&cancel) {
                                    let _ = tokio::fs::remove_file(&tmp_path).await;
                                    return;
                                }

                                if let Err(e) = file.write_all(&chunk).await {
                                    last_error = Some(format!("write failed: {}", e));
                                    stream_ok = false;
                                    break;
                                }

                                if let Some(ref mut h) = hasher {
                                    h.update(&chunk);
                                }

                                downloaded_size += chunk.len() as u64;

                                if limit_per_thread > 0 {
                                    tokio::time::sleep(Duration::from_secs_f64(
                                        chunk.len() as f64 / limit_per_thread as f64,
                                    ))
                                    .await;
                                }
                            }
                            Ok(Ok(None)) => break,
                            Ok(Err(e)) => {
                                last_error = Some(format!("stream failed: {}", e));
                                stream_ok = false;
                                break;
                            }
                            Err(_) => {
                                last_error = Some(format!(
                                    "stream stalled for {}s",
                                    stall_timeout.as_secs()
                                ));
                                stream_ok = false;
                                break;
                            }
                        }
                    }

                    if let Err(e) = file.flush().await {
                        last_error = Some(format!("flush failed: {}", e));
                        stream_ok = false;
                    }
                    drop(file);

                    if !stream_ok {
                        let _ = tokio::fs::remove_file(&tmp_path).await;
                        if attempt < max_attempts {
                            let reason = last_error
                                .clone()
                                .unwrap_or_else(|| "stream failed".to_string());
                            let ui_msg = format!(
                                "Download interrupted, retrying ({}/{}) for {}",
                                attempt, max_attempts, task.name
                            );
                            let raw_msg = format!(
                                "stream failed (attempt {}/{}): url={} err={}",
                                attempt, max_attempts, task.url, reason
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
                                    "size mismatch (attempt {}/{}): url={} expected={} got={}",
                                    attempt, max_attempts, task.url, expected, downloaded_size
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

                    if verify_hash {
                        if let Some(expected) = task.expected_sha1.as_ref() {
                            let digest = hasher
                                .map(|h| h.finalize())
                                .unwrap_or_else(|| Sha1::new().finalize());
                            let actual = digest
                                .iter()
                                .map(|b| format!("{:02x}", b))
                                .collect::<String>();

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
                                        "sha1 mismatch (attempt {}/{}): url={} expected={} got={}",
                                        attempt, max_attempts, task.url, expected, actual
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
                            tokio::time::sleep(Duration::from_millis(RETRY_DELAY_MS)).await;
                            continue;
                        }
                        break;
                    }

                    success = true;
                    break;
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
                        "download failed after {} attempts: url={} err={}",
                        max_attempts, task.url, reason
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

                let mut c = completed.lock().await;
                *c += 1;

                let now = Instant::now();
                let mut last = last_emit.lock().await;
                let reached_step = *c % stage.step() == 0 || *c == total;
                let time_ok =
                    now.duration_since(*last).as_millis() >= PROGRESS_EMIT_INTERVAL_MS as u128;
                if *c == total || (reached_step && time_ok) {
                    emit_download_progress(&app, &instance_id, stage, task.name, *c, total);
                    *last = now;
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
