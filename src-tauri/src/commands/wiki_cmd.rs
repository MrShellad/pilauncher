// src-tauri/src/commands/wiki_cmd.rs
use crate::services::wiki_service::WikiService;

/// Tauri 命令：根据 MC 版本号和客户端语言生成对应的 Wiki URL
#[tauri::command]
pub async fn get_wiki_url(version_id: String, lang: String) -> Result<String, String> {
    Ok(WikiService::resolve_wiki_url(&version_id, &lang))
}
