// src-tauri/src/services/launcher/mod.rs
pub mod auth;
pub mod builder;
pub mod resolver;

use std::path::PathBuf;
use std::process::Stdio;
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

        // ✅ 拦截第三方实例外接路径，注入游戏运行池
        let mut game_dir = instance_dir.clone();
        if let Some(third_party) = &instance_cfg.third_party_path {
            game_dir = PathBuf::from(third_party);
        }

        let resolved_config = ConfigResolver::resolve(app, &instance_cfg);

        let auth_session = AuthService::build_session(account, &runtime_dir);

        let loader_type = match instance_cfg.loader.r#type.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "forge" => LoaderType::Forge,
            "neoforge" => LoaderType::NeoForge,
            "quilt" => LoaderType::Quilt,
            _ => LoaderType::Vanilla,
        };

        // ✅ 核心修复 1：摒弃危险的遍历扫描，采用绝对精确的硬拼接方案
        let target_version_id = match loader_type {
            LoaderType::Vanilla => instance_cfg.mc_version.clone(),
            LoaderType::Fabric => format!(
                "fabric-loader-{}-{}",
                instance_cfg.loader.version, instance_cfg.mc_version
            ),
            LoaderType::Forge => format!(
                "{}-forge-{}",
                instance_cfg.mc_version, instance_cfg.loader.version
            ),
            LoaderType::NeoForge => format!("neoforge-{}", instance_cfg.loader.version),
            LoaderType::Quilt => format!(
                "quilt-loader-{}-{}",
                instance_cfg.loader.version, instance_cfg.mc_version
            ),
        };

        let builder = LaunchCommandBuilder::new(
            resolved_config.clone(),
            auth_session,
            &instance_cfg.mc_version,
            &target_version_id,
            game_dir.clone(),
            runtime_dir.clone(),
        );

        // ✅ 核心修复 2：在生成参数前，必须先解压跨平台的原生库！
        if let Err(e) = builder.extract_natives() {
            eprintln!(
                "[Game WARNING] 解压 Natives 失败，游戏可能闪退或没有声音: {}",
                e
            );
        }

        let args = builder.build_args();

        let actual_java_path =
            if resolved_config.java_path == "auto" || resolved_config.java_path.is_empty() {
                crate::services::runtime_service::launcher_default_java_command().to_string()
            } else {
                resolved_config.java_path.clone()
            };

        let args_clone = args.clone();

        println!("==================================================");
        println!("🚀 准备执行游戏进程！");
        println!("🔧 实例名称: {}", instance_cfg.name);
        println!(
            "👤 玩家 ID: {}",
            args_clone
                .iter()
                .skip_while(|&x| x != "--username")
                .nth(1)
                .unwrap_or(&"Unknown".to_string())
        );
        println!("==================================================");

        // ✅ 核心修复 3：跨平台安全的命令构建方式
        let mut cmd = Command::new(&actual_java_path);
        cmd.args(args)
            .current_dir(&game_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // 仅在 Windows 编译时追加隐藏黑框的特性，保障 Mac/Linux 正常编译
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        let mut child = cmd.spawn().map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("无法启动 Java 进程，请检查环境变量: {}", e),
            )
        })?;

        if let Some(pid) = child.id() {
            crate::commands::launcher_cmd::CURRENT_GAME_PID
                .store(pid, std::sync::atomic::Ordering::SeqCst);
        }

        println!("✅ Java 进程已成功启动，PID: {:?}", child.id());
        println!("💻 完整启动命令已隐藏（防止 Token 泄露）");
        // 如果你需要调试完整的参数，可以解除下面这行的注释，但千万别在生产环境打印，否则用户的 Token 会写进日志！
        // println!("\"{}\" \"{}\"", actual_java_path, args_clone.join("\" \""));
        println!("==================================================");

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        // 使用按字节读取 + Lossy 容错解析，避免乱码导致进程监控崩溃
        let app_out = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                println!("[Game INFO] {}", line);
                let _ = app_out.emit("game-log", line);
                buf.clear();
            }
        });

        let app_err = app.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                eprintln!("[Game ERROR] {}", line);
                let _ = app_err.emit("game-log", line);
                buf.clear();
            }
        });

        let status = child.wait().await.map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("等待进程时发生错误: {}", e),
            )
        })?;

        println!("🛑 游戏进程已退出，状态: {}", status);

        let code = status.code().unwrap_or(1);
        let _ = app.emit("game-exit", serde_json::json!({ "code": code }));

        Ok(())
    }
}
