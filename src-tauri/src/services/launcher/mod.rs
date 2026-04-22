pub mod auth;
pub mod builder;
pub mod resolver;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::{Account, LoaderType};
use crate::error::{AppError, AppResult};
use crate::services::playtime::PlaytimeService;

use auth::AuthService;
use builder::{LaunchCommandBuilder, LaunchPreparationError};
use resolver::ConfigResolver;

pub struct LauncherService;

fn append_log_line(log_path: &Path, line: &str) {
    if let Ok(mut file) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "{}", line);
    }
}

fn log_launch_preparation_error<R: Runtime>(
    app: &AppHandle<R>,
    log_path: &Path,
    error: &LaunchPreparationError,
) {
    for line in error.diagnostic_lines() {
        println!("{}", line);
        let _ = app.emit("game-log", line.clone());
        append_log_line(log_path, &line);
    }
}

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
        let log_dir = base_dir.join("logs");
        if !log_dir.exists() {
            let _ = std::fs::create_dir_all(&log_dir);
        }
        let log_path = log_dir.join("launcher_log.txt");

        let config_path = instance_dir.join("instance.json");
        let content = std::fs::read_to_string(&config_path)?;
        let instance_cfg: InstanceConfig = serde_json::from_str(&content)?;

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

        let mut third_party_root = None;
        if let Some(tp_path) = &instance_cfg.third_party_path {
            let tp_pathbuf = PathBuf::from(tp_path);
            if tp_pathbuf.exists() {
                third_party_root = Some(tp_pathbuf);
            }
        }

        let builder = LaunchCommandBuilder::new(
            resolved_config.clone(),
            auth_session,
            &instance_cfg.mc_version,
            &target_version_id,
            game_dir.clone(),
            runtime_dir.clone(),
            third_party_root,
        );

        let args = match builder.build_args() {
            Ok(args) => args,
            Err(error) => {
                log_launch_preparation_error(app, &log_path, &error);
                return Err(AppError::Generic(error.user_message().to_string()));
            }
        };

        if let Err(error) = builder.extract_natives() {
            log_launch_preparation_error(app, &log_path, &error);
            return Err(AppError::Generic(error.user_message().to_string()));
        }

        let resolved_natives_dir = builder.natives_dir();
        let resolved_assets_dir = builder.assets_dir();
        let resolved_libraries_dir = builder.libraries_dir();

        let actual_java_path =
            if resolved_config.java_path == "auto" || resolved_config.java_path.is_empty() {
                crate::services::runtime_service::launcher_default_java_command().to_string()
            } else {
                resolved_config.java_path.clone()
            };

        let args_clone = args.clone();
        let username_idx = args_clone.iter().position(|arg| arg == "--username");
        let username = username_idx
            .and_then(|index| args_clone.get(index + 1))
            .cloned()
            .unwrap_or_else(|| "Unknown".to_string());

        let token_idx = args_clone.iter().position(|arg| arg == "--accessToken");
        let safe_args: Vec<String> = args_clone
            .iter()
            .enumerate()
            .map(|(index, arg)| {
                if token_idx.map(|token| token + 1 == index).unwrap_or(false) {
                    "********".to_string()
                } else {
                    arg.clone()
                }
            })
            .collect();

        let path_separator = if cfg!(target_os = "windows") {
            ";"
        } else {
            ":"
        };
        let count_path_entries = |value: &str| value.matches(path_separator).count() + 1;
        let cp_pos = safe_args
            .iter()
            .position(|arg| arg == "-cp" || arg == "--class-path");
        let cp_count = cp_pos
            .and_then(|index| safe_args.get(index + 1))
            .map(|value| count_path_entries(value))
            .unwrap_or(0);
        let module_path_count = safe_args
            .iter()
            .enumerate()
            .find_map(|(index, arg)| {
                if arg == "-p" || arg == "--module-path" {
                    safe_args.get(index + 1).cloned()
                } else if let Some(value) = arg.strip_prefix("-p=") {
                    Some(value.to_string())
                } else {
                    arg.strip_prefix("--module-path=")
                        .map(|value| value.to_string())
                }
            })
            .map(|value| count_path_entries(&value))
            .unwrap_or(0);

        let filtered_args: Vec<String> = safe_args
            .iter()
            .filter(|arg| arg.starts_with("-X") || arg.starts_with("-D") || arg.starts_with("--"))
            .cloned()
            .collect();

        let diag_info = format!(
            "==================================================\n\
Launcher Diagnostics\n\
==================================================\n\
OS: {}  Arch: {}\n\
Java Path: {}\n\
Instance: [{}] {}\n\
Player: {}\n\
Version Chain: {} -> {}\n\
Natives Dir: {}\n\
Classpath Entries: {}\n\
Key Args: {:?}\n\
Game Dir: {}\n\
Command:\n\
\"{}\" {}\n\
Assets Root: {}\n\
Libraries Root: {}\n\
Module Path Entries: {}\n\
==================================================",
            std::env::consts::OS,
            std::env::consts::ARCH,
            actual_java_path,
            instance_id,
            instance_cfg.name,
            username,
            instance_cfg.mc_version,
            target_version_id,
            resolved_natives_dir.to_string_lossy(),
            cp_count,
            filtered_args,
            game_dir.to_string_lossy(),
            actual_java_path,
            safe_args
                .iter()
                .map(|arg| format!("\"{}\"", arg))
                .collect::<Vec<_>>()
                .join(" "),
            resolved_assets_dir.to_string_lossy(),
            resolved_libraries_dir.to_string_lossy(),
            module_path_count
        );

        if let Ok(mut file) = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_path)
        {
            let _ = writeln!(file, "{}", diag_info);
        }

        for line in diag_info.lines() {
            println!("[Launcher LOG] {}", line);
            let _ = app.emit("game-log", line.to_string());
        }

        let mut cmd = Command::new(&actual_java_path);
        cmd.args(args)
            .current_dir(&game_dir)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);

        let mut child = match cmd.spawn() {
            Ok(child) => {
                let pid_str = format!("游戏进程创建成功，PID: {:?}", child.id());
                println!("{}", pid_str);
                let _ = app.emit("game-log", pid_str.clone());
                append_log_line(&log_path, &pid_str);
                child
            }
            Err(error) => {
                let err_msg = format!("游戏进程创建失败: {}", error);
                println!("{}", err_msg);
                let _ = app.emit("game-log", err_msg.clone());
                append_log_line(&log_path, &err_msg);
                append_log_line(
                    &log_path,
                    "常见建议: 1. 检查 Java 路径是否正确 2. 检查 java.exe 是否存在 3. 检查权限",
                );
                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!("无法启动 Java 进程，请检查 Java 路径: {}", error),
                )
                .into());
            }
        };

        if let Some(pid) = child.id() {
            crate::commands::launcher_cmd::CURRENT_GAME_PID
                .store(pid, std::sync::atomic::Ordering::SeqCst);
        }

        // 🌟 记录游戏时长：启动会话
        let pool = app.state::<crate::services::db_service::AppDatabase>().pool.clone();
        if let Err(e) = PlaytimeService::start_session(app, &pool, instance_id, &instance_cfg.name).await {
            eprintln!("[Playtime] Failed to start session: {}", e);
        }

        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();

        let app_out = app.clone();
        let log_path_out = log_path.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stdout);
            let mut buf = Vec::new();
            while let Ok(read) = reader.read_until(b'\n', &mut buf).await {
                if read == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                println!("[Game INFO] {}", line);
                let _ = app_out.emit("game-log", line.clone());
                append_log_line(&log_path_out, &format!("[STDOUT] {}", line));
                buf.clear();
            }
        });

        let app_err = app.clone();
        let log_path_err = log_path.clone();
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr);
            let mut buf = Vec::new();
            while let Ok(read) = reader.read_until(b'\n', &mut buf).await {
                if read == 0 {
                    break;
                }
                let line = String::from_utf8_lossy(&buf).trim_end().to_string();
                eprintln!("[Game ERROR] {}", line);
                let _ = app_err.emit("game-log", line.clone());
                append_log_line(&log_path_err, &format!("[STDERR] {}", line));
                buf.clear();
            }
        });

        let status = child.wait().await.map_err(|error| {
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("等待游戏进程时发生错误: {}", error),
            )
        })?;

        // 🌟 记录游戏时长：结束会话并持久化
        let pool = app.state::<crate::services::db_service::AppDatabase>().pool.clone();
        if let Err(e) = PlaytimeService::finish_session(app, &pool, instance_id).await {
            eprintln!("[Playtime] Failed to finish session: {}", e);
        }

        let exit_msg = format!("游戏进程已退出，状态: {}", status);
        println!("{}", exit_msg);
        let _ = app.emit("game-log", exit_msg.clone());
        append_log_line(&log_path, &exit_msg);

        let code = status.code().unwrap_or(1);
        let _ = app.emit("game-exit", serde_json::json!({ "code": code }));

        Ok(())
    }
}
