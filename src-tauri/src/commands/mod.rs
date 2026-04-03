// src-tauri/src/commands/mod.rs

pub mod animation_cmd;
pub mod auth_cmd;
pub mod cache_cmd;
pub mod config_cmd;
pub mod fs_cmd;
pub mod instance;
pub mod java_cmd;
pub mod lan_cmd;
pub mod launcher_cmd;
pub mod library_cmd; // 新增 library_cmd 模块
pub mod loader_cmd;
pub mod minecraft_cmd;
pub mod modpack_cmd; // 新增 modpack_cmd 模块
pub mod network_cmd;
pub mod qrcode_cmd;
pub mod resource_cmd;
pub mod runtime_cmd;
pub mod settings_cmd;
pub mod system_cmd;
pub mod update_cmd;

use tauri::{Builder, Runtime};

// 【关键检查点】：前面必须有 pub 关键字，这样外部的 lib.rs 才能调用它！
pub fn register<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        animation_cmd::load_custom_animation,
        cache_cmd::read_session_cache,
        cache_cmd::read_persistent_cache,
        cache_cmd::read_shared_download_filter_config,
        cache_cmd::write_session_cache,
        cache_cmd::write_persistent_cache,
        instance::listing_cmd::get_all_instances,
        instance::creation_cmd::create_instance,
        instance::creation_cmd::cancel_instance_deployment,
        minecraft_cmd::get_minecraft_versions,
        loader_cmd::get_loader_versions,
        config_cmd::get_base_directory,
        config_cmd::set_base_directory,
        config_cmd::rename_base_directory,
        config_cmd::migrate_base_directory,
        settings_cmd::get_settings,
        settings_cmd::save_settings,
        system_cmd::get_system_fonts,
        settings_cmd::import_background_image,
        settings_cmd::delete_background_image,
        settings_cmd::list_background_panoramas,
        settings_cmd::get_keybindings,
        settings_cmd::save_keybindings,
        system_cmd::check_steam_deck,
        runtime_cmd::get_system_memory,
        runtime_cmd::validate_java_cache,
        runtime_cmd::scan_java_environments,
        runtime_cmd::test_java_runtime,
        runtime_cmd::get_required_java_major,
        runtime_cmd::resolve_global_java_for_version,
        runtime_cmd::resolve_instance_java,
        runtime_cmd::get_instance_runtime,
        runtime_cmd::save_instance_runtime,
        instance::action_cmd::rename_instance,
        instance::action_cmd::change_instance_cover,
        instance::action_cmd::change_instance_herologo,
        instance::action_cmd::delete_instance,
        instance::action_cmd::remove_imported_instances,
        instance::action_cmd::clean_logs,
        instance::action_cmd::get_instance_detail,
        instance::action_cmd::check_instance_gamepad,
        instance::action_cmd::check_gamepad_mod_status,
        instance::action_cmd::install_remote_mod,
        instance::action_cmd::update_instance_custom_buttons,
        instance::mod_cmd::get_instance_mods,
        instance::mod_cmd::create_mod_snapshot,
        instance::mod_cmd::rollback_mod_snapshot,
        instance::mod_cmd::update_mod_cache,
        instance::mod_cmd::open_mod_folder,
        instance::resource_cmd::list_resources,
        instance::resource_cmd::toggle_resource,
        instance::resource_cmd::delete_resource,
        instance::resource_cmd::create_resource_snapshot,
        instance::resource_cmd::update_mod_manifest,
        instance::save_cmd::get_saves,
        instance::save_cmd::backup_save,
        instance::save_cmd::delete_save,
        instance::save_cmd::delete_save_backup,
        instance::save_cmd::verify_save_restore,
        instance::save_cmd::restore_save_backup,
        instance::save_cmd::get_save_backups,
        instance::resource_cmd::open_resource_folder,
        instance::resource_cmd::extract_resourcepack_icon,
        instance::listing_cmd::get_compatible_instances,
        instance::listing_cmd::get_instance_screenshots,
        instance::listing_cmd::open_instance_folder,
        instance::listing_cmd::get_instance_herologo,
        instance::save_cmd::open_saves_folder,
        resource_cmd::get_ore_project_detail,
        resource_cmd::get_ore_project_versions,
        resource_cmd::download_resource,
        launcher_cmd::launch_game,
        launcher_cmd::kill_current_game,
        launcher_cmd::export_diagnostics,
        system_cmd::get_primary_monitor_resolution,
        system_cmd::check_steam_status,
        system_cmd::check_steamos_gamepad_mode,
        system_cmd::register_steam_shortcut,
        auth_cmd::request_microsoft_device_code,
        auth_cmd::poll_and_exchange_microsoft_token,
        auth_cmd::generate_offline_uuid,
        auth_cmd::upload_offline_skin,
        auth_cmd::fetch_offline_skin_from_mojang,
        auth_cmd::delete_offline_account_dir,
        modpack_cmd::parse_modpack_metadata,
        modpack_cmd::import_modpack,
        modpack_cmd::download_and_import_modpack,
        modpack_cmd::import_local_instances_folders,
        modpack_cmd::scan_instances_in_dir,
        modpack_cmd::import_third_party_instance,
        modpack_cmd::download_missing_runtimes,
        modpack_cmd::export_modpack,
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
        lan_cmd::remove_trusted_device,
        lan_cmd::verify_trusted_devices,
        network_cmd::run_network_test,
        qrcode_cmd::generate_device_auth_qr,
        update_cmd::check_update,
        update_cmd::install_update,
        library_cmd::get_starred_items,
        library_cmd::save_starred_item,
        library_cmd::remove_starred_item,
        library_cmd::get_collections,
        library_cmd::save_collection,
        library_cmd::remove_collection,
        library_cmd::get_collection_items,
        library_cmd::save_collection_item,
        library_cmd::remove_collection_item,
    ])
}
