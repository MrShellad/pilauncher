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
// ✅ 将 AccountPayload 替换为 Account
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
        account: Account, // ✅ 接收新模型
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
        
        // ✅ 核心修改：将 runtime_dir 传给 AuthService 以触发 JSON 落盘
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

        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Ok(Some(line)) = reader.next_line().await { println!("[Game INFO] {}", line); }
        });

        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await { eprintln!("[Game ERROR] {}", line); }
        });

        let status = child.wait().await.map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::Other, format!("等待进程时发生错误: {}", e))
        })?;
        
        println!("🛑 游戏进程已退出，状态: {}", status);
        Ok(())
    }
}