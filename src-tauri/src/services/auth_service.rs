// src-tauri/src/services/auth_service.rs
use crate::domain::auth::{
    Account, AccountType, DeviceCodeResponse, McProfile, MicrosoftTokenResponse,
};
use std::sync::OnceLock;
use std::time::Duration;
use tokio::time::sleep;

use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use crate::services::config_service::ConfigService;

const CLIENT_ID: &str = env!("MICROSOFT_CLIENT_ID");
const SCOPE: &str = "XboxLive.signin offline_access";
const USER_AGENT: &str = "PiLauncher/1.0";

// ==========================================
// 全局单例 HTTP Client 与 错误格式化
// ==========================================

/// 获取复用的全局 HTTP 客户端（避免每次新建造成反复 TLS 握手与 DNS 解析）
fn get_client() -> reqwest::Client {
    static CLIENT: OnceLock<reqwest::Client> = OnceLock::new();
    CLIENT
        .get_or_init(|| {
            reqwest::Client::builder()
                .user_agent(USER_AGENT)
                .timeout(Duration::from_secs(15))
                // 解决 SteamOS 等 Linux 发行版缺少系统根证书的问题 (需配合 Cargo.toml 配置)
                .use_rustls_tls()
                .build()
                .unwrap_or_default()
        })
        .clone()
}

/// 精确解析网络底层错误，抛给前端 UI 供用户排查
fn format_reqwest_error(context: &str, e: reqwest::Error) -> String {
    let mut err_msg = format!("{} -> ", context);

    if e.is_timeout() {
        err_msg.push_str("请求超时，请检查您的网络连接或代理设置。");
    } else if e.is_connect() {
        let inner_err = e.to_string().to_lowercase();
        if inner_err.contains("dns") || inner_err.contains("resolve") {
            err_msg
                .push_str("DNS 解析失败，建议修改电脑 DNS (如 223.5.5.5, 8.8.8.8) 或检查加速器。");
        } else if inner_err.contains("cert")
            || inner_err.contains("tls")
            || inner_err.contains("handshake")
        {
            err_msg.push_str(
                "TLS 证书校验失败！这通常是因为电脑系统时间不正确，或遭到网络劫持/防火墙阻断。",
            );
        } else {
            err_msg.push_str(&format!("无法连接到认证服务器: {}", e));
        }
    } else if e.is_decode() {
        err_msg.push_str("服务器返回的数据格式异常，可能网络正被 Portal 门户或防火墙劫持。");
    } else {
        err_msg.push_str(&format!("发生网络异常: {}", e));
    }

    err_msg
}

// ==========================================
// 微软与 Xbox 认证核心流程
// ==========================================

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

pub async fn poll_and_exchange_token<R: Runtime>(
    app: &AppHandle<R>,
    device_code: &str,
    interval: u64,
) -> Result<Account, String> {
    let client = get_client();
    let poll_interval = Duration::from_secs(interval);
    let mut ms_access_token = String::new();
    let mut ms_refresh_token = String::new();

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
            ms_access_token = token;
            ms_refresh_token = token_data.refresh_token.unwrap_or_default();
            break;
        } else if let Some(err) = token_data.error {
            if err != "authorization_pending" {
                let desc = token_data.error_description.unwrap_or_default();
                return Err(format!("授权异常中止: {} ({})", err, desc));
            }
        }

        sleep(poll_interval).await;
        attempts += 1;
    }

    let xbl_token = auth_xbl(&client, &ms_access_token).await?;
    let (xsts_token, uhs) = auth_xsts(&client, &xbl_token).await?;
    let mc_token = auth_minecraft(&client, &xsts_token, &uhs).await?;
    let profile = get_minecraft_profile(&client, &mc_token).await?;

    let skin_url = profile.skins.first().map(|s| s.url.as_str());
    let _ = cache_account_assets(app, &profile.id, &profile.id, skin_url, None).await;

    Ok(Account {
        id: profile.id.clone(),
        account_type: AccountType::Microsoft,
        username: profile.name,
        uuid: profile.id,
        access_token: mc_token,
        refresh_token: Some(ms_refresh_token),
        expires_at: Some(chrono::Utc::now().timestamp() + 86400),
        skin_url: profile.skins.first().map(|s| s.url.clone()),
    })
}

pub async fn refresh_microsoft_token<R: Runtime>(
    app: &AppHandle<R>,
    refresh_token: &str,
) -> Result<Account, String> {
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

    let xbl_token = auth_xbl(&client, &ms_access_token).await?;
    let (xsts_token, uhs) = auth_xsts(&client, &xbl_token).await?;
    let mc_token = auth_minecraft(&client, &xsts_token, &uhs).await?;
    let profile = get_minecraft_profile(&client, &mc_token).await?;

    let skin_url = profile.skins.first().map(|s| s.url.as_str());
    let _ = cache_account_assets(app, &profile.id, &profile.id, skin_url, None).await;

    Ok(Account {
        id: profile.id.clone(),
        account_type: AccountType::Microsoft,
        username: profile.name,
        uuid: profile.id,
        access_token: mc_token,
        refresh_token: Some(new_refresh_token),
        expires_at: Some(chrono::Utc::now().timestamp() + 86400),
        skin_url: profile.skins.first().map(|s| s.url.clone()),
    })
}

async fn auth_xbl(client: &reqwest::Client, ms_token: &str) -> Result<String, String> {
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

async fn auth_xsts(client: &reqwest::Client, xbl_token: &str) -> Result<(String, String), String> {
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

async fn auth_minecraft(
    client: &reqwest::Client,
    xsts_token: &str,
    uhs: &str,
) -> Result<String, String> {
    let payload = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
    });

    let res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        // ✅ 增加一些特定头部，以提高 API 请求的稳定性和合规性
        .header("Cache-Control", "no-cache")
        .json(&payload)
        .send()
        .await
        .map_err(|e| format_reqwest_error("请求 Mojang MC Token 网络错误", e))?;

    let status = res.status();
    let text_response = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!(
            "获取 Minecraft Token 失败 (HTTP {})。微软返回: {}",
            status, text_response
        ));
    }

    let data: serde_json::Value =
        serde_json::from_str(&text_response).map_err(|e| format!("解析 MC Token 失败: {}", e))?;

    data["access_token"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("请求成功，但缺少 Access Token！完整响应: {}", text_response))
}

async fn get_minecraft_profile(
    client: &reqwest::Client,
    mc_token: &str,
) -> Result<McProfile, String> {
    let res = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send()
        .await
        .map_err(|e| format_reqwest_error("获取 MC 游戏档案网络错误", e))?;

    let status = res.status();
    if status.is_success() {
        let profile: McProfile = res
            .json()
            .await
            .map_err(|e| format!("解析游戏档案失败: {}", e))?;
        Ok(profile)
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!(
            "获取档案失败 (HTTP {})，该账号可能未购买 Minecraft Java 版。返回详情: {}",
            status, err_text
        ))
    }
}

// ==========================================
// 辅助与资产模块
// ==========================================

pub async fn cache_account_assets<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    real_mojang_uuid: &str,
    skin_url: Option<&str>,
    cape_url: Option<&str>,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let target_dir = PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(account_uuid);
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;

    let client = get_client();

    if let Some(url) = skin_url {
        if let Ok(resp) = client.get(url).send().await {
            let ct = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            if ct.starts_with("image/") {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(target_dir.join("skin.png"), bytes);
                }
            }
        }
    }

    if let Some(url) = cape_url {
        if let Ok(resp) = client.get(url).send().await {
            let ct = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .unwrap_or("");
            if ct.starts_with("image/") {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(target_dir.join("cape.png"), bytes);
                }
            }
        }
    }

    let clean_uuid = real_mojang_uuid.replace("-", "");
    let avatar_url = format!("https://minotar.net/helm/{}/128.png", clean_uuid);

    if let Ok(resp) = client.get(&avatar_url).send().await {
        let ct = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        let avatar_path = target_dir.join("avatar.png");

        if ct.starts_with("image/") {
            if let Ok(bytes) = resp.bytes().await {
                let _ = fs::write(&avatar_path, bytes);
            }
        } else {
            let _ = fs::remove_file(&avatar_path);
        }
    }

    Ok(())
}

pub fn generate_offline_uuid(name: &str) -> String {
    let digest = md5::compute(format!("OfflinePlayer:{}", name));
    let mut bytes = *digest;
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes).to_string()
}

pub fn upload_offline_skin<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
    source_path: &str,
) -> Result<String, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let source = Path::new(source_path);
    if !source.exists() {
        return Err("选中的图片不存在".to_string());
    }

    let target_dir = PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(uuid);
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建皮肤目录失败: {}", e))?;

    let target_path = target_dir.join("skin.png");
    fs::copy(source, &target_path).map_err(|e| format!("复制皮肤失败: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

pub async fn fetch_and_save_mojang_skin<R: Runtime>(
    app: &AppHandle<R>,
    username: &str,
    offline_uuid: &str,
) -> Result<String, String> {
    let client = get_client();

    let profile_res = client
        .get(format!(
            "https://api.mojang.com/users/profiles/minecraft/{}",
            username
        ))
        .send()
        .await
        .map_err(|e| format_reqwest_error("获取玩家 UUID 网络错误", e))?;

    if !profile_res.status().is_success() {
        return Err("该名称无正版账号映射，已为您应用默认皮肤。".to_string());
    }

    let profile_data: serde_json::Value = profile_res.json().await.map_err(|e| e.to_string())?;
    let real_uuid = profile_data["id"].as_str().ok_or("API未返回UUID")?;

    let session_res = client
        .get(format!(
            "https://sessionserver.mojang.com/session/minecraft/profile/{}",
            real_uuid
        ))
        .send()
        .await
        .map_err(|e| format_reqwest_error("获取材质网络错误", e))?;

    let session_data: serde_json::Value = session_res.json().await.map_err(|e| e.to_string())?;
    let properties = session_data["properties"]
        .as_array()
        .ok_or("无 properties 节点")?;

    let textures_prop = properties
        .iter()
        .find(|p| p["name"] == "textures")
        .ok_or("无材质属性")?;
    let base64_value = textures_prop["value"].as_str().ok_or("无 Base64 值")?;

    let decoded_bytes = general_purpose::STANDARD
        .decode(base64_value)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    let decoded_str = String::from_utf8(decoded_bytes).map_err(|e| e.to_string())?;

    let texture_data: serde_json::Value =
        serde_json::from_str(&decoded_str).map_err(|e| e.to_string())?;

    let skin_url = texture_data["textures"]["SKIN"]["url"].as_str();
    let cape_url = texture_data
        .get("textures")
        .and_then(|t| t.get("CAPE"))
        .and_then(|c| c.get("url"))
        .and_then(|u| u.as_str());

    let _ = cache_account_assets(app, offline_uuid, real_uuid, skin_url, cape_url).await;

    let base_path_str = ConfigService::get_base_path(app)
        .unwrap_or_default()
        .unwrap_or_default();
    let target_path = PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(offline_uuid)
        .join("skin.png");

    Ok(target_path.to_string_lossy().to_string())
}

pub fn delete_offline_account_dir<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let target_dir = PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(uuid);

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| format!("物理删除账号目录失败: {}", e))?;
    }

    Ok(())
}

pub async fn get_or_fetch_account_avatar<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
    username: &str,
) -> Result<PathBuf, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "获取启动器基础数据目录失败".to_string())?
        .ok_or_else(|| "尚未配置启动器基础数据目录".to_string())?;

    let target_dir = PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(uuid);

    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;
    }

    let avatar_path = target_dir.join("avatar.png");

    if avatar_path.exists() {
        let is_valid_png = std::fs::read(&avatar_path)
            .map(|bytes| {
                bytes.len() > 8 && &bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
            })
            .unwrap_or(false);

        if is_valid_png {
            return Ok(avatar_path);
        } else {
            let _ = std::fs::remove_file(&avatar_path);
        }
    }

    let client = get_client();

    let urls = vec![
        format!("https://minotar.net/helm/{}/128.png", username),
        format!("https://mc-heads.net/avatar/{}/128.png", username),
    ];

    for url in urls {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() > 8
                        && &bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
                    {
                        let _ = std::fs::write(&avatar_path, &bytes);
                        return Ok(avatar_path);
                    }
                }
            }
        }
    }

    Err("所有头像源均被墙或无法获取真实 PNG 数据".to_string())
}
