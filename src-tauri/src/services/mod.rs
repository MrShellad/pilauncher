pub mod animation_service; // ✅ 新增 animation 模块
pub mod auth; // 解耦后的认证模块 (原 auth_service.rs)
pub mod config_service; // ✅ 新增 config 模块
pub mod db_service;
pub mod deployment_cancel;
pub mod downloader; // ✅ 新增 downloader 模块
pub mod file_write_lock; // 按路径串行化写入，避免并发写同一文件
pub mod gamepad_service;
pub mod import_service;
pub mod instance; // ✅ 新增 instance 模块
pub mod lan;
pub mod launcher; // ✅ 新增 launcher 模块
pub mod library_service;
pub mod loader_service; // ✅ 新增 loader 模块
pub mod minecraft_service; // ✅ 新增 minecraft 模块
pub mod modpack_service; // ✅ 新增 modpack 模块
pub mod playtime;
pub mod qrcode_service;
pub mod resource_service; // ✅ 新增 resource 模块
pub mod runtime_service; // ✅ 新增 launcher 模块
pub mod wiki_service; // ✅ 新增 wiki URL 解析模块
