// src-tauri/src/services/auth/paths.rs
//
// 集中式路径解析器。
// 将所有 "runtime/accounts/{uuid}/skin.png" 等路径拼接逻辑集中管理，
// 消除 ConfigService::get_base_path(app) 散落在业务代码中的耦合。

use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};

use crate::services::config_service::ConfigService;

/// 获取账号的运行时资源目录: `{base}/runtime/accounts/{uuid}`
pub fn account_runtime_dir<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|_| "无法读取配置目录".to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    Ok(PathBuf::from(base_path_str)
        .join("runtime")
        .join("accounts")
        .join(account_uuid))
}

/// 获取账号皮肤库资产的存储目录: `{base}/config/skins/{uuid}`
pub fn wardrobe_skin_assets_dir<R: Runtime>(
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

/// 获取皮肤库元数据文件路径: `{base}/config/skins/{uuid}/metadata.json`
pub fn wardrobe_skin_library_path<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    Ok(wardrobe_skin_assets_dir(app, account_uuid)?.join("metadata.json"))
}

/// 获取当前激活皮肤的文件路径: `{base}/runtime/accounts/{uuid}/skin.png`
pub fn active_account_skin_path<R: Runtime>(
    app: &AppHandle<R>,
    account_uuid: &str,
) -> Result<PathBuf, String> {
    Ok(account_runtime_dir(app, account_uuid)?.join("skin.png"))
}

/// 获取某个皮肤资产文件的绝对路径: `{assets_dir}/{asset_id}.png`
pub fn skin_asset_file_path(assets_dir: &Path, asset_id: &str) -> PathBuf {
    assets_dir.join(format!("{}.png", asset_id))
}
