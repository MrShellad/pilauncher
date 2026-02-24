// src-tauri/src/commands/mod.rs

pub mod animation_cmd;
pub mod instance;
pub mod minecraft_cmd;
pub mod loader_cmd;



use tauri::{Builder, Runtime};

// 【关键检查点】：前面必须有 pub 关键字，这样外部的 lib.rs 才能调用它！
pub fn register<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        animation_cmd::load_custom_animation,
        instance::listing_cmd::get_instance_list,
        instance::creation_cmd::create_instance,
        minecraft_cmd::get_minecraft_versions,
        loader_cmd::get_loader_versions
    ])
}