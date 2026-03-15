use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

use futures::stream::{iter, StreamExt};
use reqwest::Client;

use crate::error::AppResult;
use crate::services::deployment_cancel::is_cancelled;

use super::progress::{emit_download_progress, DownloadStage};
use tauri::{AppHandle, Runtime};

/// 并发调度：下载任务描述
pub struct DownloadTask {
    pub url: String,
    pub path: PathBuf,
    pub name: String,
}

/// 通用的并发下载调度器
pub async fn run_downloads<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    client: &Client,
    tasks: Vec<DownloadTask>,
    stage: DownloadStage,
    concurrency: usize,
    limit_per_thread: u64,
    cancel: &Arc<AtomicBool>,
) -> AppResult<()> {
    let total = tasks.len() as u64;
    if total == 0 {
        return Ok(());
    }

    let completed = Arc::new(tokio::sync::Mutex::new(0u64));

    let fetches = iter(tasks)
        .map(|task: DownloadTask| {
            let client = client.clone();
            let completed = Arc::clone(&completed);
            let app = app.clone();
            let instance_id = instance_id.to_string();
            let cancel = Arc::clone(cancel);

            async move {
                if is_cancelled(&cancel) {
                    return;
                }

                if let Some(parent) = task.path.parent() {
                    let _ = tokio::fs::create_dir_all(parent).await;
                }

                match client.get(&task.url).send().await {
                    Ok(mut res) => {
                        if res.status().is_success() {
                            let mut file_data = Vec::new();
                            let mut download_success = false;

                            // ✅ 核心修复：严格捕获传输错误，拒绝半截文件
                            loop {
                                match res.chunk().await {
                                    Ok(Some(chunk)) => {
                                        if is_cancelled(&cancel) {
                                            return;
                                        }
                                        file_data.extend_from_slice(&chunk);
                                        if limit_per_thread > 0 {
                                            tokio::time::sleep(std::time::Duration::from_secs_f64(
                                                chunk.len() as f64 / limit_per_thread as f64,
                                            ))
                                            .await;
                                        }
                                    }
                                    Ok(None) => {
                                        // 真正读取到了文件末尾 (EOF)
                                        download_success = true;
                                        break;
                                    }
                                    Err(e) => {
                                        eprintln!(
                                            "[Scheduler] 网络中断，文件被截断 (拒绝写入): {} -> {}",
                                            task.url, e
                                        );
                                        break; // 跳出循环，且 success 保持为 false
                                    }
                                }
                            }

                            // ✅ 修复：只有完整下载的有效文件才允许落盘
                            if download_success && !is_cancelled(&cancel) {
                                let _ = tokio::fs::write(&task.path, file_data).await;
                            }
                        } else {
                            eprintln!(
                                "[Scheduler] 请求失败，状态码: {} -> {}",
                                res.status(),
                                task.url
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("[Scheduler] 连接建立失败: {} -> {}", task.url, e);
                    }
                }

                let mut c = completed.lock().await;
                *c += 1;

                // 按阶段配置的步长上报进度
                if *c % stage.step() == 0 || *c == total {
                    emit_download_progress(&app, &instance_id, stage, task.name, *c, total);
                }
            }
        })
        .buffer_unordered(concurrency);

    fetches.collect::<Vec<()>>().await;

    Ok(())
}
