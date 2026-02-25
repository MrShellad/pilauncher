// src-tauri/src/domain/event.rs
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgressEvent {
    pub instance_id: String,
    pub stage: String,     // 当前阶段，例如 "VANILLA_CORE", "ASSETS", "LIBRARIES"
    pub file_name: String, // 正在下载的文件名
    pub current: u64,      // 当前已下载字节/文件数
    pub total: u64,        // 总字节/文件数
    pub message: String,   // 展示给用户的提示文本
}