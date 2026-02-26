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