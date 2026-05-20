use super::http::{format_reqwest_error, get_client};
use crate::domain::auth::{Account, AccountType};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthlibAgent {
    name: &'static str,
    version: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AuthlibAuthenticateRequest<'a> {
    username: &'a str,
    password: &'a str,
    client_token: &'a str,
    request_user: bool,
    agent: AuthlibAgent,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthlibProfile {
    id: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthlibAuthenticateResponse {
    access_token: String,
    client_token: Option<String>,
    selected_profile: Option<AuthlibProfile>,
    #[serde(default)]
    available_profiles: Vec<AuthlibProfile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthlibErrorResponse {
    error: Option<String>,
    error_message: Option<String>,
    cause: Option<String>,
}

fn normalize_api_root(api_root: &str) -> Result<String, String> {
    let mut value = api_root.trim().trim_end_matches('/').to_string();
    if value.is_empty() {
        return Err("第三方皮肤站 API 地址不能为空".to_string());
    }

    if value.ends_with("/authserver/authenticate") {
        value.truncate(value.len() - "/authserver/authenticate".len());
    } else if value.ends_with("/authserver") {
        value.truncate(value.len() - "/authserver".len());
    }

    let parsed = reqwest::Url::parse(&value)
        .map_err(|_| "第三方皮肤站 API 地址格式不正确，请包含 http:// 或 https://".to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("第三方皮肤站 API 地址仅支持 http 或 https".to_string());
    }

    Ok(value.trim_end_matches('/').to_string())
}

fn authlib_error_message(status: reqwest::StatusCode, body: &str) -> String {
    if let Ok(parsed) = serde_json::from_str::<AuthlibErrorResponse>(body) {
        if let Some(message) = parsed.error_message {
            return message;
        }
        if let Some(error) = parsed.error {
            return parsed
                .cause
                .map(|cause| format!("{}: {}", error, cause))
                .unwrap_or(error);
        }
    }

    if body.trim().is_empty() {
        format!("第三方皮肤站登录失败，HTTP {}", status)
    } else {
        format!("第三方皮肤站登录失败，HTTP {}: {}", status, body)
    }
}

pub async fn login_authlib(
    api_root: &str,
    username: &str,
    password: &str,
) -> Result<Account, String> {
    let normalized_api_root = normalize_api_root(api_root)?;
    let trimmed_username = username.trim();
    if trimmed_username.is_empty() {
        return Err("账号不能为空".to_string());
    }
    if password.is_empty() {
        return Err("密码不能为空".to_string());
    }

    let client_token = Uuid::new_v4().to_string();
    let endpoint = format!("{}/authserver/authenticate", normalized_api_root);
    let request = AuthlibAuthenticateRequest {
        username: trimmed_username,
        password,
        client_token: &client_token,
        request_user: true,
        agent: AuthlibAgent {
            name: "Minecraft",
            version: 1,
        },
    };

    let response = get_client()
        .post(&endpoint)
        .json(&request)
        .send()
        .await
        .map_err(|error| format_reqwest_error("连接第三方皮肤站失败", error))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| format_reqwest_error("读取第三方皮肤站响应失败", error))?;

    if !status.is_success() {
        return Err(authlib_error_message(status, &body));
    }

    let auth_response: AuthlibAuthenticateResponse = serde_json::from_str(&body)
        .map_err(|error| format!("解析第三方皮肤站登录响应失败: {}", error))?;
    let profile = auth_response
        .selected_profile
        .or_else(|| auth_response.available_profiles.into_iter().next())
        .ok_or_else(|| "第三方皮肤站未返回可用角色".to_string())?;

    Ok(Account {
        id: profile.id.clone(),
        account_type: AccountType::Authlib,
        username: profile.name,
        uuid: profile.id,
        access_token: auth_response.access_token,
        refresh_token: auth_response.client_token.or(Some(client_token)),
        expires_at: None,
        skin_url: None,
        cape_url: None,
        authlib_api_root: Some(normalized_api_root),
    })
}
