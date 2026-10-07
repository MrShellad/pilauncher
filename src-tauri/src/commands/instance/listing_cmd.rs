// src-tauri/src/commands/instance/listing_cmd.rs
use crate::domain::instance::InstanceItem;
use crate::error::AppResult;
use crate::services::db_service::AppDatabase;
use crate::services::instance::listing::InstanceListingService;
use tauri::{AppHandle, Runtime, State};

use serde::Serialize;
use std::fs::File;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::process::Command as SysCommand;
use std::time::UNIX_EPOCH;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotItem {
    pub id: String,
    pub file_name: String,
    pub relative_path: String,
    pub absolute_path: String,
    pub captured_at: u64,
    pub modified_at: u64,
    pub size_bytes: u64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub format: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotDeleteFailure {
    pub id: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScreenshotDeleteResult {
    pub deleted_ids: Vec<String>,
    pub failures: Vec<ScreenshotDeleteFailure>,
    pub recovery_method: &'static str,
}

fn get_screenshot_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
    let mut components = Path::new(id).components();
    if id.is_empty()
        || !matches!(components.next(), Some(Component::Normal(_)))
        || components.next().is_some()
    {
        return Err("无效的实例 ID".to_string());
    }

    let base_path = crate::services::config_service::ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    Ok(PathBuf::from(base_path)
        .join("instances")
        .join(id)
        .join("screenshots"))
}

fn is_supported_screenshot(path: &Path) -> Option<String> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp").then_some(extension)
}

fn screenshot_id(file_name: &str) -> String {
    format!("{:x}", md5::compute(file_name.as_bytes()))
}

fn read_image_dimensions(path: &Path, format: &str) -> (Option<u32>, Option<u32>) {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(_) => return (None, None),
    };
    let mut bytes = Vec::new();
    if file
        .by_ref()
        .take(256 * 1024)
        .read_to_end(&mut bytes)
        .is_err()
    {
        return (None, None);
    }

    match format {
        "png" if bytes.len() >= 24 && &bytes[0..8] == b"\x89PNG\r\n\x1a\n" => {
            let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
            let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);
            (Some(width), Some(height))
        }
        "jpg" | "jpeg" if bytes.len() >= 10 && bytes[0..2] == [0xff, 0xd8] => {
            let mut offset = 2usize;
            while offset + 8 < bytes.len() {
                if bytes[offset] != 0xff {
                    offset += 1;
                    continue;
                }
                while offset < bytes.len() && bytes[offset] == 0xff {
                    offset += 1;
                }
                if offset >= bytes.len() {
                    break;
                }
                let marker = bytes[offset];
                offset += 1;
                if matches!(marker, 0xd8 | 0xd9) {
                    continue;
                }
                if offset + 1 >= bytes.len() {
                    break;
                }
                let segment_len = u16::from_be_bytes([bytes[offset], bytes[offset + 1]]) as usize;
                if segment_len < 2 || offset + segment_len > bytes.len() {
                    break;
                }
                if matches!(
                    marker,
                    0xc0 | 0xc1
                        | 0xc2
                        | 0xc3
                        | 0xc5
                        | 0xc6
                        | 0xc7
                        | 0xc9
                        | 0xca
                        | 0xcb
                        | 0xcd
                        | 0xce
                        | 0xcf
                ) && segment_len >= 7
                {
                    let height = u16::from_be_bytes([bytes[offset + 3], bytes[offset + 4]]) as u32;
                    let width = u16::from_be_bytes([bytes[offset + 5], bytes[offset + 6]]) as u32;
                    return (Some(width), Some(height));
                }
                offset += segment_len;
            }
            (None, None)
        }
        "webp" if bytes.len() >= 30 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" => {
            match &bytes[12..16] {
                b"VP8X" => {
                    let width = 1 + u32::from_le_bytes([bytes[24], bytes[25], bytes[26], 0]);
                    let height = 1 + u32::from_le_bytes([bytes[27], bytes[28], bytes[29], 0]);
                    (Some(width), Some(height))
                }
                b"VP8L" if bytes.len() >= 25 && bytes[20] == 0x2f => {
                    let width = 1 + bytes[21] as u32 + (((bytes[22] & 0x3f) as u32) << 8);
                    let height = 1
                        + ((bytes[22] as u32) >> 6)
                        + ((bytes[23] as u32) << 2)
                        + (((bytes[24] & 0x0f) as u32) << 10);
                    (Some(width), Some(height))
                }
                b"VP8 " if bytes.len() >= 30 && bytes[23..26] == [0x9d, 0x01, 0x2a] => {
                    let width = u16::from_le_bytes([bytes[26], bytes[27]]) as u32 & 0x3fff;
                    let height = u16::from_le_bytes([bytes[28], bytes[29]]) as u32 & 0x3fff;
                    (Some(width), Some(height))
                }
                _ => (None, None),
            }
        }
        _ => (None, None),
    }
}

fn list_screenshot_items(screen_dir: &Path) -> Result<Vec<ScreenshotItem>, String> {
    if !screen_dir.exists() {
        return Ok(Vec::new());
    }

    let mut screenshots = Vec::new();
    let entries = std::fs::read_dir(screen_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_type = match entry.file_type() {
            Ok(file_type) => file_type,
            Err(_) => continue,
        };
        if !file_type.is_file() || file_type.is_symlink() {
            continue;
        }
        let Some(format) = is_supported_screenshot(&path) else {
            continue;
        };
        let Some(file_name) = path
            .file_name()
            .and_then(|name| name.to_str())
            .map(str::to_owned)
        else {
            continue;
        };
        let metadata = match entry.metadata() {
            Ok(metadata) => metadata,
            Err(_) => continue,
        };
        let modified_at = metadata
            .modified()
            .ok()
            .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
            .map(|value| value.as_millis() as u64)
            .unwrap_or(0);
        let (width, height) = read_image_dimensions(&path, &format);

        screenshots.push(ScreenshotItem {
            id: screenshot_id(&file_name),
            file_name: file_name.clone(),
            relative_path: file_name,
            absolute_path: path.to_string_lossy().to_string(),
            captured_at: modified_at,
            modified_at,
            size_bytes: metadata.len(),
            width,
            height,
            format,
        });
    }

    screenshots.sort_by(|left, right| {
        right
            .captured_at
            .cmp(&left.captured_at)
            .then_with(|| left.file_name.cmp(&right.file_name))
    });
    Ok(screenshots)
}

#[tauri::command]
pub async fn get_all_instances<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    force_refresh: Option<bool>,
) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_all(&app, &db.pool, force_refresh.unwrap_or(false)).await
}

// ✅ 新增的兼容性实例筛选命令
#[tauri::command]
pub async fn get_compatible_instances<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    game_versions: Vec<String>,
    loaders: Vec<String>,
    ignore_loader: bool, // ✅ 接收前端传入的忽略开关
) -> AppResult<Vec<InstanceItem>> {
    InstanceListingService::get_compatible(&app, &db.pool, game_versions, loaders, ignore_loader)
        .await
}

#[tauri::command]
pub fn get_instance_screenshots<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Vec<String>, String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    Ok(list_screenshot_items(&screen_dir)?
        .into_iter()
        .map(|item| item.absolute_path)
        .collect())
}

#[tauri::command]
pub fn list_instance_screenshots<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Vec<ScreenshotItem>, String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    list_screenshot_items(&screen_dir)
}

#[tauri::command]
pub fn open_instance_screenshots_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    std::fs::create_dir_all(&screen_dir).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    SysCommand::new("explorer")
        .arg(&screen_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    SysCommand::new("open")
        .arg(&screen_dir)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    SysCommand::new("xdg-open")
        .arg(&screen_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn reveal_instance_screenshot<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    screenshot_id: String,
) -> Result<(), String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    let item = list_screenshot_items(&screen_dir)?
        .into_iter()
        .find(|item| item.id == screenshot_id)
        .ok_or_else(|| "截图不存在或已被移动".to_string())?;
    let path = PathBuf::from(item.absolute_path);

    #[cfg(target_os = "windows")]
    SysCommand::new("explorer")
        .arg("/select,")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    SysCommand::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    SysCommand::new("xdg-open")
        .arg(&screen_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_instance_screenshots<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    screenshot_ids: Vec<String>,
) -> Result<ScreenshotDeleteResult, String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    let items = list_screenshot_items(&screen_dir)?;
    let mut deleted_ids = Vec::new();
    let mut failures = Vec::new();

    for requested_id in screenshot_ids {
        let Some(item) = items.iter().find(|item| item.id == requested_id) else {
            failures.push(ScreenshotDeleteFailure {
                id: requested_id,
                message: "截图不存在或已被移动".to_string(),
            });
            continue;
        };
        let target = screen_dir.join(&item.relative_path);
        match std::fs::remove_file(&target) {
            Ok(()) => deleted_ids.push(item.id.clone()),
            Err(error) => failures.push(ScreenshotDeleteFailure {
                id: item.id.clone(),
                message: error.to_string(),
            }),
        }
    }

    Ok(ScreenshotDeleteResult {
        deleted_ids,
        failures,
        recovery_method: "permanent",
    })
}

#[tauri::command]
pub fn set_instance_cover_from_screenshot<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
    screenshot_id: String,
) -> Result<String, String> {
    let screen_dir = get_screenshot_dir(&app, &id)?;
    let item = list_screenshot_items(&screen_dir)?
        .into_iter()
        .find(|item| item.id == screenshot_id)
        .ok_or_else(|| "截图不存在或已被移动".to_string())?;

    crate::services::instance::action::InstanceActionService::change_cover(
        &app,
        &id,
        &item.absolute_path,
    )
}

// ✅ 2. 新增指令：调用系统原生文件管理器打开实例目录
#[tauri::command]
pub fn open_instance_folder<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);

    #[cfg(target_os = "windows")]
    SysCommand::new("explorer")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "macos")]
    SysCommand::new("open")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    #[cfg(target_os = "linux")]
    SysCommand::new("xdg-open")
        .arg(instance_dir)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 获取指定实例的自定义 HeroLogo 绝对路径
/// 读取 {instance_dir}/instance.json 中的 hero_logo 字段（相对路径），
/// 解析为绝对路径返回给前端使用 convertFileSrc 展示。
#[tauri::command]
pub fn get_instance_herologo<R: tauri::Runtime>(
    app: tauri::AppHandle<R>,
    id: String,
) -> Result<Option<String>, String> {
    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let instance_dir = PathBuf::from(base_path).join("instances").join(&id);
    let manifest_path = instance_dir.join("instance.json");

    let content = match std::fs::read_to_string(&manifest_path) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let config: crate::domain::instance::InstanceConfig = match serde_json::from_str(&content) {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    if let Some(relative_path) = config.hero_logo {
        if relative_path.is_empty() {
            return Ok(None);
        }
        // 相对路径：相对于实例目录进行解析
        let abs_path = instance_dir.join(&relative_path);
        if abs_path.exists() {
            return Ok(Some(abs_path.to_string_lossy().to_string()));
        }
    }

    Ok(None)
}
