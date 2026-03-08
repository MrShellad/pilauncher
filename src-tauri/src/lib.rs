// src-tauri/src/lib.rs

use std::sync::Arc;
use tauri::Manager;

// 1. 声明顶级模块
pub mod commands;
pub mod domain;
pub mod error;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // ✅ 初始化局域网共享状态 (用于 Tauri 和 Axum HTTP 跨线程握手通信)
    let lan_state = Arc::new(services::lan::http_api::SharedLanState::new());

    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        // ✅ 将状态托管给 Tauri，以便在 Command 中通过 State<'_, SharedLanState> 提取
        .manage(lan_state.clone()); 

    // 2. 挂载所有模块化的 IPC Commands
    builder = commands::register(builder);

    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(move |app| {
            // 初始化日志插件
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let handle = app.handle().clone();
            let state_clone = lan_state.clone();

            // ✅ 3. 在后台独立线程中派发常驻网络服务
            tauri::async_runtime::spawn(async move {
                println!("\n[PiLauncher] ========================================");
                println!("[PiLauncher] 🚀 正在初始化后台局域网核心引擎...");

                // 读取基础目录。如果是首次全新启动 (向导未完成)，base_path 可能为 None
                match services::config_service::ConfigService::get_base_path(&handle) {
                    Ok(Some(base_path_str)) => {
                        let config_dir = std::path::PathBuf::from(base_path_str).join("config");
                        
                        // 获取本机身份 (会自动从 settings.json 中读取最新的设备名)
                        let identity = services::lan::trust_store::TrustStore::get_or_create_identity(&config_dir);
                        
                        println!("[PiLauncher] 🏷️ 加载本机身份成功 -> ID: {}, Name: {}", identity.device_id, identity.device_name);

                        // 启动 mDNS 局域网组播宣告
                        services::lan::mdns_service::MdnsScanner::start_broadcast(
                            &identity.device_id,
                            &identity.device_name,
                            9999
                        );
                    }
                    _ => {
                        // 首次运行向导时的友好提示
                        println!("[PiLauncher] ⚠️ 警告: 尚未配置游戏基础数据目录(base_path)。");
                        println!("[PiLauncher] ⚠️ mDNS 局域网广播已暂时挂起，将在您完成向导并重启启动器后生效。");
                    }
                }

                println!("[PiLauncher] 🌐 正在启动内部 HTTP RPC 服务器 (端口 9999)...");
                println!("[PiLauncher] ========================================\n");
                
                // 启动 Axum RPC 服务器，持续监听 9999 端口
                services::lan::http_api::start_http_server(handle, state_clone, 9999).await;
            });

            Ok(())
        })
        // 4. 运行逻辑
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}