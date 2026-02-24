// /src-tauri/src/lib.rs

// 1. 声明顶级模块。这些模块通过各自文件夹下的 mod.rs 进一步拆分。
pub mod commands; // 包含 listing_cmd, creation_cmd 等
pub mod domain;   // 包含数据结构（InstanceItem, CreateInstanceRequest）
pub mod error;    // 统一错误处理
pub mod services; // 核心业务逻辑（创建、扫描、管理服务）

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();
    
    // 2. 挂载所有模块化的 IPC Commands
    // 我们在 commands/mod.rs 中定义 register 函数，
    // 将分属于不同文件的 create_instance, get_instance_list 等命令统一注册。
    builder = commands::register(builder);

    builder
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 可以在此处初始化全局状态，例如全局配置管理
            // app.manage(GlobalConfig::default());
            
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        // 3. 运行逻辑
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}