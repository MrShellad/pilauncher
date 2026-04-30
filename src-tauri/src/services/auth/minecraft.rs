// src-tauri/src/services/auth/minecraft.rs
//
// Mojang / Minecraft Services API 客户端。
// 负责：MC Token 交换、Profile 获取、皮肤上传、披风切换、头像获取、Mojang 皮肤获取。

use crate::domain::auth::McProfile;
use base64::{engine::general_purpose, Engine as _};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use super::http::{format_reqwest_error, get_client};
use super::paths;
use crate::services::config_service::ConfigService;

/// 使用 XSTS Token + UHS 换取 Minecraft Access Token
pub async fn auth_minecraft(xsts_token: &str, uhs: &str) -> Result<String, String> {
    let client = get_client();
    let payload = serde_json::json!({
        "identityToken": format!("XBL3.0 x={};{}", uhs, xsts_token)
    });

    let res = client
        .post("https://api.minecraftservices.com/authentication/login_with_xbox")
        .header("Content-Type", "application/json")
        .header("Accept", "application/json")
        // 增加一些特定头部，以提高 API 请求的稳定性和合规性
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

/// 获取 Minecraft 游戏档案（含皮肤和披风信息）
pub async fn get_minecraft_profile(mc_token: &str) -> Result<McProfile, String> {
    let client = get_client();
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

/// 获取 Profile 中当前激活皮肤的 URL
pub fn active_skin_url(profile: &McProfile) -> Option<&str> {
    profile
        .skins
        .iter()
        .find(|skin| skin.state.as_deref() == Some("ACTIVE"))
        .or_else(|| profile.skins.first())
        .map(|skin| skin.url.as_str())
}

/// 获取 Profile 中当前激活披风的 URL
pub fn active_cape_url(profile: &McProfile) -> Option<&str> {
    profile
        .capes
        .iter()
        .find(|cape| cape.state.as_deref() == Some("ACTIVE"))
        .map(|cape| cape.url.as_str())
}

/// Minecraft API 错误格式化
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

fn is_valid_png_bytes(bytes: &[u8]) -> bool {
    bytes.len() > 8 && &bytes[0..8] == [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
}

fn is_valid_png_file(path: &PathBuf) -> bool {
    std::fs::read(path)
        .map(|bytes| is_valid_png_bytes(&bytes))
        .unwrap_or(false)
}

/// 构建皮肤上传的 multipart body
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

/// 上传皮肤到 Minecraft 服务
pub async fn upload_skin(
    access_token: &str,
    file_bytes: &[u8],
    file_name: &str,
    variant: &str,
) -> Result<(), String> {
    let (boundary, body) = build_skin_upload_body(variant, file_name, file_bytes);

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

    Ok(())
}

/// 切换激活的披风
pub async fn set_active_cape_api(access_token: &str, cape_id: &str) -> Result<(), String> {
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

    Ok(())
}

/// 卸下当前披风
pub async fn clear_active_cape_api(access_token: &str) -> Result<(), String> {
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

    Ok(())
}

/// 缓存账号的皮肤、披风、头像到本地文件系统
pub async fn cache_account_assets<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    real_mojang_uuid: &str,
    skin_url: Option<&str>,
    cape_url: Option<&str>,
) -> Result<(), String> {
    let target_dir = paths::account_runtime_dir(app, account_uuid)?;
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;

    let client = get_client();

    if let Some(url) = skin_url {
        if let Ok(resp) = client.get(url).send().await {
            if resp.status().is_success() {
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

    let clean_uuid = real_mojang_uuid.replace('-', "");
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

/// 确保账号当前皮肤已缓存到 `{base}/runtime/accounts/{uuid}/skin.png`
pub async fn ensure_account_skin<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
    skin_url: Option<&str>,
) -> Result<PathBuf, String> {
    let target_dir = paths::account_runtime_dir(app, uuid)?;
    fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;

    let skin_path = target_dir.join("skin.png");
    let existing_valid = skin_path.exists() && is_valid_png_file(&skin_path);

    if let Some(raw_url) = skin_url {
        let source = raw_url.split('?').next().unwrap_or("").trim();

        if source.starts_with("http://") || source.starts_with("https://") {
            let client = get_client();
            if let Ok(resp) = client.get(source).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        if is_valid_png_bytes(&bytes) {
                            fs::write(&skin_path, &bytes)
                                .map_err(|e| format!("写入皮肤缓存失败: {}", e))?;
                            return Ok(skin_path);
                        }
                    }
                }
            }
        } else if !source.is_empty() {
            let source_path = PathBuf::from(source);
            if source_path.exists() && is_valid_png_file(&source_path) {
                if source_path != skin_path {
                    fs::copy(&source_path, &skin_path)
                        .map_err(|e| format!("复制皮肤缓存失败: {}", e))?;
                }
                return Ok(skin_path);
            }
        }
    }

    if existing_valid {
        return Ok(skin_path);
    }

    if skin_path.exists() {
        let _ = fs::remove_file(&skin_path);
    }

    Err("账号皮肤缓存不存在，且无法从账号皮肤 URL 获取".to_string())
}

/// 获取或下载账号头像
pub async fn get_or_fetch_account_avatar<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
    username: &str,
) -> Result<PathBuf, String> {
    let target_dir = paths::account_runtime_dir(app, uuid)?;

    if !target_dir.exists() {
        std::fs::create_dir_all(&target_dir).map_err(|e| format!("创建账号资源目录失败: {}", e))?;
    }

    let avatar_path = target_dir.join("avatar.png");

    if avatar_path.exists() {
        let is_valid_png = is_valid_png_file(&avatar_path);

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
                    if is_valid_png_bytes(&bytes) {
                        let _ = std::fs::write(&avatar_path, &bytes);
                        return Ok(avatar_path);
                    }
                }
            }
        }
    }

    Err("所有头像源均被墙或无法获取真实 PNG 数据".to_string())
}

/// 从 Mojang API 获取正版皮肤并保存到离线账号目录
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
