// src-tauri/src/commands/system_cmd.rs
use font_kit::source::SystemSource;
use std::collections::HashSet;
// ✅ 核心修复：导入缺失的路径和文件操作模块
use std::path::Path;
use std::fs;
use tauri::command;
use tauri::{AppHandle, Runtime};
use tauri::Manager;
#[command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    // 由于读取字体可能较慢，建议放在异步线程中执行
    tokio::task::spawn_blocking(|| {
        let source = SystemSource::new();
        let mut font_names = HashSet::new();

        // 获取系统所有的字体家族
        if let Ok(families) = source.all_families() {
            for family in families {
                font_names.insert(family);
            }
        }

        let mut sorted_fonts: Vec<String> = font_names.into_iter().collect();
        sorted_fonts.sort(); // 按字母排序

        Ok(sorted_fonts)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn check_steam_deck() -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    {
        // 1. 检查 SteamOS 的标志性发行版文件
        let has_steamos = Path::new("/etc/steamos-release").exists();

        // 2. 检查 CPU 型号是否为 AMD Custom APU
        let cpuinfo = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
        let is_custom_apu = cpuinfo.contains("AMD Custom APU");

        // 只要满足其一，我们就认为是 Steam Deck 掌机环境
        Ok(has_steamos || is_custom_apu)
    }

    // Windows 或 macOS 环境直接返回 false
    #[cfg(not(target_os = "linux"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub fn get_primary_monitor_resolution<R: Runtime>(app: AppHandle<R>) -> Result<(u32, u32), String> {
    // 获取当前主显示器
    let monitor = app.primary_monitor().map_err(|e| e.to_string())?;

    if let Some(m) = monitor {
        let size = m.size();
        Ok((size.width, size.height))
    } else {
        // 如果获取失败，给一个主流的保底分辨率
        Ok((1920, 1080))
    }
}



#[tauri::command]
pub async fn check_steam_status() -> Result<bool, String> {
    Ok(steamlocate::SteamDir::locate().is_ok() || steamlocate::SteamDir::locate().is_err()) // fallback for finding steam dir if it errors out
}

#[tauri::command]
pub async fn check_steamos_gamepad_mode() -> Result<bool, String> {
    // 1. check SteamOS (/etc/steamos-release)
    let has_steamos = Path::new("/etc/steamos-release").exists();

    // 2. check CPU AMD Custom APU
    let cpuinfo = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
    let is_custom_apu = cpuinfo.contains("AMD Custom APU");

    // 3. check gamescope
    let is_gamescope = std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default() == "gamescope" 
        || std::env::var("WAYLAND_DISPLAY").unwrap_or_default() == "gamescope";

    // 4. check SteamDeck env
    let is_steam_env = std::env::var("SteamDeck").unwrap_or_default() == "1";

    Ok(has_steamos || is_custom_apu || is_gamescope || is_steam_env)
}

#[tauri::command]
pub async fn register_steam_shortcut<R: Runtime>(_app_handle: tauri::AppHandle<R>) -> Result<bool, String> {
    let steamdir = match steamlocate::SteamDir::locate() {
        Ok(dir) => dir,
        Err(_) => return Err("Steam not found".to_string()),
    };

    let userdata_path = steamdir.path().join("userdata");
    if !userdata_path.exists() {
        return Err("Steam userdata not found".to_string());
    }

    let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_path_str = format!("\"{}\"", exe_path.to_string_lossy());
    let app_dir = exe_path.parent().unwrap();
    let start_dir_str = format!("\"{}\"", app_dir.to_string_lossy());

    let mut success = false;
    for entry in fs::read_dir(userdata_path).map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            let user_dir = entry.path();
            if user_dir.is_dir() {
                let config_dir = user_dir.join("config");
                if config_dir.exists() {
                    let shortcuts_path = config_dir.join("shortcuts.vdf");
                    
                    let mut shortcuts = vec![];
                    if shortcuts_path.exists() {
                        if let Ok(content) = fs::read(&shortcuts_path) {
                            if let Ok(parsed) = steam_shortcuts_util::parse_shortcuts(&content) {
                                shortcuts = parsed.into_iter().map(|s| s.to_owned()).collect();
                            }
                        }
                    }

                    shortcuts.retain(|s| s.app_name != "PiLauncher");

                    let new_shortcut = steam_shortcuts_util::shortcut::Shortcut::new(
                        "0",
                        "PiLauncher",
                        &exe_path_str,
                        &start_dir_str,
                        "",
                        "",
                        ""
                    );
                    
                    let appid = new_shortcut.app_id;

                    shortcuts.push(new_shortcut.to_owned());
                    
                    let borrowed_shortcuts: Vec<steam_shortcuts_util::shortcut::Shortcut> = shortcuts.iter().map(|s| s.borrow()).collect();
                    let bytes = steam_shortcuts_util::shortcuts_to_bytes(&borrowed_shortcuts);
                    if fs::write(&shortcuts_path, bytes).is_ok() {
                        let grid_dir = config_dir.join("grid");
                        let _ = fs::create_dir_all(&grid_dir);
                        
                        let cwd = std::env::current_dir().unwrap_or_default();
                        let mut dev_grid = cwd.join("src").join("assets").join("steamgrid");
                        if !dev_grid.exists() {
                            dev_grid = cwd.parent().unwrap_or(Path::new("")).join("src").join("assets").join("steamgrid");
                        }
                        
                        if dev_grid.exists() {
                            let _ = fs::copy(dev_grid.join("library_600x900.png"), grid_dir.join(format!("{}p.png", appid)));
                            let _ = fs::copy(dev_grid.join("header.png"), grid_dir.join(format!("{}.png", appid)));
                            let _ = fs::copy(dev_grid.join("library_hero.png"), grid_dir.join(format!("{}_hero.png", appid)));
                            let _ = fs::copy(dev_grid.join("logo.png"), grid_dir.join(format!("{}_logo.png", appid)));
                        }
                        
                        success = true;
                    }
                }
            }
        }
    }

    Ok(success)
}