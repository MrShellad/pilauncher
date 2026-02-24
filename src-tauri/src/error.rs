// /src-tauri/src/error.rs
use serde::Serialize;
use std::path::PathBuf;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    Serde(serde_json::Error), // 处理 JSON 序列化错误 (修复 E0277)
    Tauri(tauri::Error),      // 处理 Tauri 路径/插件错误 (修复 E0277)
    Network(reqwest::Error),
    PathResolution,
    InstanceNotFound(PathBuf),
    Generic(String),          // 通用字符串错误 (修复 E0599)
}

// 转换 std::io::Error
impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::Io(error)
    }
}

// 转换 serde_json::Error
impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::Serde(error)
    }
}

// 转换 tauri::Error
impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        AppError::Tauri(error)
    }
}
impl From<reqwest::Error> for AppError {
    fn from(error: reqwest::Error) -> Self {
        AppError::Network(error)
    }
}
// 实现 Display 接口，用于格式化错误输出
impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "I/O Error: {}", e),
            AppError::Serde(e) => write!(f, "JSON Error: {}", e),
            AppError::Tauri(e) => write!(f, "Tauri Error: {}", e),
            AppError::PathResolution => write!(f, "Failed to resolve AppData directory"),
            AppError::InstanceNotFound(path) => write!(f, "Instance path not found: {:?}", path),
            AppError::Network(e) => write!(f, "Network Error: {}", e),
            AppError::Generic(s) => write!(f, "{}", s),
        }
    }
}

// 实现 Serialize，确保错误能传回前端
impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(self.to_string().as_ref())
    }
}

pub type AppResult<T> = Result<T, AppError>;