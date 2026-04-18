// src-tauri/src/services/auth_service.rs
use crate::domain::auth::{
    Account, AccountType, DeviceCodeResponse, McProfile, MicrosoftTokenResponse, WardrobeSkinAsset,
    WardrobeSkinLibrary,
};
use serde::{Deserialize, Serialize};
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
    let ms_access_token;
    let ms_refresh_token;

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

fn active_skin_url(profile: &McProfile) -> Option<&str> {
    profile
        .skins
        .iter()
        .find(|skin| skin.state.as_deref() == Some("ACTIVE"))
        .or_else(|| profile.skins.first())
        .map(|skin| skin.url.as_str())
}

fn active_cape_url(profile: &McProfile) -> Option<&str> {
    profile
        .capes
        .iter()
        .find(|cape| cape.state.as_deref() == Some("ACTIVE"))
        .map(|cape| cape.url.as_str())
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct SkinMetadataEntry {
    pub id: String,
    pub url: String,
    pub model: String,
    pub upload_time: String,
    pub size: u64,
    pub hash: String,
    pub source: String,
    pub is_deleted: bool,
}

#[derive(Serialize, Deserialize, Debug, Default)]
struct SkinMetadata {
    #[serde(default)]
    pub user_id: String,
    #[serde(default)]
    pub current_skin_id: String,
    #[serde(default)]
    pub skins: Vec<SkinMetadataEntry>,
}

// Removed unused unix_timestamp_millis

fn account_runtime_dir<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "鏃犳硶璇诲彇閰嶇疆鐩綍".to_string())?
        .ok_or_else(|| "灏氭湭閰嶇疆鍩虹鏁版嵁鐩綍".to_string())?;

    Ok(PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(account_uuid))
}

fn wardrobe_skin_assets_dir<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    Ok(PathBuf::from(base_path_str)
        .join("config")
        .join("skins")
        .join(account_uuid))
}

fn wardrobe_skin_library_path<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    Ok(wardrobe_skin_assets_dir(app, account_uuid)?.join("metadata.json"))
}

fn active_account_skin_path<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    Ok(account_runtime_dir(app, account_uuid)?.join("skin.png"))
}

fn skin_asset_file_path(assets_dir: &Path, asset_id: &str) -> PathBuf {
    assets_dir.join(format!("{}.png", asset_id))
}

fn next_skin_asset_id(stored: &SkinMetadata) -> String {
    let max_id = stored
        .skins
        .iter()
        .filter_map(|asset| {
            asset
                .id
                .strip_prefix("skin_")
                .and_then(|value| value.parse::<u32>().ok())
        })
        .max()
        .unwrap_or(0);

    format!("skin_{:04}", max_id + 1)
}

fn parse_upload_time_millis(upload_time: &str) -> i64 {
    chrono::DateTime::parse_from_rfc3339(upload_time)
        .map(|value| value.timestamp_millis())
        .unwrap_or(0)
}

fn hash_file(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("璇诲彇鐨偆璧勪骇澶辫触: {}", e))?;
    Ok(format!("{:x}", md5::compute(bytes)))
}

fn read_stored_skin_library(path: &Path) -> Result<SkinMetadata, String> {
    if !path.exists() {
        return Ok(SkinMetadata::default());
    }

    let content = fs::read_to_string(path).map_err(|e| format!("读取皮肤资产清单失败: {}", e))?;
    serde_json::from_str(&content).map_err(|e| format!("解析皮肤资产清单失败: {}", e))
}

fn write_stored_skin_library(path: &Path, library: &SkinMetadata) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("创建皮肤资产目录失败: {}", e))?;
    }

    let serialized = serde_json::to_string_pretty(library)
        .map_err(|e| format!("序列化皮肤资产清单失败: {}", e))?;
    fs::write(path, serialized).map_err(|e| format!("写入皮肤资产清单失败: {}", e))
}

fn get_active_skin_hash<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<Option<String>, String> {
    let skin_path = active_account_skin_path(app, account_uuid)?;
    if !skin_path.exists() || !skin_path.is_file() {
        return Ok(None);
    }

    hash_file(&skin_path).map(Some)
}

fn sync_active_runtime_skin_into_library<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    variant: Option<&str>,
    source: &str,
    forced_asset_id: Option<&str>,
) -> Result<(), String> {
    let runtime_skin_path = active_account_skin_path(app, account_uuid)?;
    if !runtime_skin_path.exists() || !runtime_skin_path.is_file() {
        return Ok(());
    }

    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let bytes =
        fs::read(&runtime_skin_path).map_err(|e| format!("璇诲彇褰撳墠鐨偆澶辫触: {}", e))?;
    let content_hash = format!("{:x}", md5::compute(&bytes));
    let resolved_variant = variant
        .map(normalize_skin_variant)
        .transpose()?
        .unwrap_or("classic")
        .to_string();

    fs::create_dir_all(&assets_dir).map_err(|e| format!("鍒涘缓鐨偆璧勪骇鐩綍澶辫触: {}", e))?;

    let mut stored = read_stored_skin_library(&manifest_path)?;
    if stored.user_id.is_empty() {
        stored.user_id = account_uuid.to_string();
    }

    let active_id = if let Some(forced_id) = forced_asset_id {
        // 如果明确指定了关联的资产 ID（说明是库里刚应用的），直接信任该 ID 
        forced_id.to_string()
    } else if let Some(existing_asset) = stored
        .skins
        .iter_mut()
        .find(|asset| !asset.is_deleted && asset.hash.eq_ignore_ascii_case(&content_hash))
    {
        existing_asset.model = resolved_variant;
        existing_asset.id.clone()
    } else {
        let new_id = next_skin_asset_id(&stored);
        let target_path = skin_asset_file_path(&assets_dir, &new_id);
        fs::write(&target_path, &bytes).map_err(|e| format!("写入皮肤资产失败: {}", e))?;

        stored.skins.push(SkinMetadataEntry {
            id: new_id.clone(),
            url: format!("/skins/{}/{}.png", account_uuid, new_id),
            model: resolved_variant,
            upload_time: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            size: bytes.len() as u64,
            hash: content_hash,
            source: source.to_string(),
            is_deleted: false,
        });

        new_id
    };

    stored.current_skin_id = active_id;
    write_stored_skin_library(&manifest_path, &stored)
}

fn finalize_skin_library<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    mut stored: SkinMetadata,
    persist_if_pruned: bool,
) -> Result<WardrobeSkinLibrary, String> {
    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let original_len = stored.skins.len();
    let mut should_persist = false;

    stored.skins.retain(|asset| {
        if asset.is_deleted {
            return false;
        }
        let abs_path = skin_asset_file_path(&assets_dir, &asset.id);
        abs_path.exists() && abs_path.is_file()
    });

    if persist_if_pruned && stored.skins.len() != original_len {
        should_persist = true;
    }

    let active_hash = get_active_skin_hash(app, account_uuid)?;
    let matched_active_id = active_hash.as_ref().and_then(|hash| {
        stored
            .skins
            .iter()
            .find(|asset| asset.hash.eq_ignore_ascii_case(hash))
            .map(|asset| asset.id.clone())
    });

    match matched_active_id {
        Some(ref active_id) if stored.current_skin_id != *active_id => {
            stored.current_skin_id = active_id.clone();
            should_persist = true;
        }
        None
            if !stored.current_skin_id.is_empty()
                && !stored.skins.iter().any(|asset| asset.id == stored.current_skin_id) =>
        {
            stored.current_skin_id.clear();
            should_persist = true;
        }
        _ => {}
    }

    if should_persist {
        write_stored_skin_library(&manifest_path, &stored)?;
    }

    stored
        .skins
        .sort_by(|a, b| b.upload_time.cmp(&a.upload_time));

    let resolved_active_id = matched_active_id.or_else(|| {
        if active_hash.is_none() && !stored.current_skin_id.is_empty() {
            Some(stored.current_skin_id.clone())
        } else {
            None
        }
    });

    Ok(WardrobeSkinLibrary {
        active_hash: active_hash.clone(),
        assets: stored
            .skins
            .into_iter()
            .map(|asset| {
                let abs_path = skin_asset_file_path(&assets_dir, &asset.id);
                WardrobeSkinAsset {
                    is_active: resolved_active_id
                        .as_ref()
                        .map(|active_id| active_id == &asset.id)
                        .unwrap_or(false),
                    id: asset.id.clone(),
                    file_name: asset.id.clone(),
                    file_path: abs_path.to_string_lossy().to_string(),
                    variant: Some(asset.model.clone()),
                    content_hash: asset.hash.clone(),
                    created_at: parse_upload_time_millis(&asset.upload_time),
                }
            })
            .collect(),
    })
}

async fn cache_profile_assets<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    profile: &McProfile,
    forced_skin_id: Option<&str>,
) {
    let _ = cache_account_assets(
        app,
        account_uuid,
        &profile.id,
        active_skin_url(profile),
        active_cape_url(profile),
    )
    .await;

    let active_variant = profile
        .skins
        .iter()
        .find(|skin| skin.state.as_deref() == Some("ACTIVE"))
        .or_else(|| profile.skins.first())
        .and_then(|skin| skin.variant.as_deref());

    let _ = sync_active_runtime_skin_into_library(
        app,
        account_uuid,
        active_variant,
        "profile",
        forced_skin_id,
    );
}

fn normalize_skin_variant(variant: &str) -> Result<&'static str, String> {
    match variant.trim().to_ascii_lowercase().as_str() {
        "classic" | "default" => Ok("classic"),
        "slim" => Ok("slim"),
        _ => Err("皮肤模型只支持 classic 或 slim".to_string()),
    }
}

fn minecraft_api_error(action: &str, status: reqwest::StatusCode, body: String) -> String {
    let status_code = status.as_u16();
    let hint = match status_code {
        401 => "会话已过期，请刷新账号登录状态后重试",
        403 => "当前账号没有权限执行此操作",
        404 => "Minecraft 服务未找到对应资源",
        413 => "图片文件过大",
        415 => "仅支持 PNG 皮肤文件",
        429 => "请求过于频繁，请稍后再试",
        _ => "Minecraft 服务返回了错误",
    };

    if body.trim().is_empty() {
        format!("{}失败 (HTTP {}): {}", action, status_code, hint)
    } else {
        format!(
            "{}失败 (HTTP {}): {}。服务返回: {}",
            action, status_code, hint, body
        )
    }
}

fn build_skin_upload_body(variant: &str, file_name: &str, file_bytes: &[u8]) -> (String, Vec<u8>) {
    let boundary = format!("----PiLauncherWardrobe{}", Uuid::new_v4().simple());
    let mut body = Vec::with_capacity(file_bytes.len() + 512);

    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(b"Content-Disposition: form-data; name=\"variant\"\r\n\r\n");
    body.extend_from_slice(variant.as_bytes());
    body.extend_from_slice(b"\r\n");

    body.extend_from_slice(format!("--{}\r\n", boundary).as_bytes());
    body.extend_from_slice(
        format!(
            "Content-Disposition: form-data; name=\"file\"; filename=\"{}\"\r\n",
            file_name.replace('"', "")
        )
        .as_bytes(),
    );
    body.extend_from_slice(b"Content-Type: image/png\r\n\r\n");
    body.extend_from_slice(file_bytes);
    body.extend_from_slice(b"\r\n");

    body.extend_from_slice(format!("--{}--\r\n", boundary).as_bytes());

    (boundary, body)
}

pub async fn get_wardrobe_profile<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
) -> Result<McProfile, String> {
    let client = get_client();
    let profile = get_minecraft_profile(&client, access_token).await?;
    cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

pub async fn apply_wardrobe_skin<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    source_path: &str,
    variant: &str,
) -> Result<McProfile, String> {
    let resolved_variant = normalize_skin_variant(variant)?;
    let source = Path::new(source_path);

    if !source.exists() || !source.is_file() {
        return Err("选中的皮肤文件不存在".to_string());
    }

    let file_bytes = fs::read(source).map_err(|e| format!("读取皮肤文件失败: {}", e))?;
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("skin.png");
    let (boundary, body) = build_skin_upload_body(resolved_variant, file_name, &file_bytes);

    let client = get_client();
    let res = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .bearer_auth(access_token)
        .header(
            reqwest::header::CONTENT_TYPE,
            format!("multipart/form-data; boundary={}", boundary),
        )
        .header(reqwest::header::ACCEPT, "application/json")
        .body(body)
        .send()
        .await
        .map_err(|e| format_reqwest_error("上传 Minecraft 皮肤失败", e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(minecraft_api_error("上传皮肤", status, text));
    }

    // 检测 source_path 是否在库路径中，如果是，则提取 ID 以防止同步时产生副本
    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid).unwrap_or_default();
    let forced_id = if source.starts_with(&assets_dir) {
        source
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    } else {
        None
    };

    let profile = get_minecraft_profile(&client, access_token).await?;
    cache_profile_assets(app, account_uuid, &profile, forced_id.as_deref()).await;
    Ok(profile)
}

pub async fn update_active_wardrobe_skin_variant<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    variant: &str,
) -> Result<McProfile, String> {
    let source = active_account_skin_path(app, account_uuid)?;
    apply_wardrobe_skin(
        app,
        access_token,
        account_uuid,
        source.to_string_lossy().as_ref(),
        variant,
    )
    .await
}

pub async fn set_active_cape<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    cape_id: &str,
) -> Result<McProfile, String> {
    let client = get_client();
    let res = client
        .put("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(access_token)
        .header(reqwest::header::ACCEPT, "application/json")
        .json(&serde_json::json!({ "capeId": cape_id }))
        .send()
        .await
        .map_err(|e| format_reqwest_error("切换 Minecraft 披风失败", e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(minecraft_api_error("切换披风", status, text));
    }

    let profile = get_minecraft_profile(&client, access_token).await?;
    cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

pub async fn clear_active_cape<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
) -> Result<McProfile, String> {
    let client = get_client();
    let res = client
        .delete("https://api.minecraftservices.com/minecraft/profile/capes/active")
        .bearer_auth(access_token)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|e| format_reqwest_error("卸下 Minecraft 披风失败", e))?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    if !status.is_success() {
        return Err(minecraft_api_error("卸下披风", status, text));
    }

    let profile = get_minecraft_profile(&client, access_token).await?;
    cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

// ==========================================
// 辅助与资产模块
// ==========================================

pub fn get_wardrobe_skin_library<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<WardrobeSkinLibrary, String> {
    sync_active_runtime_skin_into_library(app, account_uuid, None, "sync", None)?;
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let stored = read_stored_skin_library(&manifest_path)?;
    finalize_skin_library(app, account_uuid, stored, true)
}

pub fn save_wardrobe_skin_asset<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    source_path: &str,
    variant: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let resolved_variant = normalize_skin_variant(variant)?.to_string();
    let source = Path::new(source_path);

    if !source.exists() || !source.is_file() {
        return Err("选中的皮肤文件不存在".to_string());
    }

    let bytes = fs::read(source).map_err(|e| format!("读取皮肤文件失败: {}", e))?;
    let content_hash = format!("{:x}", md5::compute(&bytes));
    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;

    fs::create_dir_all(&assets_dir).map_err(|e| format!("创建皮肤资产目录失败: {}", e))?;

    let mut stored = read_stored_skin_library(&manifest_path)?;

    // Assign user_id if missing
    if stored.user_id.is_empty() {
        stored.user_id = account_uuid.to_string();
    }

    stored.skins
        .retain(|asset| !asset.is_deleted && skin_asset_file_path(&assets_dir, &asset.id).is_file());

    // Check if hash already exists
    if let Some(existing_asset) = stored
        .skins
        .iter_mut()
        .find(|asset| asset.hash == content_hash)
    {
        existing_asset.model = resolved_variant;
    } else {
        let new_id = next_skin_asset_id(&stored);
        let target_path = skin_asset_file_path(&assets_dir, &new_id);
        fs::write(&target_path, &bytes).map_err(|e| format!("写入皮肤资产失败: {}", e))?;

        stored.skins.push(SkinMetadataEntry {
            id: new_id.clone(),
            url: format!("/skins/{}/{}.png", account_uuid, new_id),
            model: resolved_variant,
            upload_time: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true),
            size: bytes.len() as u64,
            hash: content_hash,
            source: "upload".to_string(),
            is_deleted: false,
        });
    }

    write_stored_skin_library(&manifest_path, &stored)?;
    finalize_skin_library(app, account_uuid, stored, false)
}

pub fn delete_wardrobe_skin_asset<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let mut stored = read_stored_skin_library(&manifest_path)?;
    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid)?;
    let active_hash = get_active_skin_hash(app, account_uuid)?;

    let target_index = stored
        .skins
        .iter()
        .position(|asset| asset.id == asset_id)
        .ok_or_else(|| "未找到指定的皮肤资产".to_string())?;

    let is_target_active = stored.skins[target_index].id == stored.current_skin_id
        || active_hash
            .as_ref()
            .map(|hash| stored.skins[target_index].hash.eq_ignore_ascii_case(hash))
            .unwrap_or(false);

    if is_target_active {
        return Err("当前正在使用的皮肤不能删除".to_string());
    }

    let mut removed_asset = stored.skins.remove(target_index);
    removed_asset.is_deleted = true; // just to be conceptually sound

    let asset_path = skin_asset_file_path(&assets_dir, &removed_asset.id);
    removed_asset.url = asset_path.to_string_lossy().to_string();
    if asset_path.exists() {
        fs::remove_file(&removed_asset.url).map_err(|e| format!("物理删除皮肤文件失败: {}", e))?;
    }

    write_stored_skin_library(&manifest_path, &stored)?;
    finalize_skin_library(app, account_uuid, stored, false)
}

pub fn set_wardrobe_skin_asset_variant<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
    variant: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let resolved_variant = normalize_skin_variant(variant)?.to_string();
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let mut stored = read_stored_skin_library(&manifest_path)?;

    let target_asset = stored
        .skins
        .iter_mut()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| "未找到指定的皮肤资产".to_string())?;

    target_asset.model = resolved_variant;
    write_stored_skin_library(&manifest_path, &stored)?;
    finalize_skin_library(app, account_uuid, stored, false)
}

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
        // Optimization: if we already have a skin, and the URL is clearly the same, we could skip.
        // But for HD/Refreshing logic, we follow: ALWAYS try to download first.
        if let Ok(resp) = client.get(url).send().await {
            if resp.status().is_success() {
                let ct = resp
                    .headers()
                    .get(reqwest::header::CONTENT_TYPE)
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("");
                if ct.starts_with("image/") {
                    if let Ok(bytes) = resp.bytes().await {
                        // Successfully fetched new remote skin (potentially HD).
                        // Overwrite local skin.png.
                        let _ = fs::write(target_dir.join("skin.png"), bytes);
                    }
                }
            }
            // If download fails or status not success, the existing skin.png remains used (fallback).
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

pub fn set_active_wardrobe_skin_offline<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let manifest_path = wardrobe_skin_library_path(app, account_uuid)?;
    let mut stored = read_stored_skin_library(&manifest_path)?;

    let assets_dir = wardrobe_skin_assets_dir(app, account_uuid)?;
    let target_asset = stored
        .skins
        .iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| "未找到指定的皮肤资产".to_string())?;

    let source_path = assets_dir.join(format!("{}.png", target_asset.id));

    stored.current_skin_id = asset_id.to_string();
    write_stored_skin_library(&manifest_path, &stored)?;

    // physical copy to runtime/accounts/{uuid}/skin.png
    upload_offline_skin(app, account_uuid, source_path.to_string_lossy().as_ref())?;

    finalize_skin_library(app, account_uuid, stored, false)
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
