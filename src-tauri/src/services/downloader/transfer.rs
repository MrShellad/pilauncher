use crate::error::{AppError, AppResult};
use crate::services::deployment_cancel::is_cancelled;
use futures::stream::{iter, StreamExt};
use reqwest::header::{ACCEPT_ENCODING, CONTENT_RANGE, RANGE};
use reqwest::Client;
use std::convert::TryFrom;
use std::io::SeekFrom;
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::io::{AsyncSeekExt, AsyncWriteExt};
use tokio::sync::Mutex;

const CHUNKED_MIN_SEGMENTS: usize = 2;
const RANGE_PROBE_HEADER: &str = "bytes=0-0";

#[derive(Clone, Copy, Debug)]
pub struct DownloadTuning {
    pub chunked_enabled: bool,
    pub chunked_threads: usize,
    pub chunked_threshold_bytes: u64,
}

impl DownloadTuning {
    pub fn should_use_chunked(self, total_size: u64) -> bool {
        self.chunked_enabled
            && self.chunked_threads >= CHUNKED_MIN_SEGMENTS
            && total_size >= self.chunked_threshold_bytes
    }
}

pub struct DownloadOutcome {
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub used_chunked: bool,
}

struct DownloadRateLimiterState {
    available_bytes: f64,
    last_refill: Instant,
}

pub struct DownloadRateLimiter {
    bytes_per_second: f64,
    state: Mutex<DownloadRateLimiterState>,
}

impl DownloadRateLimiter {
    pub fn new(bytes_per_second: u64) -> Self {
        let bytes_per_second = bytes_per_second.max(1) as f64;
        Self {
            bytes_per_second,
            state: Mutex::new(DownloadRateLimiterState {
                available_bytes: bytes_per_second,
                last_refill: Instant::now(),
            }),
        }
    }

    pub async fn acquire(&self, bytes: usize) {
        if bytes == 0 {
            return;
        }

        let needed_bytes = bytes as f64;

        loop {
            let wait_for = {
                let mut state = self.state.lock().await;
                let now = Instant::now();
                let elapsed = now.duration_since(state.last_refill).as_secs_f64();

                if elapsed > 0.0 {
                    state.available_bytes = (state.available_bytes
                        + elapsed * self.bytes_per_second)
                        .min(self.bytes_per_second);
                    state.last_refill = now;
                }

                if state.available_bytes >= needed_bytes {
                    state.available_bytes -= needed_bytes;
                    None
                } else {
                    let missing = needed_bytes - state.available_bytes;
                    state.available_bytes = 0.0;
                    state.last_refill = now;
                    Some(Duration::from_secs_f64(
                        (missing / self.bytes_per_second).max(0.001),
                    ))
                }
            };

            if let Some(wait_for) = wait_for {
                tokio::time::sleep(wait_for).await;
            } else {
                break;
            }
        }
    }
}

fn parse_total_size_from_content_range(headers: &reqwest::header::HeaderMap) -> Option<u64> {
    let value = headers.get(CONTENT_RANGE)?.to_str().ok()?;
    let (_, total_part) = value.rsplit_once('/')?;
    if total_part == "*" {
        return None;
    }
    total_part.parse().ok()
}

async fn write_chunk_at_offset(
    file: &Arc<Mutex<tokio::fs::File>>,
    offset: u64,
    chunk: &[u8],
) -> AppResult<()> {
    let mut file = file.lock().await;
    file.seek(SeekFrom::Start(offset)).await?;
    file.write_all(chunk).await?;
    Ok(())
}

async fn download_single_stream(
    client: &Client,
    url: &str,
    temp_path: &Path,
    stall_timeout: Duration,
    cancel: &Arc<AtomicBool>,
    rate_limiter: Option<Arc<DownloadRateLimiter>>,
    on_bytes: Option<&Arc<dyn Fn(u64) + Send + Sync>>,
) -> AppResult<DownloadOutcome> {
    if let Some(parent) = temp_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let _ = tokio::fs::remove_file(temp_path).await;

    let mut response = client
        .get(url)
        .header(ACCEPT_ENCODING, "identity")
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(AppError::Generic(format!(
            "HTTP {} from {}",
            response.status(),
            url
        )));
    }

    let total_size = response.content_length().unwrap_or(0);
    let mut file = tokio::fs::File::create(temp_path).await?;
    let mut downloaded: u64 = 0;

    loop {
        if is_cancelled(cancel) {
            let _ = tokio::fs::remove_file(temp_path).await;
            return Err(AppError::Cancelled);
        }

        let next_chunk = tokio::time::timeout(stall_timeout, response.chunk()).await;
        match next_chunk {
            Ok(Ok(Some(chunk))) => {
                file.write_all(&chunk).await?;
                downloaded += chunk.len() as u64;

                if let Some(rate_limiter) = rate_limiter.as_ref() {
                    rate_limiter.acquire(chunk.len()).await;
                }
                if let Some(on_bytes) = on_bytes {
                    on_bytes(chunk.len() as u64);
                }
            }
            Ok(Ok(None)) => break,
            Ok(Err(e)) => {
                let _ = tokio::fs::remove_file(temp_path).await;
                return Err(AppError::Network(e));
            }
            Err(_) => {
                let _ = tokio::fs::remove_file(temp_path).await;
                return Err(AppError::Generic(format!(
                    "download stalled for {}s",
                    stall_timeout.as_secs()
                )));
            }
        }
    }

    file.flush().await?;
    if downloaded == 0 {
        let _ = tokio::fs::remove_file(temp_path).await;
        return Err(AppError::Generic(format!("empty response from {}", url)));
    }

    Ok(DownloadOutcome {
        downloaded_bytes: downloaded,
        total_bytes: total_size.max(downloaded),
        used_chunked: false,
    })
}

async fn download_chunked_stream(
    client: &Client,
    url: &str,
    temp_path: &Path,
    tuning: DownloadTuning,
    stall_timeout: Duration,
    cancel: &Arc<AtomicBool>,
    rate_limiter: Option<Arc<DownloadRateLimiter>>,
    on_bytes: Option<&Arc<dyn Fn(u64) + Send + Sync>>,
) -> AppResult<DownloadOutcome> {
    if !tuning.chunked_enabled || tuning.chunked_threads < CHUNKED_MIN_SEGMENTS {
        return Err(AppError::Generic("chunked download is disabled".to_string()));
    }

    let probe = client
        .get(url)
        .header(ACCEPT_ENCODING, "identity")
        .header(RANGE, RANGE_PROBE_HEADER)
        .send()
        .await?;

    if probe.status().as_u16() != 206 {
        return Err(AppError::Generic(format!(
            "range requests are not supported by {}",
            url
        )));
    }

    let total_size = parse_total_size_from_content_range(probe.headers()).ok_or_else(|| {
        AppError::Generic(format!("missing content-range header for {}", url))
    })?;

    if !tuning.should_use_chunked(total_size) {
        return Err(AppError::Generic(format!(
            "file too small for chunked download: {} bytes",
            total_size
        )));
    }

    let segment_count = tuning
        .chunked_threads
        .max(CHUNKED_MIN_SEGMENTS)
        .min(usize::try_from(total_size).unwrap_or(usize::MAX).max(1));
    if segment_count < CHUNKED_MIN_SEGMENTS {
        return Err(AppError::Generic("chunked download needs at least 2 segments".to_string()));
    }

    if let Some(parent) = temp_path.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }
    let _ = tokio::fs::remove_file(temp_path).await;

    let file = tokio::fs::File::create(temp_path).await?;
    file.set_len(total_size).await?;
    let shared_file = Arc::new(Mutex::new(file));

    let segment_size = (total_size + segment_count as u64 - 1) / segment_count as u64;
    let mut ranges = Vec::with_capacity(segment_count);
    let mut start = 0u64;
    while start < total_size {
        let end = (start + segment_size - 1).min(total_size - 1);
        ranges.push((start, end));
        start = end.saturating_add(1);
    }

    let worker_stream = iter(ranges.into_iter()).map(|(start, end)| {
        let client = client.clone();
        let url = url.to_string();
        let shared_file = Arc::clone(&shared_file);
        let rate_limiter = rate_limiter.clone();
        let cancel = Arc::clone(cancel);
        let on_bytes = on_bytes.cloned();

        async move {
            let mut response = client
                .get(&url)
                .header(ACCEPT_ENCODING, "identity")
                .header(RANGE, format!("bytes={}-{}", start, end))
                .send()
                .await?;

            if response.status().as_u16() != 206 {
                return Err(AppError::Generic(format!(
                    "range request failed for {}: {}",
                    url,
                    response.status()
                )));
            }

            let mut offset = start;
            let mut written: u64 = 0;

            loop {
                if is_cancelled(&cancel) {
                    return Err(AppError::Cancelled);
                }

                let next_chunk = tokio::time::timeout(stall_timeout, response.chunk()).await;
                match next_chunk {
                    Ok(Ok(Some(chunk))) => {
                        write_chunk_at_offset(&shared_file, offset, &chunk).await?;
                        let chunk_len = chunk.len() as u64;
                        offset = offset.saturating_add(chunk_len);
                        written = written.saturating_add(chunk_len);

                        if let Some(rate_limiter) = rate_limiter.as_ref() {
                            rate_limiter.acquire(chunk.len()).await;
                        }
                        if let Some(on_bytes) = on_bytes.as_ref() {
                            on_bytes(chunk_len);
                        }
                    }
                    Ok(Ok(None)) => break,
                    Ok(Err(e)) => return Err(AppError::Network(e)),
                    Err(_) => {
                        return Err(AppError::Generic(format!(
                            "segment stalled for {}s",
                            stall_timeout.as_secs()
                        )))
                    }
                }
            }

            if offset <= end {
                return Err(AppError::Generic(format!(
                    "segment incomplete: {}-{} for {}",
                    start, end, url
                )));
            }

            Ok(written)
        }
    });

    let mut total_written = 0u64;
    let mut workers = worker_stream.buffer_unordered(segment_count);
    while let Some(result) = workers.next().await {
        total_written = total_written.saturating_add(result?);
    }

    if total_written != total_size {
        let _ = tokio::fs::remove_file(temp_path).await;
        return Err(AppError::Generic(format!(
            "chunked download incomplete: expected {} bytes, got {} bytes",
            total_size, total_written
        )));
    }

    Ok(DownloadOutcome {
        downloaded_bytes: total_written,
        total_bytes: total_size,
        used_chunked: true,
    })
}

pub async fn download_file(
    client: &Client,
    candidate_urls: &[String],
    temp_path: &Path,
    tuning: DownloadTuning,
    stall_timeout: Duration,
    cancel: &Arc<AtomicBool>,
    rate_limiter: Option<Arc<DownloadRateLimiter>>,
    on_bytes: Option<Arc<dyn Fn(u64) + Send + Sync>>,
) -> AppResult<DownloadOutcome> {
    if candidate_urls.is_empty() {
        return Err(AppError::Generic(
            "download_file requires at least one candidate url".to_string(),
        ));
    }

    let on_bytes_ref = on_bytes.as_ref();
    let mut last_error: Option<String> = None;

    for url in candidate_urls {
        if is_cancelled(cancel) {
            return Err(AppError::Cancelled);
        }

        if tuning.chunked_enabled {
            match download_chunked_stream(
                client,
                url,
                temp_path,
                tuning,
                stall_timeout,
                cancel,
                rate_limiter.clone(),
                on_bytes_ref,
            )
            .await
            {
                Ok(outcome) => return Ok(outcome),
                Err(err) => {
                    let _ = err;
                    let _ = tokio::fs::remove_file(temp_path).await;
                }
            }
        }

        match download_single_stream(
            client,
            url,
            temp_path,
            stall_timeout,
            cancel,
            rate_limiter.clone(),
            on_bytes_ref,
        )
        .await
        {
            Ok(outcome) => return Ok(outcome),
            Err(err) => {
                last_error = Some(err.to_string());
                let _ = tokio::fs::remove_file(temp_path).await;
            }
        }
    }

    Err(AppError::Generic(format!(
        "download failed for all candidate urls: {}",
        last_error.unwrap_or_else(|| "unknown error".to_string())
    )))
}
