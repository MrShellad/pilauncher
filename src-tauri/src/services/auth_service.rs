// src-tauri/src/services/auth_service.rs
use crate::domain::auth::{Account, AccountType, DeviceCodeResponse, McProfile, MicrosoftTokenResponse};
use std::time::Duration;
use tokio::time::sleep;

use uuid::Uuid;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use base64::{engine::general_purpose, Engine as _};

// ✅ 核心修复：引入 ConfigService 解决未声明类型报错
use crate::services::config_service::ConfigService;

const CLIENT_ID: &str = "e84ecb12-50ce-431f-be1c-fc9db4de5022"; 
const SCOPE: &str = "XboxLive.signin offline_access";
const USER_AGENT: &str = "PiLauncher/1.0";

pub async fn request_device_code() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build().unwrap();
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

pub async fn poll_and_exchange_token<R: Runtime>(app: &AppHandle<R>, device_code: &str, interval: u64) -> Result<Account, String> {
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build().unwrap();
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

pub async fn refresh_microsoft_token<R: Runtime>(app: &AppHandle<R>, refresh_token: &str) -> Result<Account, String> {
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build().unwrap();
    
    let res = client.post("https://login.microsoftonline.com/consumers/oauth2/v2.0/token")
        .form(&[
            ("client_id", CLIENT_ID),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()
        .await
        .map_err(|e| format!("刷新请求发送失败: {}", e))?;

    let token_data: MicrosoftTokenResponse = res.json().await.map_err(|e| format!("解析刷新响应失败: {}", e))?;
    
    let ms_access_token = token_data.access_token.ok_or_else(|| "微软拒绝刷新，该账号可能已修改密码".to_string())?;
    let new_refresh_token = token_data.refresh_token.unwrap_or_else(|| refresh_token.to_string());

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

    let res = client.post("https://user.auth.xboxlive.com/user/authenticate")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if !status.is_success() {
        return Err(format!("XBL 验证失败 (HTTP {}): {}", status, text));
    }

    let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    data["Token"].as_str().map(|s| s.to_string()).ok_or_else(|| "XBL 返回数据结构异常，缺少 Token".to_string())
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
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        .json(&payload)
        .send().await.map_err(|e| e.to_string())?;

    let status = res.status();
    let text = res.text().await.unwrap_or_default();

    if status == 401 {
        let data: serde_json::Value = serde_json::from_str(&text).unwrap_or_default();
        let xerr = data["XErr"].as_u64().unwrap_or(0);
        return match xerr {
            2152391460 => Err("该账号未开通 Xbox 档案，请前往 Xbox 官网创建一个玩家代号。".to_string()),
            2152398418 => Err("由于未成年人保护，需要家长账号同意后才能登录。".to_string()),
            2152392768 => Err("账号存在异常限制。".to_string()),
            _ => Err(format!("XSTS 验证被拒绝 (XErr: {})", xerr)),
        };
    } else if !status.is_success() {
        return Err(format!("XSTS 网络异常 (HTTP {}): {}", status, text));
    }

    let data: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
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
        .ok_or_else(|| format!("请求成功，但缺少 Access Token！完整响应: {}", text_response))
}

async fn get_minecraft_profile(client: &reqwest::Client, mc_token: &str) -> Result<McProfile, String> {
    let res = client.get("https://api.minecraftservices.com/minecraft/profile")
        .bearer_auth(mc_token)
        .send().await.map_err(|e| e.to_string())?;

    if res.status().is_success() {
        let profile: McProfile = res.json().await.map_err(|e| format!("解析档案失败: {}", e))?;
        Ok(profile)
    } else {
        Err("获取档案失败，该账号可能尚未购买 Minecraft Java 版。".to_string())
    }
}

pub async fn cache_account_assets<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    real_mojang_uuid: &str,
    skin_url: Option<&str>,
    cape_url: Option<&str>
) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(account_uuid);
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;

    let client = reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .timeout(Duration::from_secs(10))
        .build()
        .unwrap();

    if let Some(url) = skin_url {
        if let Ok(resp) = client.get(url).send().await {
            let ct = resp.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
            if ct.starts_with("image/") {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(target_dir.join("skin.png"), bytes);
                }
            }
        }
    }

    if let Some(url) = cape_url {
        if let Ok(resp) = client.get(url).send().await {
            let ct = resp.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
            if ct.starts_with("image/") {
                if let Ok(bytes) = resp.bytes().await {
                    let _ = fs::write(target_dir.join("cape.png"), bytes);
                }
            }
        }
    }

    let clean_uuid = real_mojang_uuid.replace("-", "");
    let avatar_url = format!("https://minotar.net/helm/{}/128.png", clean_uuid); // 正版依然可以用 minotar
    
    if let Ok(resp) = client.get(&avatar_url).send().await {
        let ct = resp.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
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

pub fn upload_offline_skin<R: Runtime>(app: &AppHandle<R>, uuid: &str, source_path: &str) -> Result<String, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let source = Path::new(source_path);
    if !source.exists() { return Err("选中的图片不存在".to_string()); }

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
    let client = reqwest::Client::builder().user_agent(USER_AGENT).build().unwrap();
    
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
    
    let skin_url = texture_data["textures"]["SKIN"]["url"].as_str();
    let cape_url = texture_data.get("textures").and_then(|t| t.get("CAPE")).and_then(|c| c.get("url")).and_then(|u| u.as_str());
    
    let _ = cache_account_assets(app, offline_uuid, real_uuid, skin_url, cape_url).await;

    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置".to_string())?
        .unwrap_or_default();
    let target_path = PathBuf::from(base_path_str).join("runtime").join("accounts").join(offline_uuid).join("skin.png");
    
    Ok(target_path.to_string_lossy().to_string())
}

pub fn delete_offline_account_dir<R: Runtime>(app: &AppHandle<R>, uuid: &str) -> Result<(), String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
        
    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(uuid);
    
    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| format!("物理删除账号目录失败: {}", e))?;
    }
    
    Ok(())
}

// ==========================================
// ✅ 全新修复：支持根据 Username 获取本地或网络头像的引擎
// ==========================================
pub async fn get_or_fetch_account_avatar<R: Runtime>(
    app: &AppHandle<R>, 
    uuid: &str,
    username: &str
) -> Result<PathBuf, String> {
    // ✅ 修复 E0433: 这里直接调用刚才我们在顶部 import 进来的 ConfigService
    // ✅ 修复 E0282: 用 `|_|` 将任何错误强行转换为通用字符串，让编译器不再纠结错误类型推导
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "获取启动器基础数据目录失败".to_string())?
        .ok_or_else(|| "尚未配置启动器基础数据目录".to_string())?;

    let target_dir = PathBuf::from(base_path_str).join("runtime").join("accounts").join(uuid);
    
    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;
    }

    let avatar_path = target_dir.join("avatar.png");

    if avatar_path.exists() {
        let is_valid_png = std::fs::read(&avatar_path)
            .map(|bytes| bytes.len() > 8 && &bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
            .unwrap_or(false);
            
        if is_valid_png {
            return Ok(avatar_path); // 如果本地缓存有效，直接短路返回
        } else {
            let _ = std::fs::remove_file(&avatar_path);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .unwrap();
    
    // 使用传入的 username 而不是 uuid，以支持离线账号
    let urls = vec![
        format!("https://minotar.net/helm/{}/128.png", username),
        format!("https://mc-heads.net/avatar/{}/128.png", username),
    ];

    for url in urls {
        if let Ok(resp) = client.get(&url).send().await {
            if resp.status().is_success() {
                if let Ok(bytes) = resp.bytes().await {
                    if bytes.len() > 8 && &bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
                        let _ = std::fs::write(&avatar_path, &bytes);
                        return Ok(avatar_path);
                    }
                }
            }
        }
    }

    Err("所有头像源均被墙或无法获取真实 PNG 数据".to_string())
}