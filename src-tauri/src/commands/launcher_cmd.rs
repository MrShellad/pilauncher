// src-tauri/src/commands/launcher_cmd.rs
use crate::error::AppResult;
use crate::services::launcher::LauncherService;
// ✅ 核心修改 1：引入新的统一账号模型
use crate::domain::launcher::Account;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn launch_game<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    account: Account, // 核心修改 2：将 AccountPayload 替换为 Account
) -> AppResult<()> {
    // 异步交由 Service 调度
    LauncherService::launch_instance(&app, &instance_id, account).await
}

use std::sync::atomic::{AtomicU32, Ordering};
pub static CURRENT_GAME_PID: AtomicU32 = AtomicU32::new(0);

#[tauri::command]
pub async fn kill_current_game() -> Result<(), String> {
    let pid = CURRENT_GAME_PID.load(Ordering::SeqCst);
    if pid > 0 {
        println!("⚠️ User requested to kill game process: PID {}", pid);
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .status();
        }
        #[cfg(not(target_os = "windows"))]
        {
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .status();
        }
    }
    Ok(())
}

// ==========================================
// 新增：一键生成崩溃诊断包指令
// ==========================================
#[tauri::command]
pub async fn export_diagnostics<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    launcher_logs: Vec<String>,
) -> Result<String, String> {
    use std::io::{Read, Write};

    let base_path = crate::services::config_service::ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "未配置数据目录".to_string())?;

    let base_dir = std::path::PathBuf::from(base_path);
    let instance_dir = base_dir.join("instances").join(&instance_id);

    // 以 Unix 时间戳命名，保存在根目录
    let unix_time = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let zip_filename = format!("PiLog-{}.zip", unix_time);
    let zip_path = base_dir.join(&zip_filename);

    let file = std::fs::File::create(&zip_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 1. 写入启动器实时捕获的控制台日志
    let _ = zip.start_file("launcher_log.txt", options);
    let _ = zip.write_all(launcher_logs.join("\n").as_bytes());

    // 2. 尝试追加 latest.log
    let latest_log = instance_dir.join("logs").join("latest.log");
    if latest_log.exists() {
        if let Ok(mut f) = std::fs::File::open(latest_log) {
            let mut buffer = Vec::new();
            let _ = f.read_to_end(&mut buffer);
            let _ = zip.start_file("latest.log", options);
            let _ = zip.write_all(&buffer);
        }
    }

    // 3. 尝试追加 debug.log
    let debug_log = instance_dir.join("logs").join("debug.log");
    if debug_log.exists() {
        if let Ok(mut f) = std::fs::File::open(debug_log) {
            let mut buffer = Vec::new();
            let _ = f.read_to_end(&mut buffer);
            let _ = zip.start_file("debug.log", options);
            let _ = zip.write_all(&buffer);
        }
    }

    // 4. 寻找并追加最新的一份崩溃报告
    let crash_dir = instance_dir.join("crash-reports");
    if crash_dir.exists() {
        let mut newest_file = None;
        let mut newest_time = std::time::UNIX_EPOCH;
        if let Ok(entries) = std::fs::read_dir(crash_dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        if modified > newest_time {
                            newest_time = modified;
                            newest_file = Some(entry.path());
                        }
                    }
                }
            }
        }
        if let Some(path) = newest_file {
            if let Ok(mut f) = std::fs::File::open(&path) {
                let mut buffer = Vec::new();
                let _ = f.read_to_end(&mut buffer);
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    let _ = zip.start_file(format!("crash-reports/{}", name), options);
                    let _ = zip.write_all(&buffer);
                }
            }
        }
    }

    // 5. 生成 Mod 列表
    let mods_dir = instance_dir.join("mods");
    if mods_dir.exists() {
        let mut mod_list = String::new();
        if let Ok(entries) = std::fs::read_dir(mods_dir) {
            for entry in entries.flatten() {
                if let Some(name) = entry.file_name().to_str() {
                    mod_list.push_str(name);
                    mod_list.push('\n');
                }
            }
        }
        let _ = zip.start_file("modlist.txt", options);
        let _ = zip.write_all(mod_list.as_bytes());
    }

    // 6. 附加系统软硬件信息
    let sys_info = format!(
        "OS: {}\nARCH: {}\n",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    let _ = zip.start_file("system_info.txt", options);
    let _ = zip.write_all(sys_info.as_bytes());

    zip.finish().map_err(|e| e.to_string())?;

    Ok(zip_path.to_string_lossy().to_string())
}
