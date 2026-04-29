use crate::domain::runtime::{
    JavaInstall, MemoryAllocationMode, MemoryStats, ResolvedJavaRuntime, RuntimeConfig,
    ValidationResult,
};
use crate::services::config_service::JavaSettings;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::System;
use walkdir::WalkDir;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub fn get_system_memory() -> MemoryStats {
    let mut sys = System::new_all();
    sys.refresh_memory();
    MemoryStats {
        total: sys.total_memory() / 1024 / 1024,
        available: sys.available_memory() / 1024 / 1024,
    }
}

pub fn launcher_default_java_command() -> &'static str {
    if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    }
}

pub fn installer_default_java_command() -> &'static str {
    if cfg!(target_os = "windows") {
        "java.exe"
    } else {
        "java"
    }
}

pub fn get_required_java_version(mc_version: &str) -> String {
    let raw = mc_version.trim().to_ascii_lowercase();
    if raw.is_empty() {
        return "8".to_string();
    }

    if let Some(snapshot_year) = parse_snapshot_year(&raw) {
        return required_java_for_snapshot_year(snapshot_year);
    }

    let parts: Vec<&str> = raw.split('.').collect();
    if parts.len() >= 2 {
        let Some(minor) = parse_prefixed_u32(parts[1]) else {
            return "8".to_string();
        };

        if minor >= 26 {
            return "25".to_string();
        }

        if minor >= 21 {
            return "21".to_string();
        }

        if minor == 20 {
            if let Some(patch) = parts.get(2).and_then(|part| parse_prefixed_u32(part)) {
                if patch >= 5 {
                    return "21".to_string();
                }
            }
            return "17".to_string();
        }

        if minor >= 18 {
            return "17".to_string();
        }

        if minor == 17 {
            return "16".to_string();
        }
    }

    if let Some(major) = parse_prefixed_u32(&raw) {
        if major >= 26 {
            return "25".to_string();
        }
        if major >= 21 {
            return "21".to_string();
        }
        if major >= 18 {
            return "17".to_string();
        }
        if major == 17 {
            return "16".to_string();
        }
    }

    "8".to_string()
}

pub fn resolve_global_java_runtime(
    java_settings: &JavaSettings,
    mc_version: &str,
    fallback_java_command: &str,
) -> ResolvedJavaRuntime {
    let required_java_major = get_required_java_version(mc_version);
    let java_path = java_settings
        .major_java_paths
        .get(&required_java_major)
        .filter(|path| !path.trim().is_empty())
        .cloned()
        .unwrap_or_else(|| java_settings.java_path.clone());

    ResolvedJavaRuntime {
        mc_version: mc_version.to_string(),
        required_java_major,
        java_path: normalize_java_path(java_path, fallback_java_command),
    }
}

pub fn resolve_global_installer_java_runtime(
    java_settings: &JavaSettings,
    mc_version: &str,
    fallback_java_command: &str,
) -> ResolvedJavaRuntime {
    let mut runtime = resolve_global_java_runtime(java_settings, mc_version, fallback_java_command);
    runtime.java_path = normalize_installer_java_path(runtime.java_path, fallback_java_command);
    runtime
}

pub fn resolve_instance_java_runtime(
    instance_runtime: &RuntimeConfig,
    java_settings: &JavaSettings,
    mc_version: &str,
    fallback_java_command: &str,
) -> ResolvedJavaRuntime {
    if instance_runtime.use_global_java || instance_runtime.java_path.trim().is_empty() {
        return resolve_global_java_runtime(java_settings, mc_version, fallback_java_command);
    }

    ResolvedJavaRuntime {
        mc_version: mc_version.to_string(),
        required_java_major: get_required_java_version(mc_version),
        java_path: normalize_java_path(instance_runtime.java_path.clone(), fallback_java_command),
    }
}

fn normalize_java_path(java_path: String, fallback_java_command: &str) -> String {
    let trimmed = java_path.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        fallback_java_command.to_string()
    } else {
        normalize_java_candidate(trimmed, true).unwrap_or_else(|| trimmed.to_string())
    }
}

fn normalize_installer_java_path(java_path: String, fallback_java_command: &str) -> String {
    let trimmed = java_path.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
        fallback_java_command.to_string()
    } else {
        normalize_java_candidate(trimmed, true).unwrap_or_else(|| {
            if cfg!(target_os = "windows") && trimmed.eq_ignore_ascii_case("javaw") {
                "java.exe".to_string()
            } else {
                trimmed.to_string()
            }
        })
    }
}

fn normalize_java_candidate(java_path: &str, prefer_console_binary: bool) -> Option<String> {
    let trimmed = java_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return None;
    }

    if !trimmed.contains(std::path::MAIN_SEPARATOR)
        && !trimmed.contains('/')
        && !trimmed.contains('\\')
    {
        return Some(normalize_java_command_name(trimmed, prefer_console_binary));
    }

    let path = Path::new(trimmed);

    if path.is_dir() {
        return resolve_java_from_home(path, prefer_console_binary)
            .or_else(|| Some(trimmed.to_string()));
    }

    if prefer_console_binary {
        #[cfg(target_os = "windows")]
        if let Some(file_name) = path.file_name().and_then(|name| name.to_str()) {
            if file_name.eq_ignore_ascii_case("javaw.exe") {
                let sibling = path.with_file_name("java.exe");
                if sibling.exists() {
                    return Some(sibling.to_string_lossy().to_string());
                }
            }
        }
    }

    Some(trimmed.to_string())
}

fn normalize_java_command_name(command: &str, prefer_console_binary: bool) -> String {
    #[cfg(target_os = "windows")]
    if prefer_console_binary && command.eq_ignore_ascii_case("javaw") {
        return "java.exe".to_string();
    }

    command.to_string()
}

fn parse_prefixed_u32(value: &str) -> Option<u32> {
    let digits: String = value.chars().take_while(|c| c.is_ascii_digit()).collect();
    if digits.is_empty() {
        None
    } else {
        digits.parse::<u32>().ok()
    }
}

fn parse_snapshot_year(value: &str) -> Option<u32> {
    let lower = value.trim().to_ascii_lowercase();
    let chars: Vec<char> = lower.chars().collect();
    for index in 0..chars.len().saturating_sub(5) {
        if chars[index].is_ascii_digit()
            && chars[index + 1].is_ascii_digit()
            && chars[index + 2] == 'w'
            && chars[index + 3].is_ascii_digit()
            && chars[index + 4].is_ascii_digit()
            && chars[index + 5].is_ascii_lowercase()
        {
            return [chars[index], chars[index + 1]]
                .iter()
                .collect::<String>()
                .parse::<u32>()
                .ok();
        }
    }
    None
}

fn required_java_for_snapshot_year(year: u32) -> String {
    if year >= 26 {
        return "25".to_string();
    }
    if year >= 24 {
        return "21".to_string();
    }
    if year >= 21 {
        return "17".to_string();
    }
    if year >= 20 {
        return "16".to_string();
    }
    "8".to_string()
}

fn resolve_java_from_home(java_home: &Path, prefer_console_binary: bool) -> Option<String> {
    #[cfg(target_os = "windows")]
    let candidates: &[&str] = if prefer_console_binary {
        &["bin\\java.exe", "java.exe", "bin\\javaw.exe", "javaw.exe"]
    } else {
        &["bin\\javaw.exe", "javaw.exe", "bin\\java.exe", "java.exe"]
    };

    #[cfg(not(target_os = "windows"))]
    let candidates: &[&str] = &["bin/java", "java"];

    candidates
        .iter()
        .map(|candidate| java_home.join(candidate))
        .find(|candidate| candidate.exists())
        .map(|candidate| candidate.to_string_lossy().to_string())
}

pub fn validate_java_cache(cache_file: &Path) -> Result<ValidationResult, String> {
    let mut valid = Vec::new();
    let mut missing = Vec::new();
    let mut cache_changed = false;

    if cache_file.exists() {
        if let Ok(data) = fs::read_to_string(cache_file) {
            if let Ok(cached_javas) = serde_json::from_str::<Vec<JavaInstall>>(&data) {
                for java in cached_javas {
                    let normalized_path = prefer_windows_java_executable(PathBuf::from(&java.path))
                        .to_string_lossy()
                        .to_string();
                    if normalized_path != java.path {
                        cache_changed = true;
                    }

                    if Path::new(&normalized_path).exists() {
                        if !valid
                            .iter()
                            .any(|item: &JavaInstall| item.path == normalized_path)
                        {
                            valid.push(JavaInstall {
                                version: java.version,
                                path: normalized_path,
                            });
                        }
                    } else {
                        missing.push(java);
                        cache_changed = true;
                    }
                }
            }
        }
    }

    if cache_changed || !missing.is_empty() {
        if let Ok(json) = serde_json::to_string(&valid) {
            fs::write(cache_file, json).ok();
        }
    }

    Ok(ValidationResult { valid, missing })
}

pub fn scan_java_environments(cache_file: &Path) -> Result<Vec<JavaInstall>, String> {
    let mut installs = Vec::new();
    let mut paths_to_check = Vec::new();

    #[cfg(target_os = "windows")]
    let base_dirs = vec![
        "C:\\Program Files\\Java",
        "C:\\Program Files (x86)\\Java",
        "C:\\Program Files\\Eclipse Adoptium",
        "C:\\Program Files\\Amazon Corretto",
        "C:\\Program Files\\BellSoft",
        "C:\\Program Files\\Zulu",
    ];

    #[cfg(target_os = "macos")]
    let base_dirs = vec![
        "/Library/Java/JavaVirtualMachines",
        "/System/Library/Java/JavaVirtualMachines",
    ];

    #[cfg(target_os = "linux")]
    let base_dirs = vec!["/usr/lib/jvm", "/usr/java", "/opt/jdk"];

    for dir in base_dirs {
        if Path::new(dir).exists() {
            for entry in WalkDir::new(dir)
                .follow_links(true)
                .max_depth(6)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                #[cfg(target_os = "windows")]
                let is_java = p.is_file()
                    && (p.file_name().unwrap_or_default() == "java.exe"
                        || p.file_name().unwrap_or_default() == "javaw.exe");
                #[cfg(not(target_os = "windows"))]
                let is_java = p.is_file() && p.file_name().unwrap_or_default() == "java";

                if is_java {
                    paths_to_check.push(prefer_windows_java_executable(p.to_path_buf()));
                }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        #[cfg(target_os = "windows")]
        let p =
            prefer_windows_java_executable(PathBuf::from(java_home).join("bin").join("java.exe"));
        #[cfg(not(target_os = "windows"))]
        let p = PathBuf::from(java_home).join("bin").join("java");
        if p.exists() {
            paths_to_check.push(p);
        }
    }

    if let Some(base_path) = cache_file.parent().and_then(|p| p.parent()) {
        let runtime_java_dir = base_path.join("runtime").join("java");
        if runtime_java_dir.exists() {
            for entry in WalkDir::new(runtime_java_dir)
                .follow_links(true)
                .max_depth(8)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let p = entry.path();
                #[cfg(target_os = "windows")]
                let is_java = p.is_file()
                    && (p.file_name().unwrap_or_default() == "java.exe"
                        || p.file_name().unwrap_or_default() == "javaw.exe");
                #[cfg(not(target_os = "windows"))]
                let is_java = p.is_file() && p.file_name().unwrap_or_default() == "java";

                if is_java {
                    paths_to_check.push(prefer_windows_java_executable(p.to_path_buf()));
                }
            }
        }
    }

    paths_to_check.sort();
    paths_to_check.dedup();

    for path in paths_to_check {
        if let Some(version) = get_java_version(&path) {
            installs.push(JavaInstall {
                version,
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    if let Ok(json) = serde_json::to_string(&installs) {
        fs::write(cache_file, json).ok();
    }

    Ok(installs)
}

#[cfg(target_os = "windows")]
fn prefer_windows_java_executable(path: PathBuf) -> PathBuf {
    let is_javaw = path
        .file_name()
        .and_then(|name| name.to_str())
        .map(|name| name.eq_ignore_ascii_case("javaw.exe"))
        .unwrap_or(false);

    if is_javaw {
        let sibling = path.with_file_name("java.exe");
        if sibling.exists() {
            return sibling;
        }
    }

    path
}

#[cfg(not(target_os = "windows"))]
fn prefer_windows_java_executable(path: PathBuf) -> PathBuf {
    path
}

pub fn test_java_runtime(java_path: &str) -> Result<JavaInstall, String> {
    let trimmed = java_path.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Err("Java 路径为空".to_string());
    }

    let normalized = normalize_java_candidate(trimmed, true)
        .unwrap_or_else(|| normalize_java_command_name(trimmed, true));
    let normalized = if cfg!(target_os = "windows") && normalized.eq_ignore_ascii_case("javaw.exe")
    {
        "java.exe".to_string()
    } else {
        normalized
    };

    let mut cmd = Command::new(&normalized);
    cmd.arg("-version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().map_err(|e| format!("无法执行 Java: {}", e))?;

    let version =
        extract_java_version(&output).ok_or_else(|| "无法解析 Java 版本输出".to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let reason = if stderr.is_empty() {
            format!("Java 返回非零退出码: {}", output.status)
        } else {
            stderr
        };
        return Err(reason);
    }

    Ok(JavaInstall {
        version,
        path: normalized,
    })
}

fn get_java_version(path: &Path) -> Option<String> {
    let mut cmd = Command::new(path);
    cmd.arg("-version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().ok()?;
    extract_java_version(&output)
}

fn extract_java_version(output: &std::process::Output) -> Option<String> {
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let primary = if stderr.trim().is_empty() {
        stdout.as_ref()
    } else {
        stderr.as_ref()
    };

    let first_line = primary.lines().next()?;
    let bitness_source = format!("{}\n{}", stdout, stderr);
    let is_64_bit = bitness_source.contains("64-Bit") || bitness_source.contains("64-bit");
    let bitness = if is_64_bit { "64-bit" } else { "32-bit" };

    let parts: Vec<&str> = first_line.split('"').collect();
    if parts.len() >= 2 {
        Some(format!("{} ({})", parts[1], bitness))
    } else {
        Some(format!("Unknown ({})", bitness))
    }
}

pub fn get_instance_runtime(instance_dir: &Path) -> Result<RuntimeConfig, String> {
    let file_path = instance_dir.join("instance.json");

    let default_config = RuntimeConfig {
        use_global_java: true,
        use_global_memory: true,
        java_path: "".to_string(),
        memory_allocation_mode: MemoryAllocationMode::Auto,
        max_memory: 4096,
        min_memory: 1024,
        jvm_args: "-XX:+UseZGC -XX:+UnlockExperimentalVMOptions -XX:+ZGenerational -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=150 -XX:G1NewSizePercent=30 -XX:G1ReservePercent=20".to_string(),
    };

    if !file_path.exists() {
        return Ok(default_config);
    }

    let data = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let json: Value = serde_json::from_str(&data).unwrap_or(Value::Null);

    if let Some(runtime_val) = json.get("runtime") {
        if let Ok(config) = serde_json::from_value(runtime_val.clone()) {
            return Ok(config);
        }
    }

    Ok(default_config)
}

pub fn save_instance_runtime(instance_dir: &Path, config: RuntimeConfig) -> Result<(), String> {
    let file_path = instance_dir.join("instance.json");

    let mut json = if file_path.exists() {
        let data = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
        serde_json::from_str::<Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    json["runtime"] = serde_json::to_value(config).map_err(|e| e.to_string())?;

    let new_data = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    fs::write(&file_path, new_data).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn java_settings() -> JavaSettings {
        JavaSettings {
            auto_detect: true,
            java_path: "global-java".to_string(),
            major_java_paths: HashMap::from([
                ("8".to_string(), "java-8".to_string()),
                ("17".to_string(), "java-17".to_string()),
                ("21".to_string(), "java-21".to_string()),
            ]),
            jvm_args: String::new(),
            memory_allocation_mode: MemoryAllocationMode::Auto,
            max_memory: 4096,
            min_memory: 1024,
        }
    }

    #[test]
    fn maps_mc_versions_to_expected_java_major() {
        assert_eq!(get_required_java_version("1.16.5"), "8");
        assert_eq!(get_required_java_version("1.17.1"), "16");
        assert_eq!(get_required_java_version("1.20.4"), "17");
        assert_eq!(get_required_java_version("1.20.5"), "21");
        assert_eq!(get_required_java_version("1.21.1"), "21");
        assert_eq!(get_required_java_version("1.26"), "25");
        assert_eq!(get_required_java_version("v1.26-pre1"), "25");
        assert_eq!(get_required_java_version("26w14a"), "25");
        assert_eq!(get_required_java_version("snapshot-26w14a"), "25");
        assert_eq!(get_required_java_version("24w33a"), "21");
        assert_eq!(get_required_java_version("release/24w33a"), "21");
    }

    #[test]
    fn resolves_global_java_from_major_version_map() {
        let resolved = resolve_global_java_runtime(&java_settings(), "1.20.1", "java");
        assert_eq!(resolved.required_java_major, "17");
        assert_eq!(resolved.java_path, "java-17");
    }

    #[test]
    fn falls_back_to_global_java_path_when_major_specific_path_missing() {
        let mut settings = java_settings();
        settings.major_java_paths.remove("16");

        let resolved = resolve_global_java_runtime(&settings, "1.17.1", "java");
        assert_eq!(resolved.required_java_major, "16");
        assert_eq!(resolved.java_path, "global-java");
    }

    #[test]
    fn keeps_instance_java_override_when_not_using_global_java() {
        let runtime = RuntimeConfig {
            use_global_java: false,
            use_global_memory: true,
            java_path: "instance-java".to_string(),
            memory_allocation_mode: MemoryAllocationMode::Auto,
            max_memory: 4096,
            min_memory: 1024,
            jvm_args: String::new(),
        };

        let resolved = resolve_instance_java_runtime(&runtime, &java_settings(), "1.21.1", "java");
        assert_eq!(resolved.required_java_major, "21");
        assert_eq!(resolved.java_path, "instance-java");
    }

    #[test]
    fn installer_runtime_prefers_console_java_binary_on_windows() {
        #[cfg(target_os = "windows")]
        {
            let unique = format!(
                "pilauncher-java-test-{}",
                std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos()
            );
            let java_home = std::env::temp_dir().join(unique);
            let bin_dir = java_home.join("bin");
            fs::create_dir_all(&bin_dir).unwrap();
            fs::write(bin_dir.join("java.exe"), b"").unwrap();
            fs::write(bin_dir.join("javaw.exe"), b"").unwrap();

            let mut settings = java_settings();
            settings.major_java_paths.insert(
                "17".to_string(),
                bin_dir.join("javaw.exe").to_string_lossy().to_string(),
            );

            let resolved = resolve_global_installer_java_runtime(&settings, "1.20.1", "java");
            assert!(resolved.java_path.ends_with("java.exe"));

            let _ = fs::remove_dir_all(java_home);
        }
    }

    #[test]
    fn normalizes_java_home_directory_to_binary() {
        let unique = format!(
            "pilauncher-java-home-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let java_home = std::env::temp_dir().join(unique);
        let bin_dir = java_home.join("bin");
        fs::create_dir_all(&bin_dir).unwrap();

        #[cfg(target_os = "windows")]
        let binary_path = bin_dir.join("java.exe");
        #[cfg(not(target_os = "windows"))]
        let binary_path = bin_dir.join("java");

        fs::write(&binary_path, b"").unwrap();

        let mut settings = java_settings();
        settings
            .major_java_paths
            .insert("17".to_string(), java_home.to_string_lossy().to_string());

        let resolved = resolve_global_installer_java_runtime(&settings, "1.20.1", "java");
        assert_eq!(
            resolved.java_path,
            binary_path.to_string_lossy().to_string()
        );

        let _ = fs::remove_dir_all(java_home);
    }
}
