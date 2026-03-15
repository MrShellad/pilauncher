use std::path::Path;

use serde_json::Value;

use crate::error::AppResult;

/// 游戏核心部分：负责加载并解析版本清单 JSON
pub async fn load_version_manifest(
    global_mc_root: &Path,
    version_id: &str,
) -> AppResult<Value> {
    let json_path = global_mc_root
        .join("versions")
        .join(version_id)
        .join(format!("{}.json", version_id));

    let json_content = tokio::fs::read_to_string(&json_path).await?;
    let manifest: Value = serde_json::from_str(&json_content).map_err(|e| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("解析版本清单 JSON 失败: {}", e),
        )
    })?;

    Ok(manifest)
}

