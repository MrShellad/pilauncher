use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::io::AsyncWriteExt;

use crate::services::config_service::ConfigService;

#[derive(Debug, Clone, Copy)]
pub enum DownloadLogLevel {
    Info,
    Warn,
    Error,
}

impl DownloadLogLevel {
    fn as_str(self) -> &'static str {
        match self {
            DownloadLogLevel::Info => "INFO",
            DownloadLogLevel::Warn => "WARN",
            DownloadLogLevel::Error => "ERROR",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadLogEvent {
    pub task_id: String,
    pub instance_id: String,
    pub stage: String,
    pub level: String,
    pub message: String,
}

static LOG_PATHS: OnceLock<Mutex<HashMap<String, PathBuf>>> = OnceLock::new();

fn sanitize_filename(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        if matches!(ch, '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|') {
            out.push('_');
        } else {
            out.push(ch);
        }
    }
    if out.is_empty() {
        "_".to_string()
    } else {
        out
    }
}

fn resolve_logs_dir<R: Runtime>(app: &AppHandle<R>) -> Option<PathBuf> {
    if let Ok(Some(base)) = ConfigService::get_base_path(app) {
        return Some(PathBuf::from(base).join("logs"));
    }
    app.path().app_data_dir().ok().map(|dir| dir.join("logs"))
}

fn resolve_log_path<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Option<PathBuf> {
    let logs_dir = resolve_logs_dir(app)?;
    let cache = LOG_PATHS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut cache = cache.lock().unwrap();
    if let Some(path) = cache.get(instance_id) {
        return Some(path.clone());
    }

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let file_name = format!("download-{}-{}.log", sanitize_filename(instance_id), ts);
    let path = logs_dir.join(file_name);
    cache.insert(instance_id.to_string(), path.clone());
    Some(path)
}

pub async fn log_download_event<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    stage: &str,
    level: DownloadLogLevel,
    message: &str,
    raw: Option<&str>,
    emit_ui: bool,
) {
    if emit_ui {
        let _ = app.emit(
            "download-task-log",
            DownloadLogEvent {
                task_id: instance_id.to_string(),
                instance_id: instance_id.to_string(),
                stage: stage.to_string(),
                level: level.as_str().to_string(),
                message: message.to_string(),
            },
        );
    }

    if let Some(path) = resolve_log_path(app, instance_id) {
        if let Some(parent) = path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }
        if let Ok(mut file) = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .await
        {
            let ts = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let raw_msg = raw.unwrap_or(message);
            let line = format!("[{}][{}][{}] {}\n", ts, stage, level.as_str(), raw_msg);
            let _ = file.write_all(line.as_bytes()).await;
        }
    }
}
