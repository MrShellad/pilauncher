// src-tauri/src/commands/mod.rs

pub mod animation_cmd;
pub mod instance;
pub mod minecraft_cmd;
pub mod loader_cmd;
pub mod config_cmd;
pub mod settings_cmd;
pub mod system_cmd;
pub mod runtime_cmd;
pub mod resource_cmd;

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
        instance::listing_cmd::get_compatible_instances, // 新增的兼容性实例筛选命令
        resource_cmd::get_ore_project_detail,
        resource_cmd::get_ore_project_versions,
        resource_cmd::download_resource,
    ])
}