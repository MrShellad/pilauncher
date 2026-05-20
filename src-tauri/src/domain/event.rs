// src-tauri/src/domain/event.rs
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressEvent {
    pub instance_id: String,
    pub stage: String,     // Stage name, e.g. "VANILLA_CORE", "ASSETS", "LIBRARIES"
    pub file_name: String, // Current file name
    pub current: u64,      // Current progress count
    pub total: u64,        // Total count
    pub message: String,   // User-facing message
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadLogEvent {
    pub task_id: String,
    pub instance_id: String,
    pub stage: String,
    pub level: String,
    pub message: String,
}
