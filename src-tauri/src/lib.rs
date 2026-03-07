// /src-tauri/src/lib.rs

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

    // 2. 挂载所有模块化的 IPC Commands (确保你在 commands/mod.rs 里面已经加入了 lan_cmd)
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

            let handle = app.handle().clone();
            let state_clone = lan_state.clone();

            // ✅ 3. 在后台独立线程中派发常驻网络服务
            tauri::async_runtime::spawn(async move {
                // 读取基础目录。如果是首次启动 (向导未完成)，base_path 可能为 None
                if let Ok(Some(base_path_str)) = services::config_service::ConfigService::get_base_path(&handle) {
                    let config_dir = std::path::PathBuf::from(base_path_str).join("config");
                    
                    // 获取本机身份
                    let identity = services::lan::trust_store::TrustStore::get_or_create_identity(&config_dir);
                    
                    // 启动 mDNS 局域网组播宣告
                    services::lan::mdns_service::MdnsScanner::start_broadcast(
                        &identity.device_id,
                        &identity.device_name,
                        9999
                    );
                }

                // 启动 Axum RPC 服务器，持续监听 9999 端口
                services::lan::http_api::start_http_server(handle, state_clone, 9999).await;
            });

            Ok(())
        })
        // 4. 运行逻辑
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}