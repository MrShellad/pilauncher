use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use tauri::AppHandle;

use crate::services;

static DEFERRED_SERVICES_STARTED: AtomicBool = AtomicBool::new(false);

pub struct DeferredStartupState {
    pub app: AppHandle,
    pub lan_state: Arc<services::lan::http_api::SharedLanState>,
}

impl DeferredStartupState {
    pub fn start(&self) {
        start(self.app.clone(), self.lan_state.clone());
    }
}

pub fn start(app: AppHandle, lan_state: Arc<services::lan::http_api::SharedLanState>) {
    if DEFERRED_SERVICES_STARTED.swap(true, Ordering::AcqRel) {
        println!("[PiLauncher] Deferred background services already started; skipping.");
        return;
    }

    let handle_for_lan = app.clone();
    let state_for_lan = lan_state.clone();

    tauri::async_runtime::spawn(async move {
        println!("\n[PiLauncher] ========================================");
        println!("[PiLauncher] Starting deferred LAN background services...");

        match services::config_service::ConfigService::get_base_path(&handle_for_lan) {
            Ok(Some(base_path_str)) => {
                let config_dir = std::path::PathBuf::from(base_path_str).join("config");
                let identity =
                    services::lan::trust_store::TrustStore::get_or_create_identity(&config_dir);

                println!(
                    "[PiLauncher] Loaded LAN identity -> ID: {}, Name: {}",
                    identity.device_id, identity.device_name
                );

                services::lan::mdns_service::MdnsScanner::start_broadcast(
                    &identity.device_id,
                    &identity.device_name,
                    9999,
                );
            }
            _ => {
                println!("[PiLauncher] Base path is not configured.");
                println!("[PiLauncher] mDNS broadcast is deferred until setup is complete and the launcher restarts.");
            }
        }

        println!("[PiLauncher] Starting LAN HTTP RPC server on port 9999...");
        println!("[PiLauncher] ========================================\n");

        services::lan::http_api::start_http_server(handle_for_lan, state_for_lan, 9999).await;
    });

    services::gamepad_service::GamepadService::start_listener(app);
}
