use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri::{command, AppHandle, Runtime};
use uuid::Uuid;
static SESSION_CACHE_TOKEN: Lazy<String> = Lazy::new(|| Uuid::new_v4().to_string());

#[derive(Serialize, Deserialize)]
struct SessionCacheFile {
    session_token: String,
    data: Value,
}

fn get_cache_file_path<R: Runtime>(
    app: &AppHandle<R>,
    namespace: &str,
    folder: &str,
) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取缓存目录: {}", e))?;

    let safe_name = namespace
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>();

    Ok(app_data_dir
        .join("cache")
        .join(folder)
        .join(format!("{}.json", safe_name)))
}

#[command]
pub async fn read_session_cache<R: Runtime>(
    app: AppHandle<R>,
    namespace: String,
) -> Result<Option<Value>, String> {
    let path = get_cache_file_path(&app, &namespace, "session")?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取缓存失败: {}", e))?;
    let cache: SessionCacheFile =
        serde_json::from_str(&content).map_err(|e| format!("解析缓存失败: {}", e))?;

    if cache.session_token != *SESSION_CACHE_TOKEN {
        return Ok(None);
    }

    Ok(Some(cache.data))
}

#[command]
pub async fn write_session_cache<R: Runtime>(
    app: AppHandle<R>,
    namespace: String,
    data: Value,
) -> Result<(), String> {
    let path = get_cache_file_path(&app, &namespace, "session")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建缓存目录失败: {}", e))?;
    }

    let cache = SessionCacheFile {
        session_token: SESSION_CACHE_TOKEN.clone(),
        data,
    };

    let content =
        serde_json::to_string_pretty(&cache).map_err(|e| format!("序列化缓存失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("写入缓存失败: {}", e))?;
    Ok(())
}

#[command]
pub async fn read_persistent_cache<R: Runtime>(
    app: AppHandle<R>,
    namespace: String,
) -> Result<Option<Value>, String> {
    let path = get_cache_file_path(&app, &namespace, "persistent")?;
    if !path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&path).map_err(|e| format!("读取缓存失败: {}", e))?;
    let data = serde_json::from_str(&content).map_err(|e| format!("解析缓存失败: {}", e))?;
    Ok(Some(data))
}

#[command]
pub async fn write_persistent_cache<R: Runtime>(
    app: AppHandle<R>,
    namespace: String,
    data: Value,
) -> Result<(), String> {
    let path = get_cache_file_path(&app, &namespace, "persistent")?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建缓存目录失败: {}", e))?;
    }

    let content =
        serde_json::to_string_pretty(&data).map_err(|e| format!("序列化缓存失败: {}", e))?;
    fs::write(&path, content).map_err(|e| format!("写入缓存失败: {}", e))?;
    Ok(())
}
