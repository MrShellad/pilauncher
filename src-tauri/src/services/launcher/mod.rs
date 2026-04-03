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

        // --- Added for launcher log : Collect Diagnostic ---
        let username_idx = args_clone.iter().position(|r| r == "--username");
        let username = username_idx
            .and_then(|i| args_clone.get(i + 1))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        let token_idx = args_clone.iter().position(|r| r == "--accessToken");
        let safe_args: Vec<String> = args_clone
            .iter()
            .enumerate()
            .map(|(i, arg)| {
                if token_idx.map(|idx| idx + 1 == i).unwrap_or(false) {
                    "********".to_string()
                } else {
                    arg.clone()
                }
            })
            .collect();

        let cp_pos = safe_args.iter().position(|r| r == "-cp");
        let cp_count = if let Some(i) = cp_pos {
            if let Some(cp_str) = safe_args.get(i + 1) {
                cp_str
                    .matches(if cfg!(target_os = "windows") {
                        ";"
                    } else {
                        ":"
                    })
                    .count()
                    + 1
            } else {
                0
            }
        } else {
            0
        };

        let filtered_args: Vec<String> = safe_args
            .iter()
            .filter(|x| x.starts_with("-X") || x.starts_with("-D") || x.starts_with("--"))
            .cloned()
            .collect();

        let diag_info = format!(
            "==================================================\n\
             🚀 PiLauncher 诊断日志 (Launcher Diagnostics)\n\
             ==================================================\n\
             🖥️ 基础环境: OS={} Arch={}\n\
             ☕ Java 路径: {}\n\
             📦 实例明细: [{}] {}\n\
             🌐 玩家 ID: {}\n\
             🛠️ 版本解析: {} -> {}\n\
             🔧 Natives 存放: {}\n\
             📚 Classpath 概览: 共 {} 项 (核心与依赖库)\n\
             🔑 关键参数: {:?}\n\
             📂 工作目录: {}\n\
             🛡️ 进程保护: 敏感 Token 已隐藏\n\
             =================== 完整启动命令 ===================\n\
             \"{}\" {}\n\
             ==================================================",
            std::env::consts::OS,
            std::env::consts::ARCH,
            actual_java_path,
            instance_id,
            instance_cfg.name,
            username,
            instance_cfg.mc_version,
            target_version_id,
            runtime_dir
                .join("versions")
                .join(&instance_cfg.mc_version)
                .join("natives")
                .to_string_lossy(),
            cp_count,
            filtered_args,
            game_dir.to_string_lossy(),
            actual_java_path,
            safe_args
                .iter()
                .map(|s| format!("\"{}\"", s))
                .collect::<Vec<_>>()
                .join(" ")
        );

        let log_dir = base_dir.join("logs");
        if !log_dir.exists() {
            let _ = std::fs::create_dir_all(&log_dir);
        }
        let log_path = log_dir.join("launcher_log.txt");
        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_path)
        {
            use std::io::Write;
            let _ = writeln!(file, "{}", diag_info);
        }

        // 打印与发送诊断日志
        for line in diag_info.lines() {
            println!("[Launcher LOG] {}", line);
            let _ = app.emit("game-log", line.to_string());
        }

        println!("🚀 准备执行游戏进程！PID will be captured...");
        // --- Diagnostics End ---

        // ✅ 核心修复 3：跨平台安全的命令构建方式
        let mut cmd = Command::new(&actual_java_path);
        cmd.args(args)
            .current_dir(&game_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // 仅在 Windows 编译时追加隐藏黑框的特性，保障 Mac/Linux 正常编译
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        let mut child = match cmd.spawn() {
            Ok(c) => {
                let pid_str = format!("✅ 进程创建成功！PID: {:?}", c.id());
                println!("{}", pid_str);
                let _ = app.emit("game-log", pid_str.clone());
                if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&log_path) {
                    use std::io::Write;
                    let _ = writeln!(file, "{}", pid_str);
                }
                c
            }
            Err(e) => {
                let err_msg = format!("❌ 进程创建失败 (Process Creation Failed): {}", e);
                println!("{}", err_msg);
                let _ = app.emit("game-log", err_msg.clone());
                if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&log_path) {
                    use std::io::Write;
                    let _ = writeln!(file, "{}", err_msg);
                    let _ = writeln!(file, "💡 常见解决建议:\n  1. 检查环境变量中的 PATH 是否缺少 Java。\n  2. 如果填了自定义路径，请确保完整指向 java.exe 且存在。\n  3. 可能没有足够的系统权限。");
                }
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("无法启动 Java 进程，请检查环境变量: {}", e),
                )
                .into());
            }
        };

        if let Some(pid) = child.id() {
            crate::commands::launcher_cmd::CURRENT_GAME_PID
                .store(pid, std::sync::atomic::Ordering::SeqCst);
        }

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        // 使用按字节读取 + Lossy 容错解析，避免乱码导致进程监控崩溃
        let app_out = app.clone();
        let log_path_out = log_path.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                println!("[Game INFO] {}", line);
                let _ = app_out.emit("game-log", line.clone());
                if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&log_path_out) {
                    use std::io::Write;
                    let _ = writeln!(file, "[STDOUT] {}", line);
                }
                buf.clear();
            }
        });

        let app_err = app.clone();
        let log_path_err = log_path.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(n) = reader.read_until(b'\n', &mut buf).await {
                if n == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                eprintln!("[Game ERROR] {}", line);
                let _ = app_err.emit("game-log", line.clone());
                if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&log_path_err) {
                    use std::io::Write;
                    let _ = writeln!(file, "[STDERR] {}", line);
                }
                buf.clear();
            }
        });

        let status = child.wait().await.map_err(|e| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("等待进程时发生错误: {}", e),
            )
        })?;

        let exit_msg = format!("🛑 游戏进程已退出，状态: {}", status);
        println!("{}", exit_msg);
        let _ = app.emit("game-log", exit_msg.clone());
        if let Ok(mut file) = std::fs::OpenOptions::new().append(true).open(&log_path) {
            use std::io::Write;
            let _ = writeln!(file, "{}", exit_msg);
        }

        let code = status.code().unwrap_or(1);
        let _ = app.emit("game-exit", serde_json::json!({ "code": code }));

        Ok(())
    }
}
