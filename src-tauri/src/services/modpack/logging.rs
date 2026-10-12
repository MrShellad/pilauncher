use chrono::Local;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Instant;
use tokio::io::AsyncWriteExt;

use crate::services::downloader::logging::sanitize_filename;

#[derive(Clone)]
pub struct ModpackImportLogger {
    path: Arc<PathBuf>,
    started_at: Arc<Instant>,
    write_lock: Arc<tokio::sync::Mutex<()>>,
}

impl ModpackImportLogger {
    pub fn new(base_dir: &Path, instance_id: &str) -> Self {
        let timestamp = Local::now().format("%Y%m%d-%H%M%S");
        let file_name = format!(
            "modpack-import-{}-{}.log",
            sanitize_filename(instance_id),
            timestamp
        );

        Self {
            path: Arc::new(base_dir.join("logs").join(file_name)),
            started_at: Arc::new(Instant::now()),
            write_lock: Arc::new(tokio::sync::Mutex::new(())),
        }
    }

    pub fn path(&self) -> &Path {
        self.path.as_path()
    }

    pub async fn info(&self, stage: &str, message: impl AsRef<str>) {
        self.write("INFO", stage, message.as_ref()).await;
    }

    pub async fn warn(&self, stage: &str, message: impl AsRef<str>) {
        self.write("WARN", stage, message.as_ref()).await;
    }

    pub async fn error(&self, stage: &str, message: impl AsRef<str>) {
        self.write("ERROR", stage, message.as_ref()).await;
    }

    async fn write(&self, level: &str, stage: &str, message: &str) {
        let _guard = self.write_lock.lock().await;

        if let Some(parent) = self.path.parent() {
            let _ = tokio::fs::create_dir_all(parent).await;
        }

        let Ok(mut file) = tokio::fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(self.path.as_path())
            .await
        else {
            return;
        };

        let elapsed_ms = self.started_at.elapsed().as_millis();
        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let line = format!(
            "[{}][+{}ms][{}][{}] {}\n",
            timestamp, elapsed_ms, level, stage, message
        );
        let _ = file.write_all(line.as_bytes()).await;
    }
}
