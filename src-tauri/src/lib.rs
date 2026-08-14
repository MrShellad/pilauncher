// src-tauri/src/lib.rs

use std::sync::Arc;
use tauri::{Emitter, Manager};

pub mod commands;
pub mod domain;
pub mod error;
pub mod services;

#[cfg(any(test, all(target_os = "linux", not(target_os = "android"))))]
fn resolve_linux_app_config_dir(
    xdg_config_home: Option<std::path::PathBuf>,
    home: Option<std::path::PathBuf>,
) -> Option<std::path::PathBuf> {
    xdg_config_home
        .or_else(|| home.map(|path| path.join(".config")))
        .map(|path| path.join("com.mrshell.PiLauncher"))
}

#[cfg(all(target_os = "linux", not(target_os = "android")))]
fn apply_linux_compat_env_vars() {
    use std::fs;
    use std::path::PathBuf;
    use sysinfo::System;

    // 获取发行版 ID（静态方法）
    let distro = System::distribution_id().to_lowercase();
    let is_kali = distro.contains("kali");

    let mut should_disable = false;
    let mut found_setting = false;

    let config_dir = resolve_linux_app_config_dir(
        std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from),
        std::env::var_os("HOME").map(PathBuf::from),
    );
    if let Some(config_dir) = config_dir {
        let meta_path = config_dir.join("meta.json");

        if let Ok(meta_content) = fs::read_to_string(meta_path) {
            if let Ok(meta_json) = serde_json::from_str::<serde_json::Value>(&meta_content) {
                if let Some(base_path) = meta_json["base_path"].as_str() {
                    let settings_path = PathBuf::from(base_path)
                        .join("config")
                        .join("settings.json");
                    if let Ok(settings_content) = fs::read_to_string(settings_path) {
                        if let Ok(settings_json) =
                            serde_json::from_str::<serde_json::Value>(&settings_content)
                        {
                            // Zustand 默认持久化结构
                            if let Some(val) =
                                settings_json.pointer("/state/settings/general/linuxDisableDmabuf")
                            {
                                if let Some(b) = val.as_bool() {
                                    should_disable = b;
                                    found_setting = true;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 针对 Kali 的兜底：如果未设置过，则默认启用
    if !found_setting && is_kali {
        should_disable = true;
    }

    if should_disable {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        println!("[Linux Compat] 检测到渲染兼容性需求，已设置 WEBKIT_DISABLE_DMABUF_RENDERER=1");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = lighty_core::app_state::AppState::init("PiLauncher");

    #[cfg(all(target_os = "linux", not(target_os = "android")))]
    apply_linux_compat_env_vars();

    let lan_state = Arc::new(services::lan::http_api::SharedLanState::new());

    let mut builder = tauri::Builder::default();

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder = builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(lan_state.clone());

    builder = commands::register(builder);

    let app = builder
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            services::config_service::ConfigService::ensure_base_path(app.handle()).map_err(
                |error| std::io::Error::other(format!("failed to initialize base directory: {}", error)),
            )?;

            // ==========================================
            // 挂载异步的 SQLite 数据库
            // ==========================================
            let app_dir = app.path().app_data_dir().expect("无法获取系统应用数据目录");
            let db_config_dir = app_dir.join("config");

            let pool = tauri::async_runtime::block_on(async {
                services::db_service::DbService::init_db(&db_config_dir).await
            })
            .expect("数据库初始化崩溃！请检查文件读写权限！");

            app.manage(services::db_service::AppDatabase { pool: pool.clone() });
            app.manage(services::deferred_startup::DeferredStartupState {
                app: app.handle().clone(),
                lan_state: lan_state.clone(),
            });
            app.manage(Arc::new(services::terracotta::TerracottaState::new()));
            // ==========================================

            // 启动游戏时长背景任务（心跳定时存盘、自动同步、启动时恢复异常中断的会话）
            services::playtime::PlaytimeService::spawn_background_tasks(
                app.handle().clone(),
                pool.clone(),
            );

            // 监听游戏退出事件，并异步安全地触发自动备份
            use tauri::Listener;
            let app_handle = app.handle().clone();
            app.handle().listen_any("game-exit", move |event| {
                if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                    if let Some(instance_id) = payload["instanceId"].as_str() {
                        let backup_app = app_handle.clone();
                        let backup_instance_id = instance_id.to_string();
                        tauri::async_runtime::spawn_blocking(move || {
                            match crate::services::instance::save_manager::SaveManagerService::backup_recent_save_on_game_exit(
                                &backup_app,
                                &backup_instance_id,
                            ) {
                                Ok(backups) if !backups.is_empty() => {
                                    let message = format!(
                                        "[SaveBackup] auto_exit completed for {} save(s)",
                                        backups.len()
                                    );
                                    println!("{}", message);
                                    let _ = backup_app.emit("game-log", message);
                                }
                                Ok(_) => {}
                                Err(error) => {
                                    let message = format!("[SaveBackup] auto_exit skipped or failed: {}", error);
                                    eprintln!("{}", message);
                                    let _ = backup_app.emit("game-log", message);
                                }
                            }
                        });
                    }
                }
            });

            // Non-critical LAN and gamepad services are started by the frontend after the
            // first rendered frame via start_deferred_services.

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app_handle: &tauri::AppHandle, _event| {
        // NOTE: Terracotta sidecar cleanup disabled — no child process to kill.
    });
}

#[cfg(test)]
mod tests {
    use super::resolve_linux_app_config_dir;
    use std::path::PathBuf;

    #[test]
    fn prefers_xdg_config_home_for_linux_app_config() {
        assert_eq!(
            resolve_linux_app_config_dir(
                Some(PathBuf::from("/sandbox/config")),
                Some(PathBuf::from("/home/player"))
            ),
            Some(PathBuf::from("/sandbox/config/com.mrshell.PiLauncher"))
        );
    }

    #[test]
    fn falls_back_to_home_config_directory() {
        assert_eq!(
            resolve_linux_app_config_dir(None, Some(PathBuf::from("/home/player"))),
            Some(PathBuf::from("/home/player/.config/com.mrshell.PiLauncher"))
        );
    }
}
