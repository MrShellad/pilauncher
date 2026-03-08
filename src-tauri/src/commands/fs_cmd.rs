// src-tauri/src/commands/fs_cmd.rs
use std::fs;
use std::path::Path;

#[derive(serde::Serialize)]
pub struct DirNode {
    pub name: String,
    pub path: String,
    pub is_drive: bool,
}

#[tauri::command]
pub async fn get_drives() -> Result<Vec<DirNode>, String> {
    let mut drives = Vec::new();
    #[cfg(target_os = "windows")]
    {
        for b in b'A'..=b'Z' {
            let drive = format!("{}:\\", b as char);
            if Path::new(&drive).exists() {
                drives.push(DirNode {
                    name: format!("本地磁盘 ({}:)", b as char),
                    path: drive,
                    is_drive: true,
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
        });
        // ✅ 核心兼容：为 macOS 和 Linux 加入用户主目录的快速入口
        if let Ok(home) = std::env::var("HOME") {
            drives.push(DirNode {
                name: "用户目录 (~)".to_string(),
                path: home,
                is_drive: true,
            });
        }
    }
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
                    if !name.starts_with('.') && name.is_ascii() {
                        dirs.push(DirNode {
                            name,
                            path: entry.path().to_string_lossy().to_string(),
                            is_drive: false,
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