use crate::domain::runtime::{
    JavaInstall, MemoryStats, ResolvedJavaRuntime, RuntimeConfig, ValidationResult,
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
        "javaw"
    } else {
        "java"
    }
}

pub fn installer_default_java_command() -> &'static str {
    "java"
}

pub fn get_required_java_version(mc_version: &str) -> String {
    let parts: Vec<&str> = mc_version.split('.').collect();
    if parts.len() < 2 {
        return "8".to_string();
    }

    let Ok(minor) = parts[1].parse::<u32>() else {
        return "8".to_string();
    };

    if minor >= 21 {
        return "21".to_string();
    }

    if minor == 20 {
        if let Some(patch) = parts.get(2).and_then(|v| v.parse::<u32>().ok()) {
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
        java_path
    }
}

pub fn validate_java_cache(cache_file: &Path) -> Result<ValidationResult, String> {
    let mut valid = Vec::new();
    let mut missing = Vec::new();

    if cache_file.exists() {
        if let Ok(data) = fs::read_to_string(cache_file) {
            if let Ok(cached_javas) = serde_json::from_str::<Vec<JavaInstall>>(&data) {
                for java in cached_javas {
                    if Path::new(&java.path).exists() {
                        valid.push(java);
                    } else {
                        missing.push(java);
                    }
                }
            }
        }
    }

    if !missing.is_empty() {
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
                    paths_to_check.push(p.to_path_buf());
                }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        #[cfg(target_os = "windows")]
        let p = PathBuf::from(java_home).join("bin").join("java.exe");
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
                    paths_to_check.push(p.to_path_buf());
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

fn get_java_version(path: &Path) -> Option<String> {
    let mut cmd = Command::new(path);
    cmd.arg("-version");

    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);

    let lines: Vec<&str> = stderr.lines().collect();
    if lines.is_empty() {
        return None;
    }

    let first_line = lines[0];
    let is_64_bit = stderr.contains("64-Bit") || stderr.contains("64-bit");
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
        max_memory: 4096,
        min_memory: 1024,
        jvm_args: "-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions".to_string(),
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
            max_memory: 4096,
            min_memory: 1024,
            jvm_args: String::new(),
        };

        let resolved = resolve_instance_java_runtime(&runtime, &java_settings(), "1.21.1", "java");
        assert_eq!(resolved.required_java_major, "21");
        assert_eq!(resolved.java_path, "instance-java");
    }
}
