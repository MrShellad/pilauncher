// src-tauri/src/services/launcher/mod.rs
pub mod auth;
pub mod builder;
pub mod resolver;

use std::path::PathBuf;
use std::process::Stdio;
// ✅ 核心修改 1：引入 Emitter 模块，赋予发送事件给前端的能力
use tauri::{AppHandle, Emitter, Runtime}; 
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::{Account, LoaderType};
use crate::error::AppResult;

use auth::AuthService;
use builder::LaunchCommandBuilder;
use resolver::ConfigResolver;

pub struct LauncherService;

impl LauncherService {
    pub async fn launch_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        account: Account, 
    ) -> AppResult<()> {
        let base_path = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未配置数据目录"))?;
        
        let base_dir = PathBuf::from(base_path);
        let instance_dir = base_dir.join("instances").join(instance_id);
        let runtime_dir = base_dir.join("runtime"); 
        
        let config_path = instance_dir.join("instance.json");

        let content = std::fs::read_to_string(&config_path)?;
        let instance_cfg: InstanceConfig = serde_json::from_str(&content)?;

        let resolved_config = ConfigResolver::resolve(app, &instance_cfg);
        
        let auth_session = AuthService::build_session(account, &runtime_dir);

        let loader_type = match instance_cfg.loader.r#type.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "forge" => LoaderType::Forge,
            "neoforge" => LoaderType::NeoForge,
            _ => LoaderType::Vanilla,
        };

        let target_version_id = match loader_type {
            LoaderType::Vanilla => instance_cfg.mc_version.clone(),
            LoaderType::Fabric => format!("fabric-loader-{}-{}", instance_cfg.loader.version, instance_cfg.mc_version),
            LoaderType::Forge | LoaderType::NeoForge => {
                let keyword = if loader_type == LoaderType::Forge { "forge" } else { "neoforge" };
                let mut found_id = format!("{}-{}-{}", instance_cfg.mc_version, keyword, instance_cfg.loader.version); 
                
                if let Ok(entries) = std::fs::read_dir(runtime_dir.join("versions")) {
                    for entry in entries.flatten() {
                        if let Ok(name) = entry.file_name().into_string() {
                            if name.contains(keyword) && name.contains(&instance_cfg.loader.version) {
                                found_id = name;
                                break;
                            }
                        }
                    }
                }
                found_id
            }
        };

        let builder = LaunchCommandBuilder::new(
            resolved_config.clone(),
            auth_session,
            &instance_cfg.mc_version,
            &target_version_id, 
            instance_dir.clone(),
            runtime_dir.clone(),
        );
        
        let args = builder.build_args();
        let actual_java_path = if resolved_config.java_path == "auto" || resolved_config.java_path.is_empty() {
            "java".to_string()
        } else {
            resolved_config.java_path.clone()
        };

        let args_clone = args.clone();
        let java_path_clone = actual_java_path.clone();

        println!("==================================================");
        println!("🚀 准备执行游戏进程！");
        println!("🔧 实例名称: {}", instance_cfg.name);
        println!("👤 玩家 ID: {}", builder.build_args().iter().skip_while(|&x| x != "--username").nth(1).unwrap_or(&"Unknown".to_string()));
        println!("==================================================");

        // 如果在 Windows 下不想弹出原生的黑框，可以解开这句注释：
        // #[cfg(target_os = "windows")]
        // use std::os::windows::process::CommandExt;

        let mut child = Command::new(&actual_java_path)
            .args(args)
            .current_dir(&instance_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            // .creation_flags(0x08000000) // Windows 隐藏黑框
            .spawn()
            .map_err(|e| {
                std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("无法启动 Java 进程，请检查环境变量: {}", e),
                )
            })?;

        println!("✅ Java 进程已成功启动，PID: {:?}", child.id());
        println!("💻 完整启动命令:\n\"{}\" \"{}\"", java_path_clone, args_clone.join("\" \""));
        println!("==================================================");

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        // ✅ 终极修复：使用按字节读取 + Lossy 容错解析，彻底解决碰到中文路径/GBK乱码时线程直接崩溃退出的惨案！
        let app_out = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            // 一直读到换行符 (\n)
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 { break; } // EOF (进程结束)
                // 使用容错模式将字节转换为字符串，去掉末尾的回车换行
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                println!("[Game INFO] {}", line);
                let _ = app_out.emit("game-log", line);
                buf.clear(); // 别忘了清空缓冲区给下一行用
            }
        });

        let app_err = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 { break; }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                eprintln!("[Game ERROR] {}", line);
                let _ = app_err.emit("game-log", line);
                buf.clear();
            }
        });

        let status = child.wait().await.map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("等待进程时发生错误: {}", e))
        })?;
        
        println!("🛑 游戏进程已退出，状态: {}", status);
        
        let code = status.code().unwrap_or(1);
        let _ = app.emit("game-exit", serde_json::json!({ "code": code }));

        Ok(())
    }
}