use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Emitter, Runtime};

use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::MissingRuntime;
use crate::error::{AppError, AppResult};
use crate::services::config_service::ConfigService;
use crate::services::instance::verify_service;
use crate::services::launcher::resolver::ConfigResolver;
use crate::services::minecraft_service::{get_mc_arch, get_mc_os, resolve_loader_folder};
use crate::services::runtime_service;

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PreLaunchCheckStatus {
    Passed,
    Warning,
    Failed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreLaunchCheckItem {
    pub kind: String,
    pub status: PreLaunchCheckStatus,
    pub message: String,
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreLaunchCheckReport {
    pub instance_id: String,
    pub passed: bool,
    pub checks: Vec<PreLaunchCheckItem>,
    pub repair: Option<MissingRuntime>,
}

pub struct PreLaunchCheckService;

fn emit_check_log<R: Runtime>(app: &AppHandle<R>, line: impl Into<String>) {
    let line = line.into();
    println!("[PreLaunchCheck] {}", line);
    let _ = app.emit("game-log", line);
}

fn read_instance_config(instance_json_path: &Path) -> Result<InstanceConfig, String> {
    let content = std::fs::read_to_string(instance_json_path)
        .map_err(|error| format!("读取实例配置失败: {}", error))?;
    serde_json::from_str(&content).map_err(|error| format!("解析实例配置失败: {}", error))
}

fn load_manifest(path: &Path) -> Result<serde_json::Value, String> {
    let content =
        std::fs::read_to_string(path).map_err(|error| format!("读取版本清单失败: {}", error))?;
    serde_json::from_str(&content).map_err(|error| format!("解析版本清单失败: {}", error))
}

fn host_platform_issue() -> Option<String> {
    let mc_os = get_mc_os();
    if !matches!(mc_os, "windows" | "osx" | "linux") {
        return Some(format!(
            "当前系统 {} 不是 Minecraft Java 常规桌面平台",
            mc_os
        ));
    }

    let mc_arch = get_mc_arch();
    if !matches!(mc_arch, "64" | "32" | "arm64") {
        return Some(format!(
            "当前 CPU 架构 {} 未映射到 Minecraft 原生库架构",
            mc_arch
        ));
    }

    None
}

fn inspect_manifest_platform(
    manifest: &serde_json::Value,
    label: &str,
    details: &mut Vec<String>,
    warnings: &mut Vec<String>,
) {
    let Some(libraries) = manifest["libraries"].as_array() else {
        warnings.push(format!("{} 清单缺少 libraries 字段", label));
        return;
    };

    let current_os = get_mc_os();
    let mut native_libraries = 0usize;

    for library in libraries {
        if !crate::services::minecraft_service::evaluate_library_rules(library["rules"].as_array())
        {
            continue;
        }

        let Some(natives) = library["natives"].as_object() else {
            continue;
        };
        if natives.is_empty() {
            continue;
        }

        native_libraries += 1;
        if !natives.contains_key(current_os) {
            let name = library["name"].as_str().unwrap_or("unknown-library");
            warnings.push(format!(
                "{} 的原生库 {} 没有当前平台 {} 的 classifier",
                label, name, current_os
            ));
        }
    }

    details.push(format!(
        "{} 清单中匹配当前规则的原生库数量: {}",
        label, native_libraries
    ));
}

fn check_platform(runtime_dir: &Path, config: &InstanceConfig) -> PreLaunchCheckItem {
    let mut details = vec![format!(
        "当前平台: os={} arch={} / Minecraft: os={} arch={}",
        std::env::consts::OS,
        std::env::consts::ARCH,
        get_mc_os(),
        get_mc_arch()
    )];
    let mut warnings = Vec::new();

    if let Some(issue) = host_platform_issue() {
        return PreLaunchCheckItem {
            kind: "platform".to_string(),
            status: PreLaunchCheckStatus::Failed,
            message: issue,
            details,
        };
    }

    let core_manifest_path = runtime_dir
        .join("versions")
        .join(&config.mc_version)
        .join(format!("{}.json", config.mc_version));
    if let Ok(manifest) = load_manifest(&core_manifest_path) {
        inspect_manifest_platform(&manifest, "核心版本", &mut details, &mut warnings);
    }

    if let Some(loader_folder) = resolve_loader_folder(
        &config.loader.r#type,
        &config.mc_version,
        &config.loader.version,
    ) {
        let loader_manifest_path = runtime_dir
            .join("versions")
            .join(&loader_folder)
            .join(format!("{}.json", loader_folder));
        if let Ok(manifest) = load_manifest(&loader_manifest_path) {
            inspect_manifest_platform(&manifest, "加载器版本", &mut details, &mut warnings);
        }
    }

    if warnings.is_empty() {
        PreLaunchCheckItem {
            kind: "platform".to_string(),
            status: PreLaunchCheckStatus::Passed,
            message: "当前平台适配检查通过".to_string(),
            details,
        }
    } else {
        PreLaunchCheckItem {
            kind: "platform".to_string(),
            status: PreLaunchCheckStatus::Warning,
            message: "当前平台适配检查存在警告".to_string(),
            details: details.into_iter().chain(warnings).collect(),
        }
    }
}

fn parse_java_major(version: &str) -> Option<u32> {
    let raw = version.trim();
    if raw.is_empty() {
        return None;
    }

    let version_part = raw.split_whitespace().next().unwrap_or(raw);
    let mut numbers = version_part
        .split(|ch: char| !ch.is_ascii_digit())
        .filter(|part| !part.is_empty());

    let first = numbers.next()?.parse::<u32>().ok()?;
    if first == 1 {
        return numbers.next().and_then(|part| part.parse::<u32>().ok());
    }

    Some(first)
}

fn check_java<R: Runtime>(
    app: &AppHandle<R>,
    instance_dir: &Path,
    config: &InstanceConfig,
) -> PreLaunchCheckItem {
    let resolved_config = ConfigResolver::resolve(app, config);
    let instance_runtime =
        runtime_service::get_instance_runtime(instance_dir).unwrap_or_else(|_| {
            crate::domain::runtime::RuntimeConfig {
                use_global_java: true,
                use_global_memory: true,
                java_path: String::new(),
                memory_allocation_mode: crate::domain::runtime::MemoryAllocationMode::Auto,
                max_memory: 4096,
                min_memory: 1024,
                jvm_args: String::new(),
            }
        });
    let java_settings = ConfigService::get_java_settings(app);
    let java_runtime = runtime_service::resolve_instance_java_runtime(
        &instance_runtime,
        &java_settings,
        &config.mc_version,
        runtime_service::launcher_default_java_command(),
    );

    let java_path = if resolved_config.java_path.trim().is_empty()
        || resolved_config.java_path.eq_ignore_ascii_case("auto")
    {
        runtime_service::launcher_default_java_command().to_string()
    } else {
        resolved_config.java_path
    };

    let required_major = java_runtime
        .required_java_major
        .parse::<u32>()
        .unwrap_or_default();

    match runtime_service::test_java_runtime(&java_path) {
        Ok(install) => {
            let detected_major = parse_java_major(&install.version);
            let mut details = vec![
                format!(
                    "Minecraft {} 需要 Java {}",
                    config.mc_version, required_major
                ),
                format!("Java 路径: {}", install.path),
                format!("Java 版本: {}", install.version),
            ];

            let Some(detected_major) = detected_major else {
                return PreLaunchCheckItem {
                    kind: "java".to_string(),
                    status: PreLaunchCheckStatus::Failed,
                    message: "无法识别 Java 主版本".to_string(),
                    details,
                };
            };

            if required_major > 0 && detected_major < required_major {
                return PreLaunchCheckItem {
                    kind: "java".to_string(),
                    status: PreLaunchCheckStatus::Failed,
                    message: format!(
                        "Java 版本过低: 当前 Java {}，需要 Java {}",
                        detected_major, required_major
                    ),
                    details,
                };
            }

            if matches!(std::env::consts::ARCH, "x86_64" | "aarch64")
                && install.version.contains("32-bit")
            {
                details.push("64 位系统上检测到 32 位 Java，可能导致内存不足".to_string());
                return PreLaunchCheckItem {
                    kind: "java".to_string(),
                    status: PreLaunchCheckStatus::Warning,
                    message: "Java 环境可用，但存在位数警告".to_string(),
                    details,
                };
            }

            PreLaunchCheckItem {
                kind: "java".to_string(),
                status: PreLaunchCheckStatus::Passed,
                message: "Java 环境适配检查通过".to_string(),
                details,
            }
        }
        Err(error) => PreLaunchCheckItem {
            kind: "java".to_string(),
            status: PreLaunchCheckStatus::Failed,
            message: "Java 环境不可用".to_string(),
            details: vec![format!("Java 路径: {}", java_path), error],
        },
    }
}

impl PreLaunchCheckService {
    pub async fn run<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> AppResult<PreLaunchCheckReport> {
        emit_check_log(
            app,
            "[INFO] 启动前检查：开始校验实例完整性、平台和 Java 环境。",
        );

        let base_path = ConfigService::get_base_path(app)?
            .ok_or_else(|| AppError::Generic("未配置数据目录".to_string()))?;
        let base_dir = PathBuf::from(base_path);
        let runtime_dir = base_dir.join("runtime");
        let instance_dir = base_dir.join("instances").join(instance_id);
        let instance_json_path = instance_dir.join("instance.json");
        let config = read_instance_config(&instance_json_path).map_err(AppError::Generic)?;

        let mut checks = Vec::new();

        emit_check_log(app, "[INFO] 启动前检查：正在校验游戏运行库完整性...");
        let runtime_check = verify_service::verify_instance_runtime(app, instance_id)
            .await
            .map_err(AppError::Generic)?;
        let runtime_repair = runtime_check.repair.clone();
        if runtime_check.needs_repair {
            checks.push(PreLaunchCheckItem {
                kind: "integrity".to_string(),
                status: PreLaunchCheckStatus::Failed,
                message: "游戏运行库不完整或文件校验失败".to_string(),
                details: runtime_check.issues,
            });
        } else {
            checks.push(PreLaunchCheckItem {
                kind: "integrity".to_string(),
                status: PreLaunchCheckStatus::Passed,
                message: "游戏运行库完整性检查通过".to_string(),
                details: Vec::new(),
            });
        }

        emit_check_log(app, "[INFO] 启动前检查：正在校验当前平台适配...");
        checks.push(check_platform(&runtime_dir, &config));

        emit_check_log(app, "[INFO] 启动前检查：正在校验 Java 环境...");
        checks.push(check_java(app, &instance_dir, &config));

        let passed = checks
            .iter()
            .all(|check| check.status != PreLaunchCheckStatus::Failed);

        for check in &checks {
            let level = match check.status {
                PreLaunchCheckStatus::Passed => "INFO",
                PreLaunchCheckStatus::Warning => "WARN",
                PreLaunchCheckStatus::Failed => "ERROR",
            };
            emit_check_log(app, format!("[{}] {}", level, check.message));
            for detail in check.details.iter().take(6) {
                emit_check_log(app, format!("[{}]   {}", level, detail));
            }
        }

        if passed {
            emit_check_log(app, "[INFO] 启动前检查通过，继续启动游戏。");
        } else {
            emit_check_log(app, "[ERROR] 启动前检查未通过，已阻止游戏启动。");
        }

        Ok(PreLaunchCheckReport {
            instance_id: instance_id.to_string(),
            passed,
            checks,
            repair: runtime_repair,
        })
    }

    pub async fn ensure_passed<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> AppResult<()> {
        let report = Self::run(app, instance_id).await?;
        if report.passed {
            return Ok(());
        }

        let summary = report
            .checks
            .iter()
            .filter(|check| check.status == PreLaunchCheckStatus::Failed)
            .map(|check| check.message.clone())
            .collect::<Vec<_>>()
            .join("；");

        Err(AppError::Generic(if summary.is_empty() {
            "启动前检查未通过".to_string()
        } else {
            format!("启动前检查未通过：{}", summary)
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::{host_platform_issue, parse_java_major};

    #[test]
    fn parses_legacy_java_major() {
        assert_eq!(parse_java_major("1.8.0_402 (64-bit)"), Some(8));
    }

    #[test]
    fn parses_modern_java_major() {
        assert_eq!(parse_java_major("21.0.3 (64-bit)"), Some(21));
        assert_eq!(parse_java_major("25-ea (64-bit)"), Some(25));
    }

    #[test]
    fn rejects_empty_java_version() {
        assert_eq!(parse_java_major(""), None);
        assert_eq!(parse_java_major("Unknown (64-bit)"), None);
    }

    #[test]
    fn current_test_host_maps_to_supported_minecraft_platform() {
        assert!(host_platform_issue().is_none());
    }
}
