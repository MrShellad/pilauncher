// src-tauri/src/lib.rs

use std::sync::Arc;
use tauri::Manager;

pub mod commands;
pub mod domain;
pub mod error;
pub mod services;

#[cfg(target_os = "linux")]
fn apply_linux_compat_env_vars() {
    use std::fs;
    use std::path::PathBuf;
    use sysinfo::System;

    // 获取发行版 ID（静态方法）
    let distro = System::distribution_id().to_lowercase();
    let is_kali = distro.contains("kali");

    let mut should_disable = false;
    let mut found_setting = false;

    // 手动解析默认配置路径 (Tauri 2 默认在 ~/.config/<bundle_id>)
    if let Some(home) = std::env::var_os("HOME") {
        let config_dir = PathBuf::from(home)
            .join(".config")
            .join("com.mrshell.PiLauncher");
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
    #[cfg(target_os = "linux")]
    apply_linux_compat_env_vars();

    let lan_state = Arc::new(services::lan::http_api::SharedLanState::new());

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(lan_state.clone());

    builder = commands::register(builder);

    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
            // ==========================================

            // 启动游戏时长背景任务（心跳定时存盘、自动同步、启动时恢复异常中断的会话）
            services::playtime::PlaytimeService::spawn_background_tasks(
                app.handle().clone(),
                pool.clone(),
            );

            // Non-critical LAN and gamepad services are started by the frontend after the
            // first rendered frame via start_deferred_services.

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
