use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::{Client, StatusCode};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;

use crate::services::logshare_history_service::LogShareHistoryRecord;

const LOGSHARE_BASE_URL: &str = "https://api.logshare.cn";
const MAX_LOG_BYTES: usize = 10 * 1024 * 1024;
const MAX_LOG_LINES: usize = 25_000;

static TOKEN_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(
        r"(?i)\b(access[_-]?token|refresh[_-]?token|client[_-]?token|session|authorization)\b\s*[:=]\s*([A-Za-z0-9._\-/+=]{8,})",
    )
    .expect("valid token regex")
});

static BEARER_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)\b(Bearer\s+)[A-Za-z0-9._\-/+=]{8,}").expect("valid bearer regex")
});

static WINDOWS_USER_PATH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)([A-Z]:\\Users\\)[^\\/\r\n\s]+").expect("valid windows user path regex")
});

static UNIX_USER_PATH_RE: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"(?i)(/(?:home|Users)/)[^/\r\n\s]+").expect("valid unix user path regex")
});

#[derive(Debug, Clone, Copy)]
pub struct LogShareOptions {
    pub sanitize: bool,
    pub include_insights: bool,
    pub include_ai_analysis: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogShareUploadResult {
    #[serde(default)]
    pub success: bool,
    #[serde(default)]
    pub message: Option<String>,
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub raw: Option<String>,
    #[serde(default, skip_serializing)]
    pub token: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogShareReport {
    pub upload: LogShareUploadResult,
    pub insights: Option<Value>,
    pub ai_analysis: Option<Value>,
    pub insights_error: Option<String>,
    pub ai_analysis_error: Option<String>,
    pub sanitized: bool,
    pub line_count: usize,
    pub byte_count: usize,
    pub history: Option<LogShareHistoryRecord>,
    pub history_error: Option<String>,
}

pub struct LogShareService {
    client: Client,
}

impl LogShareService {
    pub fn new() -> Result<Self, String> {
        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("PiLauncher LogShare Client")
            .build()
            .map_err(|error| format!("创建日志分享客户端失败: {}", error))?;

        Ok(Self { client })
    }

    pub async fn share_log(
        &self,
        content: String,
        options: LogShareOptions,
    ) -> Result<LogShareReport, String> {
        let prepared = prepare_log_content(content, options.sanitize)?;
        let upload = self.paste(&prepared.content).await?;

        if !upload.success {
            return Err("日志分享服务未返回成功状态".to_string());
        }

        let (insights, insights_error) = if options.include_insights {
            match self.get_insights(&upload.id).await {
                Ok(value) => (Some(value), None),
                Err(error) => (None, Some(error)),
            }
        } else {
            (None, None)
        };

        let (ai_analysis, ai_analysis_error) = if options.include_ai_analysis {
            match self.get_ai_analysis(&upload.id).await {
                Ok(value) => (Some(value), None),
                Err(error) => (None, Some(error)),
            }
        } else {
            (None, None)
        };

        Ok(LogShareReport {
            upload,
            insights,
            ai_analysis,
            insights_error,
            ai_analysis_error,
            sanitized: options.sanitize,
            line_count: prepared.line_count,
            byte_count: prepared.byte_count,
            history: None,
            history_error: None,
        })
    }

    pub async fn analyse_log(&self, content: String, sanitize: bool) -> Result<Value, String> {
        let prepared = prepare_log_content(content, sanitize)?;
        let response = self
            .client
            .post(format!("{}/1/analyse", LOGSHARE_BASE_URL))
            .form(&[("content", prepared.content.as_str())])
            .send()
            .await
            .map_err(|error| format!("请求日志分析失败: {}", error))?;

        parse_json_response(response, "日志分析").await
    }

    pub async fn get_insights(&self, id: &str) -> Result<Value, String> {
        validate_log_id(id)?;

        let response = self
            .client
            .get(format!("{}/1/insights/{}", LOGSHARE_BASE_URL, id))
            .send()
            .await
            .map_err(|error| format!("获取日志洞察失败: {}", error))?;

        parse_json_response(response, "日志洞察").await
    }

    pub async fn get_ai_analysis(&self, id: &str) -> Result<Value, String> {
        validate_log_id(id)?;

        let response = self
            .client
            .get(format!("{}/1/ai-analysis/{}", LOGSHARE_BASE_URL, id))
            .send()
            .await
            .map_err(|error| format!("获取 AI 诊断失败: {}", error))?;

        parse_json_response(response, "AI 诊断").await
    }

    pub async fn get_raw(&self, id: &str) -> Result<String, String> {
        validate_log_id(id)?;

        let response = self
            .client
            .get(format!("{}/1/raw/{}", LOGSHARE_BASE_URL, id))
            .send()
            .await
            .map_err(|error| format!("获取原始日志失败: {}", error))?;

        parse_text_response(response, "原始日志").await
    }

    pub async fn delete_remote(&self, id: &str, token: &str) -> Result<(), String> {
        validate_log_id(id)?;
        let token = token.trim();
        if token.is_empty() {
            return Err("日志删除 token 为空".to_string());
        }

        let response = self
            .client
            .delete(format!("{}/1/delete/{}", LOGSHARE_BASE_URL, id))
            .bearer_auth(token)
            .query(&[("token", token)])
            .header("X-Log-Token", token)
            .json(&json!({ "token": token }))
            .send()
            .await
            .map_err(|error| format!("删除远端日志失败: {}", error))?;

        parse_delete_response(response).await
    }

    async fn paste(&self, content: &str) -> Result<LogShareUploadResult, String> {
        let response = self
            .client
            .post(format!("{}/1/log", LOGSHARE_BASE_URL))
            .form(&[("content", content)])
            .send()
            .await
            .map_err(|error| format!("上传日志失败: {}", error))?;

        parse_json_response(response, "日志上传").await
    }
}

struct PreparedLogContent {
    content: String,
    line_count: usize,
    byte_count: usize,
}

fn prepare_log_content(content: String, sanitize: bool) -> Result<PreparedLogContent, String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let trimmed = normalized.trim();

    if trimmed.is_empty() {
        return Err("暂无可上传的日志内容".to_string());
    }

    let content = if sanitize {
        sanitize_log_content(trimmed)
    } else {
        trimmed.to_string()
    };

    let line_count = content.lines().count();
    if line_count > MAX_LOG_LINES {
        return Err(format!("日志超过 {} 行，无法上传", MAX_LOG_LINES));
    }

    let byte_count = content.as_bytes().len();
    if byte_count > MAX_LOG_BYTES {
        return Err("日志超过 10MiB，无法上传".to_string());
    }

    Ok(PreparedLogContent {
        content,
        line_count,
        byte_count,
    })
}

fn sanitize_log_content(content: &str) -> String {
    let content = TOKEN_RE.replace_all(content, "$1=<redacted>");
    let content = BEARER_RE.replace_all(&content, "${1}<redacted>");
    let content = WINDOWS_USER_PATH_RE.replace_all(&content, "$1<user>");
    UNIX_USER_PATH_RE
        .replace_all(&content, "$1<user>")
        .to_string()
}

fn validate_log_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("日志 ID 不能为空".to_string());
    }

    if !id.chars().all(|ch| ch.is_ascii_alphanumeric()) {
        return Err("日志 ID 格式无效".to_string());
    }

    Ok(())
}

async fn parse_json_response<T: DeserializeOwned>(
    response: reqwest::Response,
    action: &str,
) -> Result<T, String> {
    let status = response.status();

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format_api_error(status, action, &body));
    }

    response
        .json::<T>()
        .await
        .map_err(|error| format!("解析{}响应失败: {}", action, error))
}

async fn parse_text_response(response: reqwest::Response, action: &str) -> Result<String, String> {
    let status = response.status();

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format_api_error(status, action, &body));
    }

    response
        .text()
        .await
        .map_err(|error| format!("读取{}响应失败: {}", action, error))
}

async fn parse_delete_response(response: reqwest::Response) -> Result<(), String> {
    let status = response.status();

    if status.is_success() || status == StatusCode::NOT_FOUND || status == StatusCode::GONE {
        return Ok(());
    }

    let body = response.text().await.unwrap_or_default();
    Err(format_api_error(status, "删除远端日志", &body))
}

fn format_api_error(status: StatusCode, action: &str, body: &str) -> String {
    let fallback = if status == StatusCode::TOO_MANY_REQUESTS {
        "请求过于频繁，请稍后重试".to_string()
    } else {
        format!("{}失败: HTTP {}", action, status)
    };

    if let Ok(value) = serde_json::from_str::<Value>(body) {
        if let Some(message) = value
            .get("error")
            .or_else(|| value.get("message"))
            .and_then(Value::as_str)
        {
            return message.to_string();
        }
    }

    let trimmed = body.trim();
    if trimmed.is_empty() {
        return fallback;
    }

    let mut message = trimmed.chars().take(160).collect::<String>();
    if trimmed.chars().count() > 160 {
        message.push_str("...");
    }

    format!("{}: {}", fallback, message)
}
