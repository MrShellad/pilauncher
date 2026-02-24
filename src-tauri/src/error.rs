// src/error.rs
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    PathResolution,
    InstanceNotFound(PathBuf),
}

// 【核心修复】：告诉 Rust 如何把 std::io::Error 转换成 AppError
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io(error) // 包装成我们的枚举变体
    }
}

// 实现 Display，用于打印错误信息
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "I/O Error: {}", e),
            AppError::PathResolution => write!(f, "Failed to resolve AppData directory"),
            AppError::InstanceNotFound(path) => write!(f, "Instance path not found: {:?}", path),
        }
    }
}

// 实现 Serialize，以便 Tauri 能将其转换为前端的 Promise reject
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;