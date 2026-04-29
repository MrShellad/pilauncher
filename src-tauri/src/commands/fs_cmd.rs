// src-tauri/src/commands/fs_cmd.rs
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(serde::Serialize)]
pub struct DirNode {
    pub name: String,
    pub path: String,
    pub is_drive: bool,
    pub is_file: bool,
    pub extension: Option<String>,
}

fn user_home_dir() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(profile) = std::env::var("USERPROFILE") {
            return Some(PathBuf::from(profile));
        }

        let drive = std::env::var("HOMEDRIVE").ok();
        let path = std::env::var("HOMEPATH").ok();
        if let (Some(drive), Some(path)) = (drive, path) {
            return Some(PathBuf::from(format!("{}{}", drive, path)));
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(home) = std::env::var("HOME") {
            return Some(PathBuf::from(home));
        }
    }

    None
}

fn push_quick_dir(nodes: &mut Vec<DirNode>, name: &str, path: PathBuf) {
    if !path.exists() || !path.is_dir() {
        return;
    }

    let path_string = path.to_string_lossy().to_string();
    if nodes.iter().any(|node| node.path == path_string) {
        return;
    }

    nodes.push(DirNode {
        name: name.to_string(),
        path: path_string,
        is_drive: false,
        is_file: false,
        extension: None,
    });
}

#[tauri::command]
pub async fn get_drives() -> Result<Vec<DirNode>, String> {
    let mut drives = Vec::new();

    if let Some(home) = user_home_dir() {
        push_quick_dir(&mut drives, "Home", home.clone());
        push_quick_dir(&mut drives, "Downloads", home.join("Downloads"));
        push_quick_dir(&mut drives, "Desktop", home.join("Desktop"));
        push_quick_dir(&mut drives, "Documents", home.join("Documents"));
    }

    #[cfg(target_os = "windows")]
    {
        for b in b'A'..=b'Z' {
            let drive = format!("{}:\\", b as char);
            if Path::new(&drive).exists() {
                drives.push(DirNode {
                    name: format!("本地磁盘 ({}:)", b as char),
                    path: drive,
                    is_drive: true,
                    is_file: false,
                    extension: None,
                });
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        drives.push(DirNode {
            name: "根目录 (/)".to_string(),
            path: "/".to_string(),
            is_drive: true,
            is_file: false,
            extension: None,
        });
        // ✅ 核心兼容：为 macOS 和 Linux 加入用户主目录的快速入口
        if let Ok(home) = std::env::var("HOME") {
            drives.push(DirNode {
                name: "用户目录 (~)".to_string(),
                path: home,
                is_drive: true,
                is_file: false,
                extension: None,
            });
        }
    }
    let mut seen_paths = HashSet::new();
    drives.retain(|node| seen_paths.insert(node.path.clone()));
    Ok(drives)
}

#[tauri::command]
pub async fn list_valid_dirs(path: String) -> Result<Vec<DirNode>, String> {
    let mut dirs = Vec::new();
    let path_obj = Path::new(&path);

    if !path_obj.exists() || !path_obj.is_dir() {
        return Err("路径不存在或拒绝访问".into());
    }

    if let Ok(entries) = fs::read_dir(path_obj) {
        for entry in entries.filter_map(Result::ok) {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_dir() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.is_ascii() {
                        dirs.push(DirNode {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                            is_drive: false,
                            is_file: false,
                            extension: None,
                        });
                    }
                }
            }
        }
    }
    dirs.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(dirs)
}

#[tauri::command]
pub async fn list_directory_entries(
    path: String,
    include_files: bool,
) -> Result<Vec<DirNode>, String> {
    let mut nodes = Vec::new();
    let path_obj = Path::new(&path);

    if !path_obj.exists() || !path_obj.is_dir() {
        return Err("路径不存在或拒绝访问".into());
    }

    if let Ok(entries) = fs::read_dir(path_obj) {
        for entry in entries.filter_map(Result::ok) {
            let Ok(file_type) = entry.file_type() else {
                continue;
            };

            let name = entry.file_name().to_string_lossy().to_string();
            if !name.is_ascii() {
                continue;
            }

            if file_type.is_dir() {
                nodes.push(DirNode {
                    name,
                    path: entry.path().to_string_lossy().to_string(),
                    is_drive: false,
                    is_file: false,
                    extension: None,
                });
            } else if include_files && file_type.is_file() {
                let extension = entry
                    .path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| ext.to_ascii_lowercase());

                nodes.push(DirNode {
                    name,
                    path: entry.path().to_string_lossy().to_string(),
                    is_drive: false,
                    is_file: true,
                    extension,
                });
            }
        }
    }

    nodes.sort_by(|a, b| {
        a.is_file
            .cmp(&b.is_file)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(nodes)
}

#[tauri::command]
pub async fn create_valid_dir(parent: String, name: String) -> Result<String, String> {
    if !name.is_ascii() {
        return Err("目录名只能包含英文字符和数字！".into());
    }
    let target = Path::new(&parent).join(&name);
    if target.exists() {
        return Err("该目录已存在".into());
    }
    fs::create_dir(&target).map_err(|e| format!("创建失败: {}", e))?;
    Ok(target.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_parent_dir(path: String) -> Result<Option<String>, String> {
    let p = Path::new(&path);
    if let Some(parent) = p.parent() {
        let parent_str = parent.to_string_lossy().to_string();
        if parent_str.is_empty() || parent_str == path {
            Ok(None)
        } else {
            Ok(Some(parent_str))
        }
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn open_path_in_file_manager(path: String) -> Result<(), String> {
    let input = PathBuf::from(path);
    let target = if input.is_file() {
        input
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "无法解析文件所在目录".to_string())?
    } else {
        input
    };

    if !target.exists() || !target.is_dir() {
        return Err("目录不存在或无法访问".to_string());
    }

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&target)
        .spawn()
        .map_err(|e| format!("打开目录失败: {}", e))?;

    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&target)
        .spawn()
        .map_err(|e| format!("打开目录失败: {}", e))?;

    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&target)
        .spawn()
        .map_err(|e| format!("打开目录失败: {}", e))?;

    Ok(())
}
