// src-tauri/src/commands/mod.rs

pub mod animation_cmd;
pub mod auth_cmd;
pub mod config_cmd;
pub mod instance;
pub mod launcher_cmd;
pub mod loader_cmd;
pub mod minecraft_cmd;
pub mod resource_cmd;
pub mod runtime_cmd;
pub mod settings_cmd;
pub mod system_cmd;
pub mod modpack_cmd; // 新增 modpack_cmd 模块
pub mod java_cmd;
pub mod fs_cmd;
pub mod lan_cmd;
pub mod qrcode_cmd;

use tauri::{Builder, Runtime};

// 【关键检查点】：前面必须有 pub 关键字，这样外部的 lib.rs 才能调用它！
pub fn register<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        animation_cmd::load_custom_animation,
        instance::listing_cmd::get_all_instances,
        instance::creation_cmd::create_instance,
        minecraft_cmd::get_minecraft_versions,
        loader_cmd::get_loader_versions,
        config_cmd::get_base_directory,
        config_cmd::set_base_directory,
        settings_cmd::get_settings,
        settings_cmd::save_settings,
        system_cmd::get_system_fonts,
        settings_cmd::import_background_image,
        settings_cmd::delete_background_image,
        settings_cmd::get_keybindings,
        settings_cmd::save_keybindings,
        system_cmd::check_steam_deck,
        runtime_cmd::get_system_memory,
        runtime_cmd::validate_java_cache,
        runtime_cmd::scan_java_environments,
        runtime_cmd::get_instance_runtime,
        runtime_cmd::save_instance_runtime,
        instance::action_cmd::rename_instance,
        instance::action_cmd::change_instance_cover,
        instance::action_cmd::delete_instance,
        instance::action_cmd::get_instance_detail,
        instance::action_cmd::check_instance_gamepad,
        instance::action_cmd::install_remote_mod,
        instance::mod_cmd::get_instance_mods,
        instance::mod_cmd::create_mod_snapshot,
        instance::mod_cmd::rollback_mod_snapshot,
        instance::mod_cmd::update_mod_cache,
        instance::mod_cmd::open_mod_folder,
        instance::resource_cmd::list_resources,
        instance::resource_cmd::toggle_resource,
        instance::resource_cmd::delete_resource,
        instance::resource_cmd::create_resource_snapshot,
        instance::save_cmd::get_saves,
        instance::save_cmd::backup_save,
        instance::save_cmd::delete_save,
        instance::save_cmd::verify_save_restore,
        instance::save_cmd::get_save_backups,
        instance::resource_cmd::open_resource_folder,
        instance::listing_cmd::get_compatible_instances, 
        instance::listing_cmd::get_instance_screenshots, 
        instance::listing_cmd::open_instance_folder,
        instance::save_cmd::open_saves_folder, 
        resource_cmd::get_ore_project_detail,
        resource_cmd::get_ore_project_versions,
        resource_cmd::download_resource,
        launcher_cmd::launch_game,
        launcher_cmd::export_diagnostics,
        system_cmd::get_primary_monitor_resolution,
        auth_cmd::request_microsoft_device_code,
        auth_cmd::poll_and_exchange_microsoft_token,
        auth_cmd::generate_offline_uuid,
        auth_cmd::upload_offline_skin,
        auth_cmd::fetch_offline_skin_from_mojang,
        auth_cmd::delete_offline_account_dir,
        modpack_cmd::parse_modpack_metadata,
        modpack_cmd::import_modpack,
        modpack_cmd::download_and_import_modpack, // 新增在线下载并导入整合包的命令
        java_cmd::download_java_env,
        fs_cmd::get_drives,
        fs_cmd::list_valid_dirs,
        fs_cmd::create_valid_dir,
        fs_cmd::get_parent_dir,
        auth_cmd::refresh_microsoft_token,
        auth_cmd::get_or_fetch_account_avatar,
        lan_cmd::scan_lan_devices,
        lan_cmd::send_trust_request,
        lan_cmd::get_trusted_devices,
        lan_cmd::resolve_trust_request,
        lan_cmd::sync_lan_avatar,
        lan_cmd::get_local_instances,
        lan_cmd::get_instance_saves,
        lan_cmd::push_to_device,
        lan_cmd::apply_received_transfer,
        qrcode_cmd::generate_device_auth_qr,

    ])
}
