// src-tauri/src/commands/mod.rs

pub mod animation_cmd;
pub mod instance;
pub mod minecraft_cmd;
pub mod loader_cmd;
pub mod config_cmd;
pub mod settings_cmd;
pub mod system_cmd;
pub mod runtime_cmd;



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
    ])
}