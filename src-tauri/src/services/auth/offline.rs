// src-tauri/src/services/auth/offline.rs
//
// 离线账号工具集：UUID 生成、离线皮肤上传、账号目录清理。

use std::fs;
use std::path::Path;
use tauri::{AppHandle, Runtime};
use uuid::Uuid;

use super::paths;

/// 根据离线用户名生成确定性 UUID (v3-like, OfflinePlayer 命名空间)
pub fn generate_offline_uuid(name: &str) -> String {
    let digest = md5::compute(format!("OfflinePlayer:{}", name));
    let mut bytes = *digest;
    bytes[6] = (bytes[6] & 0x0f) | 0x30;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(bytes).to_string()
}

/// 为离线账号上传/复制一个皮肤文件到运行时目录
pub fn upload_offline_skin<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
    source_path: &str,
) -> Result<String, String> {
    let target_dir = paths::account_runtime_dir(app, uuid)?;

    let source = Path::new(source_path);
    if !source.exists() {
        return Err("选中的图片不存在".to_string());
    }

    fs::create_dir_all(&target_dir).map_err(|e| format!("创建皮肤目录失败: {}", e))?;

    let target_path = target_dir.join("skin.png");
    fs::copy(source, &target_path).map_err(|e| format!("复制皮肤失败: {}", e))?;

    Ok(target_path.to_string_lossy().to_string())
}

/// 删除离线账号的本地资源目录
pub fn delete_offline_account_dir<R: Runtime>(
    app: &AppHandle<R>,
    uuid: &str,
) -> Result<(), String> {
    let target_dir = paths::account_runtime_dir(app, uuid)?;

    if target_dir.exists() {
        fs::remove_dir_all(&target_dir).map_err(|e| format!("物理删除账号目录失败: {}", e))?;
    }

    Ok(())
}
