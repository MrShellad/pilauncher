// src-tauri/src/services/auth_service.rs
use crate::domain::auth::{Account, AccountType, DeviceCodeResponse, McProfile, MicrosoftTokenResponse};
use std::time::Duration;
use tokio::time::sleep;

use uuid::Uuid;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use base64::{engine::general_purpose, Engine as _};

const CLIENT_ID: &str = "qweqwet3214123413"; 
const SCOPE: &str = "XboxLive.signin offline_access";

pub async fn request_device_code() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();
    let res = client.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode")
        .form(&[
            ("client_id", CLIENT_ID),
            ("scope", SCOPE),
        ])
        .send()
        .await
        .map_err(|e| format!("网络请求失败: {}", e))?;

    let status = res.status();
    if status.is_success() {
        let data: DeviceCodeResponse = res.json().await.map_err(|e| format!("解析响应失败: {}", e))?;
        Ok(data)
    } else {
        let err_text = res.text().await.unwrap_or_default();
        Err(format!("请求失败，状态码: {}。错误详情: {}", status, err_text))
    }
}

// ✅ 核心修改：返回你设计的全新 Account 类型
pub async fn poll_and_exchange_token(device_code: &str, interval: u64) -> Result<Account, String> {
    let client = reqwest::Client::new();
    let poll_interval = Duration::from_secs(interval);
    let mut ms_access_token = String::new();
    let mut ms_refresh_token = String::new();

    let mut attempts = 0;
    loop {
        if attempts > (900 / interval) { 
            return Err("等待用户授权超时 (超过15分钟)".to_string());
        }

        let res = client.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
            .form(&[
                ("client_id", CLIENT_ID),
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("device_code", device_code),
            ])
            .send()
            .await
            .map_err(|e| format!("轮询请求失败: {}", e))?;

        let token_data: MicrosoftTokenResponse = res.json().await.map_err(|e| format!("解析轮询响应失败: {}", e))?;

        if let Some(token) = token_data.access_token {
            ms_access_token = token;
            ms_refresh_token = token_data.refresh_token.unwrap_or_default();
            break; 
        } else if let Some(err) = token_data.error {
            if err != "authorization_pending" {
                let desc = token_data.error_description.unwrap_or_default();
                return Err(format!("授权失败: {} ({})", err, desc));
            }
        }
        
        sleep(poll_interval).await;
        attempts += 1;
    }

    let xbl_token = auth_xbl(&client, &ms_access_token).await?;
    let (xsts_token, uhs) = auth_xsts(&client, &xbl_token).await?;
    let mc_token = auth_minecraft(&client, &xsts_token, &uhs).await?;
    let profile = get_minecraft_profile(&client, &mc_token).await?;

    Ok(Account {
        id: profile.id.clone(),
        account_type: AccountType::Microsoft, // ✅ 强类型枚举
        username: profile.name,
        uuid: profile.id,
        access_token: mc_token,
        refresh_token: Some(ms_refresh_token),
        expires_at: Some(chrono::Utc::now().timestamp() + 86400), // 假设存活一天，为后续自动续期留足空间
        skin_url: profile.skins.first().map(|s| s.url.clone()),
    })
}

// --------- 内部 Helper 函数 (私有，保持不变) ---------

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

    let res = client.post("https://user.auth.xboxlive.com/user/authenticate")
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    data["Token"].as_str().map(|s| s.to_string()).ok_or_else(|| "获取 XBL Token 失败".to_string())
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

    let res = client.post("https://xsts.auth.xboxlive.com/xsts/authorize")
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    if res.status() == 401 {
        let data: serde_json::Value = res.json().await.unwrap_or_default();
        let xerr = data["XErr"].as_u64().unwrap_or(0);
        return match xerr {
            2152391460 => Err("该微软账号尚未开通 Xbox 档案，请先前往 Xbox 官网创建一个玩家代号。".to_string()),
            2152398418 => Err("由于未成年人保护限制，需要家长账号同意后才能登录。".to_string()),
            2152392768 => Err("你的 Xbox 账号似乎存在异常，无法继续验证。".to_string()),
            _ => Err(format!("XSTS 验证被拒绝 (XErr: {})", xerr)),
        };
    }

    let data: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    
    let token = data["Token"].as_str().ok_or("XSTS 返回缺少 Token")?;
    let uhs = data["DisplayClaims"]["xui"][0]["uhs"].as_str().ok_or("XSTS 返回缺少 uhs")?;

    Ok((token.to_string(), uhs.to_string()))
}

async fn auth_minecraft(client: &reqwest::Client, xsts_token: &str, uhs: &str) -> Result<String, String> {
    let payload = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
    });

    let res = client.post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .header("User-Agent", "Mozilla/5.0")
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    let status = res.status();
    let text_response = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("换取 MC Token 失败 (HTTP {})。微软返回: {}", status, text_response));
    }

    let data: serde_json::Value = serde_json::from_str(&text_response)
        .map_err(|e| format!("解析 MC Token 失败: {}", e))?;
        
    data["access_token"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| format!("请求成功，但微软没给 Access Token！完整响应: {}", text_response))
}

async fn get_minecraft_profile(client: &reqwest::Client, mc_token: &str) -> Result<McProfile, String> {
    let res = client.get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let profile: McProfile = res.json().await.map_err(|e| format!("解析档案失败: {}", e))?;
        Ok(profile)
    } else {
        Err("获取档案失败，该账号可能尚未购买 Minecraft Java 版或未创建角色名。".to_string())
    }
}


// ✅ 严格遵守 Minecraft 协议的离线 UUID 生成算法
pub fn generate_offline_uuid(name: &str) -> String {
    let digest = md5::compute(format!("OfflinePlayer:{}", name));
    let mut bytes = *digest;
    
    bytes[6] = (bytes[6] & 0x0f) | 0x30; 
    bytes[8] = (bytes[8] & 0x3f) | 0x80; 
    
    Uuid::from_bytes(bytes).to_string()
}

// ✅ 核心修改：将皮肤的落盘目录转移到 runtime/accounts
pub fn upload_offline_skin<R: Runtime>(app: &AppHandle<R>, uuid: &str, source_path: &str) -> Result<String, String> {
    let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let source = Path::new(source_path);
    if !source.exists() { return Err("选中的图片不存在".to_string()); }

    if source.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase() != "png" {
        return Err("仅支持标准的 PNG 格式皮肤文件".to_string());
    }

    // ✅ 改为 runtime/accounts
    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(uuid);
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建皮肤目录失败: {}", e))?;

    let target_path = target_dir.join("skin.png");
    fs::copy(source, &target_path).map_err(|e| format!("复制皮肤失败: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

pub async fn fetch_and_save_mojang_skin<R: Runtime>(
    app: &AppHandle<R>, 
    username: &str, 
    offline_uuid: &str
) -> Result<String, String> {
    let client = reqwest::Client::builder().user_agent("OreLauncher/1.0").build().unwrap();
    
    let profile_res = client.get(format!("https://api.mojang.com/users/profiles/minecraft/{}", username))
        .send().await.map_err(|e| e.to_string())?;
    
    if !profile_res.status().is_success() {
        return Err("该名称无正版账号，使用默认皮肤".to_string());
    }
    
    let profile_data: serde_json::Value = profile_res.json().await.map_err(|e| e.to_string())?;
    let real_uuid = profile_data["id"].as_str().ok_or("API未返回UUID")?;
    
    let session_res = client.get(format!("https://sessionserver.mojang.com/session/minecraft/profile/{}", real_uuid))
        .send().await.map_err(|e| e.to_string())?;
        
    let session_data: serde_json::Value = session_res.json().await.map_err(|e| e.to_string())?;
    let properties = session_data["properties"].as_array().ok_or("无 properties 节点")?;
    
    let textures_prop = properties.iter().find(|p| p["name"] == "textures").ok_or("无材质属性")?;
    let base64_value = textures_prop["value"].as_str().ok_or("无 Base64 值")?;
    
    let decoded_bytes = general_purpose::STANDARD.decode(base64_value).map_err(|e| format!("Base64 解码失败: {}", e))?;
    let decoded_str = String::from_utf8(decoded_bytes).map_err(|e| e.to_string())?;
    
    let texture_data: serde_json::Value = serde_json::from_str(&decoded_str).map_err(|e| e.to_string())?;
    let skin_url = texture_data["textures"]["SKIN"]["url"].as_str().ok_or("未找到皮肤 URL")?;
    
    let skin_bytes = client.get(skin_url).send().await.map_err(|e| e.to_string())?.bytes().await.map_err(|e| e.to_string())?;
    
    let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        
    // ✅ 改为 runtime/accounts
    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(offline_uuid);
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建皮肤目录失败: {}", e))?;
    
    let target_path = target_dir.join("skin.png");
    fs::write(&target_path, skin_bytes).map_err(|e| format!("保存皮肤失败: {}", e))?;
    
    Ok(target_path.to_string_lossy().to_string())
}

// ✅ 核心修改：保证删除账号时，清理的也是 runtime/accounts 下的文件
pub fn delete_offline_account_dir<R: Runtime>(app: &AppHandle<R>, uuid: &str) -> Result<(), String> {
    let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        
    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(uuid);
    
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| format!("物理删除账号目录失败: {}", e))?;
    }
    
    Ok(())
}