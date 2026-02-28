use crate::domain::runtime::{JavaInstall, MemoryStats, ValidationResult};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use sysinfo::System;
use walkdir::WalkDir;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// ================= 1. 获取系统真实内存 =================
pub fn get_system_memory() -> MemoryStats {
    let mut sys = System::new_all();
    sys.refresh_memory();
    MemoryStats {
        total: sys.total_memory() / 1024 / 1024,
        available: sys.available_memory() / 1024 / 1024,
    }
}

// ================= 2. 校验并读取缓存 =================
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

// ================= 3. 深度受限的物理扫描 =================
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
    let base_dirs = vec!["/Library/Java/JavaVirtualMachines"];

    #[cfg(target_os = "linux")]
    let base_dirs = vec!["/usr/lib/jvm"];

    for dir in base_dirs {
        if Path::new(dir).exists() {
            for entry in WalkDir::new(dir).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                let p = entry.path();
                #[cfg(target_os = "windows")]
                let is_java = p.is_file() && p.file_name().unwrap_or_default() == "java.exe";
                #[cfg(not(target_os = "windows"))]
                let is_java = p.is_file() && p.file_name().unwrap_or_default() == "java";

                if is_java { paths_to_check.push(p.to_path_buf()); }
            }
        }
    }

    if let Ok(java_home) = std::env::var("JAVA_HOME") {
        #[cfg(target_os = "windows")]
        let p = PathBuf::from(java_home).join("bin").join("java.exe");
        #[cfg(not(target_os = "windows"))]
        let p = PathBuf::from(java_home).join("bin").join("java");
        if p.exists() { paths_to_check.push(p); }
    }

    paths_to_check.sort();
    paths_to_check.dedup();

    for path in paths_to_check {
        if let Some(version) = get_java_version(&path) {
            installs.push(JavaInstall { version, path: path.to_string_lossy().to_string() });
        }
    }

    if let Ok(json) = serde_json::to_string(&installs) {
        fs::write(cache_file, json).ok();
    }

    Ok(installs)
}

// ================= 辅助函数：执行命令提取版本 =================
fn get_java_version(path: &Path) -> Option<String> {
    let mut cmd = Command::new(path);
    cmd.arg("-version");
    
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);

    let output = cmd.output().ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    
    let lines: Vec<&str> = stderr.lines().collect();
    if lines.is_empty() { return None; }
    
    let first_line = lines[0];
    let is_64_bit = stderr.contains("64-Bit");
    let bitness = if is_64_bit { "64-bit" } else { "32-bit" };

    let parts: Vec<&str> = first_line.split('"').collect();
    if parts.len() >= 2 {
        Some(format!("{} ({})", parts[1], bitness))
    } else {
        Some(format!("Unknown ({})", bitness))
    }
}