// src-tauri/src/services/auth/microsoft.rs
//
// 微软 OAuth 设备码流与 Token 刷新。
// 负责与 https://login.microsoftonline.com 的所有交互。

use crate::domain::auth::{DeviceCodeResponse, MicrosoftTokenResponse};
use std::time::Duration;
use tokio::time::sleep;

use super::http::{format_reqwest_error, get_client};

const CLIENT_ID: &str = env!("MICROSOFT_CLIENT_ID");
const SCOPE: &str = "XboxLive.signin offline_access";

/// 获取微软设备码，用于引导用户在浏览器登录
pub async fn request_device_code() -> Result<DeviceCodeResponse, String> {
    let client = get_client();
    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[("client_id", CLIENT_ID), ("scope", SCOPE)])
        .send()
        .await
        .map_err(|e| format_reqwest_error("获取微软设备码失败", e))?;

    let status = res.status();
    if status.is_success() {
        let data: DeviceCodeResponse = res
            .json()
            .await
            .map_err(|e| format_reqwest_error("解析设备码响应失败", e))?;
        Ok(data)
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!(
            "微软接口拒绝请求 (HTTP {})。详情: {}",
            status, err_text
        ))
    }
}

/// 轮询微软授权端点，等待用户完成设备授权后获取 MS Access Token
/// 返回 (ms_access_token, ms_refresh_token)
pub async fn poll_for_token(device_code: &str, interval: u64) -> Result<(String, String), String> {
    let client = get_client();
    let poll_interval = Duration::from_secs(interval);

    let mut attempts = 0;
    loop {
        if attempts > (900 / interval) {
            return Err("等待用户授权超时 (超过15分钟)，请重新发起登录".to_string());
        }

        let res = client
            .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("client_id", CLIENT_ID),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", device_code),
            ])
            .send()
            .await
            .map_err(|e| format_reqwest_error("轮询授权状态失败", e))?;

        let token_data: MicrosoftTokenResponse = res
            .json()
            .await
            .map_err(|e| format_reqwest_error("解析轮询响应失败", e))?;

        if let Some(token) = token_data.access_token {
            let refresh = token_data.refresh_token.unwrap_or_default();
            return Ok((token, refresh));
        } else if let Some(err) = token_data.error {
            if err != "authorization_pending" {
                let desc = token_data.error_description.unwrap_or_default();
                return Err(format!("授权异常中止: {} ({})", err, desc));
            }
        }

        sleep(poll_interval).await;
        attempts += 1;
    }
}

/// 使用 Refresh Token 刷新微软 Access Token
/// 返回 (new_ms_access_token, new_ms_refresh_token)
pub async fn refresh_token(refresh_token: &str) -> Result<(String, String), String> {
    let client = get_client();

    let res = client
        .post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()
        .await
        .map_err(|e| format_reqwest_error("发送刷新请求失败", e))?;

    let status = res.status();
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!(
            "微软拒绝刷新 Token (HTTP {}), 该账号可能已修改密码或撤销授权。详情: {}",
            status, err_text
        ));
    }

    let token_data: MicrosoftTokenResponse = res
        .json()
        .await
        .map_err(|e| format_reqwest_error("解析刷新响应失败", e))?;

    let ms_access_token = token_data
        .access_token
        .ok_or_else(|| "刷新请求成功，但微软未返回 Access Token".to_string())?;
    let new_refresh_token = token_data
        .refresh_token
        .unwrap_or_else(|| refresh_token.to_string());

    Ok((ms_access_token, new_refresh_token))
}
