// src-tauri/src/services/launcher/mod.rs
pub mod auth;
pub mod builder;
pub mod resolver;

use std::path::PathBuf;
use std::process::Stdio;
use tauri::{AppHandle, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::{AccountPayload, LoaderType};
use crate::error::AppResult;

use auth::AuthService;
use builder::LaunchCommandBuilder;
use resolver::ConfigResolver;

pub struct LauncherService;

impl LauncherService {
    pub async fn launch_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        account: AccountPayload,
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
        let auth_session = AuthService::build_session(account);

        let loader_type = match instance_cfg.loader.r#type.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "forge" => LoaderType::Forge,
            "neoforge" => LoaderType::NeoForge,
            _ => LoaderType::Vanilla,
        };

        let builder = LaunchCommandBuilder::new(
            resolved_config.clone(),
            auth_session,
            loader_type,
            &instance_cfg.mc_version,
            instance_dir.clone(),
            runtime_dir,
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

        let mut child = Command::new(&actual_java_path)
            .args(args)
            .current_dir(&instance_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
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

        // ✅ 核心修复：独立开启两个线程死守日志流，进程不彻底关闭，它们绝对不退出
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                println!("[Game INFO] {}", line);
            }
        });

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                eprintln!("[Game ERROR] {}", line);
            }
        });

        // 阻塞等待进程退出
        let status = child.wait().await.map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("等待进程时发生错误: {}", e))
        })?;
        
        println!("🛑 游戏进程已退出，状态: {}", status);

        Ok(())
    }
}