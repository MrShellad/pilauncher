// src-tauri/src/services/auth/xbox.rs
//
// Xbox Live (XBL) 与 Xbox Security Token Service (XSTS) 认证链。
// 将 MS Access Token 逐级交换为 Xbox 安全令牌。

use super::http::{format_reqwest_error, get_client};

/// XBL 认证：使用微软 Access Token 获取 XBL Token
pub async fn auth_xbl(ms_token: &str) -> Result<String, String> {
    let client = get_client();
    let payload = serde_json::json!({
        "Properties": {
            "AuthMethod": "RPS",
            "SiteName": "user.auth.xboxlive.com",
            "RpsTicket": format!("d={}", ms_token)
        },
        "RelyingParty": "http://auth.xboxlive.com",
        "TokenType": "JWT"
    });

    let res = client
        .post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format_reqwest_error("XBL 认证网络错误", e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("XBL 验证失败 (HTTP {}): {}", status, text));
    }

    let data: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("XBL 数据解析异常: {}", e))?;
    data["Token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "XBL 返回数据结构异常，缺少 Token".to_string())
}

/// XSTS 认证：使用 XBL Token 获取 XSTS Token 和 User Hash (UHS)
pub async fn auth_xsts(xbl_token: &str) -> Result<(String, String), String> {
    let client = get_client();
    let payload = serde_json::json!({
        "Properties": {
            "SandboxId": "RETAIL",
            "UserTokens": [xbl_token]
        },
        "RelyingParty": "rp://api.minecraftservices.com/",
        "TokenType": "JWT"
    });

    let res = client
        .post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format_reqwest_error("XSTS 认证网络错误", e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if status == 401 {
        let data: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        let xerr = data["XErr"].as_u64().unwrap_or(0);
        return match xerr {
            2152391460 => {
                Err("该账号未开通 Xbox 档案，请前往 Xbox 官网创建一个玩家代号。".to_string())
            }
            2152398418 => Err("由于未成年人保护限制，需要家长账号同意后才能登录。".to_string()),
            2152392768 => Err("该账号已被微软安全机制封断或存在异常限制。".to_string()),
            _ => Err(format!("XSTS 验证被拒绝 (XErr: {}), 详情: {}", xerr, text)),
        };
    } else if !status.is_success() {
        return Err(format!("XSTS 验证失败 (HTTP {}): {}", status, text));
    }

    let data: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("XSTS 数据解析异常: {}", e))?;
    let token = data["Token"].as_str().ok_or("XSTS 返回缺少 Token")?;
    let uhs = data["DisplayClaims"]["xui"][0]["uhs"]
        .as_str()
        .ok_or("XSTS 返回缺少 uhs")?;

    Ok((token.to_string(), uhs.to_string()))
}

/// 完整的 Xbox 认证链：MS Token -> XBL -> XSTS -> (xsts_token, uhs)
pub async fn authenticate(ms_access_token: &str) -> Result<(String, String), String> {
    let xbl_token = auth_xbl(ms_access_token).await?;
    let (xsts_token, uhs) = auth_xsts(&xbl_token).await?;
    Ok((xsts_token, uhs))
}
