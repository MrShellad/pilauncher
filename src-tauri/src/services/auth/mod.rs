// src-tauri/src/services/auth/mod.rs
//
// 认证服务入口 —— 高层逻辑编排模块。
// 将微软认证、Xbox 认证、Minecraft API、皮肤库、离线账号等子模块组合起来，
// 对外暴露与原 auth_service.rs 完全一致的公共 API，保持调用层零改动。

mod http;
pub mod microsoft;
pub mod xbox;
pub mod minecraft;
pub mod paths;
pub mod wardrobe;
pub mod offline;

use crate::domain::auth::{
    Account, AccountType, McProfile,
};
use std::path::Path;
use tauri::{AppHandle, Runtime};

// ==========================================
// Re-export: 与原 auth_service 完全一致的公开接口
// ==========================================

pub use microsoft::request_device_code;

/// 轮询设备码授权并完成完整的 MS -> Xbox -> MC 认证链
pub async fn poll_and_exchange_token<R: Runtime>(
    app: &AppHandle<R>,
    device_code: &str,
    interval: u64,
) -> Result<Account, String> {
    let (ms_access_token, ms_refresh_token) =
        microsoft::poll_for_token(device_code, interval).await?;

    let (xsts_token, uhs) = xbox::authenticate(&ms_access_token).await?;
    let mc_token = minecraft::auth_minecraft(&xsts_token, &uhs).await?;
    let profile = minecraft::get_minecraft_profile(&mc_token).await?;

    let skin_url = profile.skins.first().map(|s| s.url.as_str());
    let _ = minecraft::cache_account_assets(app, &profile.id, &profile.id, skin_url, None).await;

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

/// 使用 Refresh Token 刷新完整的 MS -> Xbox -> MC 认证链
pub async fn refresh_microsoft_token<R: Runtime>(
    app: &AppHandle<R>,
    refresh_token: &str,
) -> Result<Account, String> {
    let (ms_access_token, new_refresh_token) =
        microsoft::refresh_token(refresh_token).await?;

    let (xsts_token, uhs) = xbox::authenticate(&ms_access_token).await?;
    let mc_token = minecraft::auth_minecraft(&xsts_token, &uhs).await?;
    let profile = minecraft::get_minecraft_profile(&mc_token).await?;

    let skin_url = profile.skins.first().map(|s| s.url.as_str());
    let _ = minecraft::cache_account_assets(app, &profile.id, &profile.id, skin_url, None).await;

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

/// 获取衣柜 Profile（含 Profile 资产缓存）
pub async fn get_wardrobe_profile<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
) -> Result<McProfile, String> {
    let profile = minecraft::get_minecraft_profile(access_token).await?;
    wardrobe::cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

/// 上传并应用一个皮肤到 Minecraft 服务
pub async fn apply_wardrobe_skin<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    source_path: &str,
    variant: &str,
) -> Result<McProfile, String> {
    let resolved_variant = wardrobe::normalize_skin_variant(variant)?;
    let source = Path::new(source_path);

    if !source.exists() || !source.is_file() {
        return Err("选中的皮肤文件不存在".to_string());
    }

    let file_bytes =
        std::fs::read(source).map_err(|e| format!("读取皮肤文件失败: {}", e))?;
    let file_name = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("skin.png");

    minecraft::upload_skin(access_token, &file_bytes, file_name, resolved_variant).await?;

    // 检测 source_path 是否在库路径中，如果是，则提取 ID 以防止同步时产生副本
    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid).unwrap_or_default();
    let forced_id = if source.starts_with(&assets_dir) {
        source
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
    } else {
        None
    };

    let profile = minecraft::get_minecraft_profile(access_token).await?;
    wardrobe::cache_profile_assets(app, account_uuid, &profile, forced_id.as_deref()).await;
    Ok(profile)
}

/// 使用当前已激活的皮肤文件重新上传，仅更改变体
pub async fn update_active_wardrobe_skin_variant<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    variant: &str,
) -> Result<McProfile, String> {
    let source = paths::active_account_skin_path(app, account_uuid)?;
    apply_wardrobe_skin(
        app,
        access_token,
        account_uuid,
        source.to_string_lossy().as_ref(),
        variant,
    )
    .await
}

/// 切换激活的披风
pub async fn set_active_cape<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
    cape_id: &str,
) -> Result<McProfile, String> {
    minecraft::set_active_cape_api(access_token, cape_id).await?;
    let profile = minecraft::get_minecraft_profile(access_token).await?;
    wardrobe::cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

/// 卸下当前披风
pub async fn clear_active_cape<R: Runtime>(
    app: &AppHandle<R>,
    access_token: &str,
    account_uuid: &str,
) -> Result<McProfile, String> {
    minecraft::clear_active_cape_api(access_token).await?;
    let profile = minecraft::get_minecraft_profile(access_token).await?;
    wardrobe::cache_profile_assets(app, account_uuid, &profile, None).await;
    Ok(profile)
}

// ==========================================
// Re-export: 衣柜皮肤库操作（直接委托）
// ==========================================

pub use wardrobe::get_wardrobe_skin_library;
pub use wardrobe::save_wardrobe_skin_asset;
pub use wardrobe::delete_wardrobe_skin_asset;
pub use wardrobe::set_wardrobe_skin_asset_variant;
pub use wardrobe::set_active_wardrobe_skin_offline;

// ==========================================
// Re-export: 离线账号与资产工具（直接委托）
// ==========================================

pub use offline::generate_offline_uuid;
pub use offline::upload_offline_skin;
pub use offline::delete_offline_account_dir;
pub use minecraft::cache_account_assets;
pub use minecraft::get_or_fetch_account_avatar;
pub use minecraft::fetch_and_save_mojang_skin;
