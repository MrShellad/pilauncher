// 1. 声明所有的顶级模块。这告诉 Rust 编译器去加载这些文件夹中的 mod.rs 或同名 .rs 文件
pub mod commands;
pub mod domain;
pub mod error;
pub mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 2. 初始化 Builder 并声明为可变变量 (mut)
    let mut builder = tauri::Builder::default();

    // 3. 调用我们写好的统一注册函数，挂载所有的 IPC Commands
    builder = commands::register(builder);

    // 4. 继续你原有的 setup 逻辑和运行逻辑
    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}