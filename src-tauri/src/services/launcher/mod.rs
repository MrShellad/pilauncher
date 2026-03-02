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
use crate::domain::launcher::LoaderType;
use crate::error::AppResult;

use auth::AuthService;
use builder::LaunchCommandBuilder;
use resolver::ConfigResolver;

pub struct LauncherService;

impl LauncherService {
    pub async fn launch_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        offline_name: &str,
    ) -> AppResult<()> {
        let base_path = crate::services::config_service::ConfigService::get_base_path(app)?
            .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未配置数据目录"))?;

        let instance_dir = PathBuf::from(base_path).join("instances").join(instance_id);
        let config_path = instance_dir.join("instance.json");

        let content = std::fs::read_to_string(&config_path)?;
        let instance_cfg: InstanceConfig = serde_json::from_str(&content)?;

        let resolved_config = ConfigResolver::resolve(&instance_cfg);
        let auth_session = AuthService::generate_offline(offline_name);

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
            instance_dir.to_string_lossy().to_string(),
        );
        let args = builder.build_args();

        // ✅ 处理 "auto" 路径：如果前端传了 auto 或空，则降级使用系统环境变量中的 java
        let mut actual_java_path = resolved_config.java_path.clone();
        if actual_java_path == "auto" || actual_java_path.is_empty() {
            actual_java_path = "java".to_string();
        }

        println!("==================================================");
        println!("🚀 准备执行游戏进程！");
        println!("🔧 执行程序: {}", actual_java_path);
        println!("🔧 实例名称: {}", instance_cfg.name);
        println!("==================================================");

        // 解封：真实的异步非阻塞启动代码
        let mut child = Command::new(&actual_java_path)
            .args(args)
            .current_dir(&instance_dir)
            // 捕获输出，防止 Java 进程的日志污染主进程，也为后续传输给前端控制台做准备
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                // 将 String 重新包装为标准的 std::io::Error
                std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!(
                        "无法启动 Java 进程 (请检查是否安装了 Java 并配置了环境变量): {}",
                        e
                    ),
                )
            })?;

        println!("✅ Java 进程已成功启动，PID: {:?}", child.id());

        // 异步读取 Java 进程的输出并打印到 Rust 控制台
        if let Some(stdout) = child.stdout.take() {
            let mut reader = BufReader::new(stdout).lines();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    println!("[Game] {}", line);
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let mut reader = BufReader::new(stderr).lines();
            tokio::spawn(async move {
                while let Ok(Some(line)) = reader.next_line().await {
                    eprintln!("[Game ERROR] {}", line);
                }
            });
        }

        Ok(())
    }
}
