// src-tauri/src/services/auth/wardrobe.rs
//
// 本地皮肤库 (Wardrobe) 的皮肤资产 CRUD 与元数据管理。
// 负责 SkinMetadata 的持久化、资产同步、皮肤库 finalize 等核心逻辑。

use crate::domain::auth::{McProfile, WardrobeSkinAsset, WardrobeSkinLibrary};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Runtime};

use super::minecraft;
use super::paths;

// ==========================================
// 皮肤元数据模型（内部使用，不暴露给前端）
// ==========================================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct SkinMetadataEntry {
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
pub struct SkinMetadata {
    #[serde(default)]
    pub user_id: String,
    #[serde(default)]
    pub current_skin_id: String,
    #[serde(default)]
    pub skins: Vec<SkinMetadataEntry>,
}

// ==========================================
// 皮肤模型/变体规范化
// ==========================================

pub fn normalize_skin_variant(variant: &str) -> Result<&'static str, String> {
    match variant.trim().to_ascii_lowercase().as_str() {
        "classic" | "default" => Ok("classic"),
        "slim" => Ok("slim"),
        _ => Err("皮肤模型只支持 classic 或 slim".to_string()),
    }
}

// ==========================================
// 元数据 IO
// ==========================================

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
    let bytes = fs::read(path).map_err(|e| format!("读取皮肤资产失败: {}", e))?;
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
    let skin_path = paths::active_account_skin_path(app, account_uuid)?;
    if !skin_path.exists() || !skin_path.is_file() {
        return Ok(None);
    }

    hash_file(&skin_path).map(Some)
}

// ==========================================
// 核心：皮肤同步与 finalize
// ==========================================

fn sync_active_runtime_skin_into_library<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    variant: Option<&str>,
    source: &str,
    forced_asset_id: Option<&str>,
) -> Result<(), String> {
    let runtime_skin_path = paths::active_account_skin_path(app, account_uuid)?;
    if !runtime_skin_path.exists() || !runtime_skin_path.is_file() {
        return Ok(());
    }

    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
    let bytes = fs::read(&runtime_skin_path).map_err(|e| format!("读取当前皮肤失败: {}", e))?;
    let content_hash = format!("{:x}", md5::compute(&bytes));
    let resolved_variant = variant
        .map(normalize_skin_variant)
        .transpose()?
        .unwrap_or("classic")
        .to_string();

    fs::create_dir_all(&assets_dir).map_err(|e| format!("创建皮肤资产目录失败: {}", e))?;

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
        let target_path = paths::skin_asset_file_path(&assets_dir, &new_id);
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
    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
    let original_len = stored.skins.len();
    let mut should_persist = false;

    stored.skins.retain(|asset| {
        if asset.is_deleted {
            return false;
        }
        let abs_path = paths::skin_asset_file_path(&assets_dir, &asset.id);
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
        None if !stored.current_skin_id.is_empty()
            && !stored
                .skins
                .iter()
                .any(|asset| asset.id == stored.current_skin_id) =>
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
                let abs_path = paths::skin_asset_file_path(&assets_dir, &asset.id);
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

/// 缓存 Profile 资产并将活跃皮肤同步到库中
pub async fn cache_profile_assets<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    profile: &McProfile,
    forced_skin_id: Option<&str>,
) {
    let _ = minecraft::cache_account_assets(
        app,
        account_uuid,
        &profile.id,
        minecraft::active_skin_url(profile),
        minecraft::active_cape_url(profile),
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

// ==========================================
// 衣柜公开 API
// ==========================================

/// 获取皮肤库完整列表
pub fn get_wardrobe_skin_library<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<WardrobeSkinLibrary, String> {
    sync_active_runtime_skin_into_library(app, account_uuid, None, "sync", None)?;
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
    let stored = read_stored_skin_library(&manifest_path)?;
    finalize_skin_library(app, account_uuid, stored, true)
}

/// 保存一个新的皮肤资产到库中
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
    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid)?;
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;

    fs::create_dir_all(&assets_dir).map_err(|e| format!("创建皮肤资产目录失败: {}", e))?;

    let mut stored = read_stored_skin_library(&manifest_path)?;

    // Assign user_id if missing
    if stored.user_id.is_empty() {
        stored.user_id = account_uuid.to_string();
    }

    stored.skins.retain(|asset| {
        !asset.is_deleted && paths::skin_asset_file_path(&assets_dir, &asset.id).is_file()
    });

    // Check if hash already exists
    if let Some(existing_asset) = stored
        .skins
        .iter_mut()
        .find(|asset| asset.hash == content_hash)
    {
        existing_asset.model = resolved_variant;
    } else {
        let new_id = next_skin_asset_id(&stored);
        let target_path = paths::skin_asset_file_path(&assets_dir, &new_id);
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

/// 删除一个皮肤资产
pub fn delete_wardrobe_skin_asset<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
    let mut stored = read_stored_skin_library(&manifest_path)?;
    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid)?;
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

    let asset_path = paths::skin_asset_file_path(&assets_dir, &removed_asset.id);
    removed_asset.url = asset_path.to_string_lossy().to_string();
    if asset_path.exists() {
        fs::remove_file(&removed_asset.url).map_err(|e| format!("物理删除皮肤文件失败: {}", e))?;
    }

    write_stored_skin_library(&manifest_path, &stored)?;
    finalize_skin_library(app, account_uuid, stored, false)
}

/// 修改某个皮肤资产的变体 (classic / slim)
pub fn set_wardrobe_skin_asset_variant<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
    variant: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let resolved_variant = normalize_skin_variant(variant)?.to_string();
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
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

/// 离线模式：将某个库中的皮肤设为当前激活皮肤
pub fn set_active_wardrobe_skin_offline<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
    asset_id: &str,
) -> Result<WardrobeSkinLibrary, String> {
    let manifest_path = paths::wardrobe_skin_library_path(app, account_uuid)?;
    let mut stored = read_stored_skin_library(&manifest_path)?;

    let assets_dir = paths::wardrobe_skin_assets_dir(app, account_uuid)?;
    let target_asset = stored
        .skins
        .iter()
        .find(|asset| asset.id == asset_id)
        .ok_or_else(|| "未找到指定的皮肤资产".to_string())?;

    let source_path = assets_dir.join(format!("{}.png", target_asset.id));

    stored.current_skin_id = asset_id.to_string();
    write_stored_skin_library(&manifest_path, &stored)?;

    // physical copy to runtime/accounts/{uuid}/skin.png
    super::offline::upload_offline_skin(app, account_uuid, source_path.to_string_lossy().as_ref())?;

    finalize_skin_library(app, account_uuid, stored, false)
}
