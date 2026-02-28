// src-tauri/src/commands/system_cmd.rs
use tauri::command;
use font_kit::source::SystemSource;
use std::collections::HashSet;
#[command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {
    // 由于读取字体可能较慢，建议放在异步线程中执行
    tokio::task::spawn_blocking(|| {
        let source = SystemSource::new();
        let mut font_names = HashSet::new();

        // 获取系统所有的字体家族
        if let Ok(families) = source.all_families() {
            for family in families {
                font_names.insert(family);
            }
        }

        let mut sorted_fonts: Vec<String> = font_names.into_iter().collect();
        sorted_fonts.sort(); // 按字母排序
        
        Ok(sorted_fonts)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn check_steam_deck() -> Result<bool, String> {
    #[cfg(target_os = "linux")]
    {
        // 1. 检查 SteamOS 的标志性发行版文件
        let has_steamos = Path::new("/etc/steamos-release").exists();
        
        // 2. 检查 CPU 型号是否为 AMD Custom APU (Aerith / Sephiroth 等掌机芯片)
        let cpuinfo = fs::read_to_string("/proc/cpuinfo").unwrap_or_default();
        let is_custom_apu = cpuinfo.contains("AMD Custom APU");

        // 只要满足其一，我们就认为是 Steam Deck 掌机环境
        Ok(has_steamos || is_custom_apu)
    }
    
    // Windows 或 macOS 环境直接返回 false
    #[cfg(not(target_os = "linux"))]
    {
        Ok(false)
    }
}