use crate::services::db_service::AppDatabase;
use crate::services::logshare_history_service::{
    LogShareHistoryRecord, LogShareHistoryService, NewLogShareHistory,
};
use crate::services::logshare_service::{LogShareOptions, LogShareReport, LogShareService};
use tauri::State;

#[tauri::command]
pub async fn share_minecraft_log(
    db: State<'_, AppDatabase>,
    content: String,
    sanitize: bool,
    include_insights: bool,
    include_ai_analysis: bool,
    log_type: Option<String>,
) -> Result<LogShareReport, String> {
    let service = LogShareService::new()?;
    let mut report = service
        .share_log(
            content,
            LogShareOptions {
                sanitize,
                include_insights,
                include_ai_analysis,
            },
        )
        .await?;

    match report.upload.token.as_deref().map(str::trim) {
        Some(token) if !token.is_empty() => {
            match LogShareHistoryService::save(
                &db.pool,
                NewLogShareHistory {
                    log_id: report.upload.id.clone(),
                    log_type: log_type.unwrap_or_else(|| "game".to_string()),
                    url: report.upload.url.clone(),
                    raw_url: report.upload.raw.clone(),
                    token: token.to_string(),
                },
            )
            .await
            {
                Ok(history) => report.history = Some(history),
                Err(error) => {
                    report.history_error = Some(format!("保存日志分享记录失败: {}", error))
                }
            }
        }
        _ => {
            report.history_error =
                Some("日志分享服务未返回删除 token，无法记录远端删除凭据".to_string());
        }
    }

    Ok(report)
}

#[tauri::command]
pub async fn analyse_minecraft_log(
    content: String,
    sanitize: bool,
) -> Result<serde_json::Value, String> {
    let service = LogShareService::new()?;
    service.analyse_log(content, sanitize).await
}

#[tauri::command]
pub async fn get_logshare_insights(id: String) -> Result<serde_json::Value, String> {
    let service = LogShareService::new()?;
    service.get_insights(&id).await
}

#[tauri::command]
pub async fn get_logshare_ai_analysis(id: String) -> Result<serde_json::Value, String> {
    let service = LogShareService::new()?;
    service.get_ai_analysis(&id).await
}

#[tauri::command]
pub async fn get_logshare_raw(id: String) -> Result<String, String> {
    let service = LogShareService::new()?;
    service.get_raw(&id).await
}

#[tauri::command]
pub async fn get_logshare_history(
    db: State<'_, AppDatabase>,
) -> Result<Vec<LogShareHistoryRecord>, String> {
    LogShareHistoryService::list(&db.pool)
        .await
        .map_err(|error| format!("读取日志分享历史失败: {}", error))
}

#[tauri::command]
pub async fn delete_logshare_history(
    db: State<'_, AppDatabase>,
    uuid: String,
) -> Result<(), String> {
    let record = LogShareHistoryService::get(&db.pool, &uuid)
        .await
        .map_err(|error| format!("读取日志分享记录失败: {}", error))?
        .ok_or_else(|| "日志分享记录不存在".to_string())?;

    let service = LogShareService::new()?;
    service.delete_remote(&record.log_id, &record.token).await?;

    LogShareHistoryService::delete_local(&db.pool, &uuid)
        .await
        .map_err(|error| format!("删除本地日志分享记录失败: {}", error))
}
