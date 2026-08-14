// src-tauri/src/commands/system_cmd.rs
use std::collections::HashSet;
// ✅ 核心修复：导入缺失的路径和文件操作模块
use std::fs;
use std::path::Path;
use tauri::command;
use tauri::{AppHandle, Runtime, State};

use crate::services::deferred_startup::DeferredStartupState;

const FLATPAK_APP_ID: &str = "com.mrshell.PiLauncher";

struct SteamShortcutTarget {
    exe: String,
    start_dir: String,
    launch_options: String,
}

fn steam_shortcut_target(executable: &Path, flatpak_id: Option<&str>) -> SteamShortcutTarget {
    if flatpak_id == Some(FLATPAK_APP_ID) {
        let home_dir = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
        return SteamShortcutTarget {
            exe: "\"/usr/bin/flatpak\"".to_string(),
            start_dir: format!("\"{}\"", home_dir),
            launch_options: format!("run {}", FLATPAK_APP_ID),
        };
    }

    let start_dir = executable.parent().unwrap_or_else(|| Path::new("."));
    SteamShortcutTarget {
        exe: format!("\"{}\"", executable.to_string_lossy()),
        start_dir: format!("\"{}\"", start_dir.to_string_lossy()),
        launch_options: String::new(),
    }
}

#[tauri::command]
pub async fn start_deferred_services(
    deferred_startup: State<'_, DeferredStartupState>,
) -> Result<(), String> {
    deferred_startup.start();
    Ok(())
}
#[command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        use font_kit::source::SystemSource;
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
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(vec![])
    }
}

#[tauri::command]
pub async fn check_steam_deck() -> Result<bool, String> {
    #[cfg(all(target_os = "linux", not(target_os = "android")))]
    {
        // 1. 检查 SteamOS 的标志性发行版文件
        let has_steamos = Path::new("/etc/steamos-release").exists();

        // 2. 检查 CPU 型号是否为 AMD Custom APU
        let cpuinfo = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
        let is_custom_apu = cpuinfo.contains("AMD Custom APU");

        // 只要满足其一，我们就认为是 Steam Deck 掌机环境
        Ok(has_steamos || is_custom_apu)
    }

    // Windows 或 macOS 或 Android 或 iOS 等其他环境直接返回 false
    #[cfg(not(all(target_os = "linux", not(target_os = "android"))))]
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
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        Ok(steamlocate::SteamDir::locate().is_ok())
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub async fn check_steamos_gamepad_mode() -> Result<bool, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        Ok(is_steamos_gamepad_mode(
            &std::env::var("XDG_CURRENT_DESKTOP").unwrap_or_default(),
            &std::env::var("WAYLAND_DISPLAY").unwrap_or_default(),
            &std::env::var("SteamDeck").unwrap_or_default(),
        ))
    }
    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Ok(false)
    }
}

#[tauri::command]
pub async fn register_steam_shortcut<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
) -> Result<bool, String> {
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        let steamdir = match steamlocate::SteamDir::locate() {
            Ok(dir) => dir,
            Err(_) => return Err("Steam not found".to_string()),
        };

        let userdata_path = steamdir.path().join("userdata");
        if !userdata_path.exists() {
            return Err("Steam userdata not found".to_string());
        }

        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let target = steam_shortcut_target(&exe_path, std::env::var("FLATPAK_ID").ok().as_deref());

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
                                if let Ok(parsed) = steam_shortcuts_util::parse_shortcuts(&content)
                                {
                                    shortcuts = parsed.into_iter().map(|s| s.to_owned()).collect();
                                }
                            }
                        }

                        let appid = if let Some(existing) = shortcuts
                            .iter_mut()
                            .find(|shortcut| shortcut.app_name == "PiLauncher")
                        {
                            // Keep the existing AppID so Steam Input layouts and artwork
                            // remain associated with this shortcut after an app update.
                            existing.exe = target.exe.clone();
                            existing.start_dir = target.start_dir.clone();
                            existing.launch_options = target.launch_options.clone();
                            existing.app_id
                        } else {
                            let new_shortcut = steam_shortcuts_util::shortcut::Shortcut::new(
                                "0",
                                "PiLauncher",
                                &target.exe,
                                &target.start_dir,
                                "",
                                "",
                                &target.launch_options,
                            );
                            let appid = new_shortcut.app_id;
                            shortcuts.push(new_shortcut.to_owned());
                            appid
                        };

                        let borrowed_shortcuts: Vec<steam_shortcuts_util::shortcut::Shortcut> =
                            shortcuts.iter().map(|s| s.borrow()).collect();
                        let bytes = steam_shortcuts_util::shortcuts_to_bytes(&borrowed_shortcuts);
                        if fs::write(&shortcuts_path, bytes).is_ok() {
                            let grid_dir = config_dir.join("grid");
                            let _ = fs::create_dir_all(&grid_dir);

                            let cwd = std::env::current_dir().unwrap_or_default();
                            let mut dev_grid = cwd.join("src").join("assets").join("steamgrid");
                            if !dev_grid.exists() {
                                dev_grid = cwd
                                    .parent()
                                    .unwrap_or(Path::new(""))
                                    .join("src")
                                    .join("assets")
                                    .join("steamgrid");
                            }

                            if dev_grid.exists() {
                                let _ = fs::copy(
                                    dev_grid.join("library_600x900.png"),
                                    grid_dir.join(format!("{}p.png", appid)),
                                );
                                let _ = fs::copy(
                                    dev_grid.join("header.png"),
                                    grid_dir.join(format!("{}.png", appid)),
                                );
                                let _ = fs::copy(
                                    dev_grid.join("library_hero.png"),
                                    grid_dir.join(format!("{}_hero.png", appid)),
                                );
                                let _ = fs::copy(
                                    dev_grid.join("logo.png"),
                                    grid_dir.join(format!("{}_logo.png", appid)),
                                );
                            }

                            success = true;
                        }
                    }
                }
            }
        }

        Ok(success)
    }

    #[cfg(any(target_os = "android", target_os = "ios"))]
    {
        Err("Steam shortcut registration is not supported on mobile devices.".to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flatpak_shortcut_runs_the_host_flatpak_command() {
        let target = steam_shortcut_target(Path::new("/app/bin/PiLauncher"), Some(FLATPAK_APP_ID));

        assert_eq!(target.exe, "\"/usr/bin/flatpak\"");
        assert_eq!(target.launch_options, "run com.mrshell.PiLauncher");
        assert_ne!(target.exe, "\"/app/bin/PiLauncher\"");
    }

    #[test]
    fn native_shortcut_runs_the_packaged_executable() {
        let target = steam_shortcut_target(Path::new("/opt/PiLauncher/PiLauncher"), None);

        assert_eq!(target.exe, "\"/opt/PiLauncher/PiLauncher\"");
        assert_eq!(target.start_dir, "\"/opt/PiLauncher\"");
        assert!(target.launch_options.is_empty());
    }

    #[test]
    fn gamepad_mode_requires_a_gamescope_or_steam_deck_session() {
        assert!(is_steamos_gamepad_mode("gamescope", "wayland-0", ""));
        assert!(is_steamos_gamepad_mode("KDE", "gamescope", ""));
        assert!(is_steamos_gamepad_mode("KDE", "wayland-0", "1"));
        assert!(!is_steamos_gamepad_mode("KDE", "wayland-0", ""));
    }
}

fn is_steamos_gamepad_mode(current_desktop: &str, wayland_display: &str, steam_deck: &str) -> bool {
    current_desktop.eq_ignore_ascii_case("gamescope")
        || wayland_display.eq_ignore_ascii_case("gamescope")
        || steam_deck == "1"
}
