pub mod animation; // ✅ 新增 animation 模块
pub mod auth; // 解耦后的认证模块 (原 auth_service.rs)
pub mod config; // ✅ 新增 config 模块
pub mod db;
pub mod deferred_startup;
pub mod deployment_cancel;
pub mod downloader; // ✅ 新增 downloader 模块
pub mod file_write_lock; // 按路径串行化写入，避免并发写同一文件
pub mod gamepad;
pub mod import;
pub mod instance; // ✅ 新增 instance 模块
pub mod lan;
pub mod launcher; // ✅ 新增 launcher 模块
pub mod library;
pub mod loader; // ✅ 新增 loader 模块
pub mod logshare_history;
pub mod logshare;
pub mod minecraft; // ✅ 新增 minecraft 模块
pub mod modpack; // ✅ 新增 modpack 模块
pub mod playtime;
pub mod qrcode;
pub mod resource; // ✅ 新增 resource 模块
pub mod runtime; // ✅ 新增 launcher 模块
pub mod social;
pub mod telemetry;
pub mod terracotta;
pub mod webdav_sync;
pub mod wiki; // ✅ 新增 wiki URL 解析模块
