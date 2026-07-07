pub mod auth;
pub mod builder;
pub mod pre_launch_check;
pub mod resolver;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::{Account, AccountType, LoaderType};
use crate::error::{AppError, AppResult};
use crate::services::minecraft_service::{
    normalize_loader_version_token, parse_third_party_json, resolve_loader_folder,
};
use crate::services::playtime::PlaytimeService;

use auth::AuthService;
use builder::{LaunchCommandBuilder, LaunchPreparationError};
use resolver::ConfigResolver;

pub struct LauncherService;

#[derive(serde::Deserialize)]
struct AuthlibInjectorArtifact {
    download_url: String,
}

async fn ensure_authlib_injector(runtime_dir: &Path) -> Result<PathBuf, String> {
    let tools_dir = runtime_dir.join("tools");
    let jar_path = tools_dir.join("authlib-injector.jar");
    if jar_path.exists() {
        if jar_path
            .metadata()
            .map(|meta| meta.len() > 0)
            .unwrap_or(false)
        {
            return Ok(jar_path);
        }
    }

    tokio::fs::create_dir_all(&tools_dir)
        .await
        .map_err(|error| format!("创建 authlib-injector 缓存目录失败: {}", error))?;

    let client = reqwest::Client::builder()
        .user_agent("PiLauncher")
        .build()
        .map_err(|error| format!("初始化 authlib-injector 下载器失败: {}", error))?;
    let metadata_urls = [
        "https://authlib-injector.yushi.moe/artifact/latest.json",
        "https://bmclapi2.bangbang93.com/mirrors/authlib-injector/artifact/latest.json",
    ];

    let mut last_error = None;
    for metadata_url in metadata_urls {
        let artifact = match client.get(metadata_url).send().await {
            Ok(response) => match response.error_for_status() {
                Ok(response) => match response.json::<AuthlibInjectorArtifact>().await {
                    Ok(artifact) => artifact,
                    Err(error) => {
                        last_error = Some(format!("解析 authlib-injector 元数据失败: {}", error));
                        continue;
                    }
                },
                Err(error) => {
                    last_error = Some(format!("请求 authlib-injector 元数据失败: {}", error));
                    continue;
                }
            },
            Err(error) => {
                last_error = Some(format!("连接 authlib-injector 元数据源失败: {}", error));
                continue;
            }
        };

        let download_url = match reqwest::Url::parse(&artifact.download_url).or_else(|_| {
            reqwest::Url::parse(metadata_url)
                .and_then(|base_url| base_url.join(&artifact.download_url))
        }) {
            Ok(url) => url,
            Err(error) => {
                last_error = Some(format!("解析 authlib-injector 下载地址失败: {}", error));
                continue;
            }
        };

        match client.get(download_url).send().await {
            Ok(response) => match response.error_for_status() {
                Ok(response) => match response.bytes().await {
                    Ok(bytes) => {
                        let tmp_path = jar_path.with_extension("jar.tmp");
                        if let Err(error) = tokio::fs::write(&tmp_path, &bytes).await {
                            last_error =
                                Some(format!("写入 authlib-injector 临时文件失败: {}", error));
                            continue;
                        }
                        if let Err(error) = tokio::fs::rename(&tmp_path, &jar_path).await {
                            let _ = tokio::fs::remove_file(&tmp_path).await;
                            last_error = Some(format!("保存 authlib-injector 文件失败: {}", error));
                            continue;
                        }
                        return Ok(jar_path);
                    }
                    Err(error) => {
                        last_error = Some(format!("读取 authlib-injector 下载内容失败: {}", error));
                    }
                },
                Err(error) => {
                    last_error = Some(format!("下载 authlib-injector 失败: {}", error));
                }
            },
            Err(error) => {
                last_error = Some(format!("连接 authlib-injector 下载地址失败: {}", error));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "下载 authlib-injector 失败".to_string()))
}

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

fn patch_options_txt(game_dir: &Path, fullscreen: bool) {
    let options_path = game_dir.join("options.txt");
    if !options_path.exists() {
        return;
    }

    if let Ok(content) = std::fs::read_to_string(&options_path) {
        let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();
        let mut modified = false;
        let mut found = false;

        let target_value = if fullscreen {
            "fullscreen:true"
        } else {
            "fullscreen:false"
        };

        for line in &mut lines {
            if line.starts_with("fullscreen:") {
                found = true;
                if line != target_value {
                    *line = target_value.to_string();
                    modified = true;
                }
                break;
            }
        }

        // 如果文件中没有该配置，我们也可以选择追加，但保守起见仅修改已存在的配置
        // 以免干扰极早期不包含此配置的 MC 版本
        if !found && fullscreen {
            // 如果用户明确要求全屏，且原本没有，我们可以追加
            lines.push(target_value.to_string());
            modified = true;
        } else if !found && !fullscreen {
            // 如果用户要求窗口化，且原本没有，同样追加
            lines.push(target_value.to_string());
            modified = true;
        }

        if modified {
            let new_content = lines.join("\n") + "\n";
            let _ = std::fs::write(&options_path, new_content);
            println!(
                "[Launcher] Patched options.txt fullscreen setting to: {}",
                fullscreen
            );
        }
    }
}

fn read_version_json_from_dir(version_dir: &Path) -> Option<(String, serde_json::Value)> {
    let version_id = version_dir.file_name()?.to_str()?.to_string();
    let json_path = version_dir.join(format!("{}.json", version_id));
    let content = std::fs::read_to_string(json_path).ok()?;
    let json = serde_json::from_str(&content).ok()?;
    Some((version_id, json))
}

fn collect_version_dirs_from_root(root: &Path) -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    if read_version_json_from_dir(root).is_some() {
        dirs.push(root.to_path_buf());
    }

    let versions_dir = if root.file_name().and_then(|name| name.to_str()) == Some("versions") {
        root.to_path_buf()
    } else {
        root.join("versions")
    };

    if let Ok(entries) = std::fs::read_dir(&versions_dir) {
        dirs.extend(
            entries
                .filter_map(Result::ok)
                .map(|entry| entry.path())
                .filter(|path| path.is_dir()),
        );
    }

    dirs.sort();
    dirs.dedup();
    dirs
}

fn loader_metadata_matches(
    requested_mc: &str,
    requested_loader_type: &str,
    requested_loader_version: &str,
    discovered_mc: &str,
    discovered_loader_type: &str,
    discovered_loader_version: &str,
) -> bool {
    let requested_loader_version = normalize_loader_version_token(
        requested_loader_type,
        requested_mc,
        requested_loader_version,
    );
    let discovered_loader_version = normalize_loader_version_token(
        discovered_loader_type,
        discovered_mc,
        discovered_loader_version,
    );

    discovered_mc == requested_mc
        && discovered_loader_type.eq_ignore_ascii_case(requested_loader_type)
        && discovered_loader_version == requested_loader_version
}

fn discover_launch_version_from_metadata(
    runtime_dir: &Path,
    third_party_root: Option<&Path>,
    config: &InstanceConfig,
) -> Option<String> {
    let requested_loader_type = config.loader.r#type.trim();
    let requested_loader_version = config.loader.version.trim();
    if requested_loader_type.is_empty()
        || requested_loader_type.eq_ignore_ascii_case("vanilla")
        || requested_loader_version.is_empty()
    {
        return Some(config.mc_version.clone());
    }

    for root in third_party_root
        .into_iter()
        .chain(std::iter::once(runtime_dir))
    {
        for version_dir in collect_version_dirs_from_root(root) {
            let Some((version_id, json)) = read_version_json_from_dir(&version_dir) else {
                continue;
            };
            let (mc_version, loader_type, loader_version) =
                parse_third_party_json(&version_id, &json);
            if loader_metadata_matches(
                &config.mc_version,
                requested_loader_type,
                requested_loader_version,
                &mc_version,
                &loader_type,
                &loader_version,
            ) {
                return Some(version_id);
            }
        }
    }

    resolve_loader_folder(
        requested_loader_type,
        &config.mc_version,
        requested_loader_version,
    )
}

impl LauncherService {
    pub async fn launch_instance<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        account: Account,
        pre_launch_check_enabled: Option<bool>,
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

        let should_pre_launch_check = pre_launch_check_enabled.unwrap_or_else(|| {
            crate::services::config_service::ConfigService::get_game_settings(app).pre_launch_check
        });
        if should_pre_launch_check {
            pre_launch_check::PreLaunchCheckService::ensure_passed(app, instance_id).await?;
        } else {
            let message = "[INFO] 启动前检查已在设置中关闭，跳过。".to_string();
            println!("[PreLaunchCheck] {}", message);
            let _ = app.emit("game-log", message);
        }

        let mut game_dir = instance_dir.clone();
        if let Some(third_party) = &instance_cfg.third_party_path {
            game_dir = PathBuf::from(third_party);
        }

        let resolved_config = ConfigResolver::resolve(app, &instance_cfg);

        // 🌟 核心修复：同步修改游戏目录下的 options.txt，防止游戏内历史设置覆盖启动器设置
        patch_options_txt(&game_dir, resolved_config.fullscreen);
        let is_authlib_account = account.account_type == AccountType::Authlib;
        let mut auth_session = AuthService::build_session(account, &runtime_dir);
        if is_authlib_account {
            if auth_session
                .authlib_api_root
                .as_ref()
                .map(|value| value.trim().is_empty())
                .unwrap_or(true)
            {
                return Err(AppError::Generic(
                    "第三方皮肤站账号缺少 API 地址，请重新登录该账号".to_string(),
                ));
            }

            let injector_jar = ensure_authlib_injector(&runtime_dir)
                .await
                .map_err(AppError::Generic)?;
            auth_session.authlib_injector_jar = Some(injector_jar.to_string_lossy().to_string());
        }

        let loader_type = match instance_cfg.loader.r#type.to_lowercase().as_str() {
            "fabric" => LoaderType::Fabric,
            "forge" => LoaderType::Forge,
            "neoforge" => LoaderType::NeoForge,
            "quilt" => LoaderType::Quilt,
            _ => LoaderType::Vanilla,
        };

        let mut third_party_root = None;
        if let Some(tp_path) = &instance_cfg.third_party_path {
            let tp_pathbuf = PathBuf::from(tp_path);
            if tp_pathbuf.exists() {
                third_party_root = Some(tp_pathbuf);
            }
        }

        let target_version_id = discover_launch_version_from_metadata(
            &runtime_dir,
            third_party_root.as_deref(),
            &instance_cfg,
        )
        .unwrap_or_else(|| match loader_type {
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
        });

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
        let pool = app
            .state::<crate::services::db_service::AppDatabase>()
            .pool
            .clone();
        if let Err(e) =
            PlaytimeService::start_session(app, &pool, instance_id, &instance_cfg.name).await
        {
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
        let pool = app
            .state::<crate::services::db_service::AppDatabase>()
            .pool
            .clone();
        if let Err(e) = PlaytimeService::finish_session(app, &pool, instance_id).await {
            eprintln!("[Playtime] Failed to finish session: {}", e);
        }
        crate::commands::launcher_cmd::CURRENT_GAME_PID
            .store(0, std::sync::atomic::Ordering::SeqCst);

        let exit_msg = format!("游戏进程已退出，状态: {}", status);
        println!("{}", exit_msg);
        let _ = app.emit("game-log", exit_msg.clone());
        append_log_line(&log_path, &exit_msg);

        let code = status.code().unwrap_or(1);
        let _ = app.emit(
            "game-exit",
            serde_json::json!({ "code": code, "instanceId": instance_id }),
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::instance::{JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig};

    fn test_instance_config(loader_type: &str, loader_version: &str) -> InstanceConfig {
        InstanceConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            mc_version: "1.20.1".to_string(),
            loader: LoaderConfig {
                r#type: loader_type.to_string(),
                version: loader_version.to_string(),
            },
            java: JavaConfig {
                path: "auto".to_string(),
                version: String::new(),
            },
            memory: MemoryConfig {
                min: 1024,
                max: 2048,
            },
            resolution: ResolutionConfig {
                width: 1280,
                height: 720,
            },
            play_time: 0.0,
            last_played: String::new(),
            created_at: String::new(),
            cover_image: None,
            hero_logo: None,
            gamepad: None,
            custom_buttons: None,
            third_party_path: None,
            server_binding: None,
            auto_join_server: None,
            tags: None,
            jvm_args: None,
            window_width: None,
            window_height: None,
            is_favorite: None,
            global_metadata_settings: None,
            modpack_id: None,
            modpack_uuid: None,
            modpack_version: None,
            modpack_source: None,
        }
    }

    fn unique_test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pilauncher-launcher-service-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    #[test]
    fn discover_launch_version_prefers_installed_metadata_over_folder_formula() {
        let root = unique_test_root("metadata-profile");
        let runtime_dir = root.join("runtime");
        let profile_id = "fabric-custom-profile";
        let profile_dir = runtime_dir.join("versions").join(profile_id);
        std::fs::create_dir_all(&profile_dir).unwrap();
        std::fs::write(
            profile_dir.join(format!("{}.json", profile_id)),
            serde_json::to_string(&serde_json::json!({
                "id": profile_id,
                "inheritsFrom": "1.20.1",
                "mainClass": "net.fabricmc.loader.impl.launch.knot.KnotClient",
                "libraries": [
                    { "name": "net.fabricmc:fabric-loader:0.16.10" },
                    { "name": "net.fabricmc:intermediary:1.20.1" }
                ]
            }))
            .unwrap(),
        )
        .unwrap();

        let config = test_instance_config("fabric", "0.16.10");
        assert_eq!(
            discover_launch_version_from_metadata(&runtime_dir, None, &config),
            Some(profile_id.to_string())
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn discover_launch_version_falls_back_to_known_loader_folder() {
        let root = unique_test_root("metadata-fallback");
        let config = test_instance_config("forge", "47.4.18");

        assert_eq!(
            discover_launch_version_from_metadata(&root.join("runtime"), None, &config),
            Some("1.20.1-forge-47.4.18".to_string())
        );

        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn discover_launch_version_matches_normalized_loader_versions() {
        let root = unique_test_root("metadata-normalized-loader");
        let runtime_dir = root.join("runtime");
        let profile_id = "neoforge-21.1.224";
        let profile_dir = runtime_dir.join("versions").join(profile_id);
        std::fs::create_dir_all(&profile_dir).unwrap();
        std::fs::write(
            profile_dir.join(format!("{}.json", profile_id)),
            serde_json::to_string(&serde_json::json!({
                "id": profile_id,
                "inheritsFrom": "1.20.1",
                "arguments": {
                    "game": [
                        "--fml.mcVersion", "1.20.1",
                        "--fml.neoForgeVersion", "21.1.224"
                    ]
                },
                "libraries": [
                    { "name": "net.neoforged:neoforge:21.1.224" }
                ]
            }))
            .unwrap(),
        )
        .unwrap();

        let config = test_instance_config("neoforge", "neoforge-21.1.224");
        assert_eq!(
            discover_launch_version_from_metadata(&runtime_dir, None, &config),
            Some(profile_id.to_string())
        );

        let _ = std::fs::remove_dir_all(root);
    }
}
