// src-tauri/src/services/instance/advancement_dict_loader.rs
//! Minecraft 成就字典 JSON 加载器
//! 支持内嵌原版 JSON 字典兜底 + 外部用户自制/扩展字典热合并导入 SQLite

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;

use crate::domain::achievement::AdvancementMetadataCache;
use crate::services::db_service::achievement_repo;

/// 单条成就字典项配置
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancementDictEntry {
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub frame_type: Option<String>,
    #[serde(default)]
    pub icon: Option<String>,
    #[serde(default)]
    pub parent_id: Option<String>,
}

/// 字典 JSON 文件根对象
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancementDictFile {
    pub name: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
    #[serde(default)]
    pub advancements: HashMap<String, AdvancementDictEntry>,
}

pub struct AdvancementDictionaryLoader;

impl AdvancementDictionaryLoader {
    /// 内置原版 26.2+ 官方成就 JSON（随二进制编译内嵌，确保离线与初次启动零 I/O 兜底）
    pub const EMBEDDED_VANILLA_JSON: &'static str =
        include_str!("../../../assets/advancements/vanilla.json");

    /// 解析一段 JSON 文本为成就项列表
    pub fn parse_dict_json(
        json_str: &str,
        source_type: &str,
        source_hash: &str,
    ) -> Result<Vec<AdvancementMetadataCache>, String> {
        let parsed: AdvancementDictFile = serde_json::from_str(json_str)
            .map_err(|e| format!("解析成就字典 JSON 失败: {}", e))?;

        let now = Utc::now().timestamp_millis();
        let mut list = Vec::with_capacity(parsed.advancements.len());

        for (adv_id, entry) in parsed.advancements {
            let namespace = adv_id.split(':').next().unwrap_or("minecraft").to_string();
            let frame_type = entry.frame_type.unwrap_or_else(|| "task".to_string());
            let icon_rel_path = entry.icon.unwrap_or_default();

            list.push(AdvancementMetadataCache {
                advancement_id: adv_id,
                namespace,
                parent_id: entry.parent_id,
                title: entry.title,
                description: entry.description,
                frame_type,
                icon_rel_path,
                source_type: source_type.to_string(),
                source_hash: Some(source_hash.to_string()),
                updated_at: now,
            });
        }

        Ok(list)
    }

    /// 获取所有外部成就字典搜索目录
    /// 1. `<base_dir>/advancements/*.json`
    /// 2. `<base_dir>/advancements/custom/*.json`
    pub fn get_external_dict_dirs(base_dir: &Path) -> Vec<PathBuf> {
        vec![
            base_dir.join("advancements"),
            base_dir.join("advancements").join("custom"),
        ]
    }

    /// 加载并合并所有成就字典（内置原版 + 外部自定义文件）
    /// 外部自定义文件可任意覆盖或新增成就条目
    pub fn load_all_metadata(base_dir: &Path) -> Vec<AdvancementMetadataCache> {
        let mut merged_map: HashMap<String, AdvancementMetadataCache> = HashMap::new();

        // 1. 先加载内置官方原版字典 (vanilla)
        let vanilla_hash = format!("{:x}", md5::compute(Self::EMBEDDED_VANILLA_JSON.as_bytes()));
        if let Ok(vanilla_list) = Self::parse_dict_json(
            Self::EMBEDDED_VANILLA_JSON,
            "vanilla",
            &vanilla_hash,
        ) {
            for item in vanilla_list {
                merged_map.insert(item.advancement_id.clone(), item);
            }
        }

        // 2. 扫描外部目录中的所有 JSON 文件（按文件名排序并覆盖）
        let external_dirs = Self::get_external_dict_dirs(base_dir);
        for dir in external_dirs {
            if !dir.is_dir() {
                continue;
            }

            if let Ok(entries) = fs::read_dir(&dir) {
                let mut files: Vec<_> = entries
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| p.extension().map_or(false, |ext| ext == "json"))
                    .collect();

                files.sort();

                for file in files {
                    if let Ok(content) = fs::read_to_string(&file) {
                        let file_hash = format!("{:x}", md5::compute(content.as_bytes()));
                        let source_name = file
                            .file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "custom".to_string());

                        if let Ok(custom_list) = Self::parse_dict_json(
                            &content,
                            &format!("custom:{}", source_name),
                            &file_hash,
                        ) {
                            for item in custom_list {
                                merged_map.insert(item.advancement_id.clone(), item);
                            }
                        }
                    }
                }
            }
        }

        merged_map.into_values().collect()
    }

    /// 将所有成就字典元数据同步并 upsert 到 SQLite `advancement_metadata_cache`
    pub async fn sync_dictionaries_to_db(
        pool: &SqlitePool,
        base_dir: &Path,
    ) -> Result<usize, String> {
        let all_meta = Self::load_all_metadata(base_dir);
        let count = all_meta.len();

        if count > 0 {
            achievement_repo::upsert_metadata_cache(pool, &all_meta)
                .await
                .map_err(|e| format!("同步成就字典到数据库失败: {}", e))?;
        }

        Ok(count)
    }

    /// 单个成就元数据解析（优先从 DB 查询；若未命中则触发同步或语言包兜底）
    pub async fn resolve_single_metadata(
        pool: &SqlitePool,
        base_dir: &Path,
        advancement_id: &str,
    ) -> AdvancementMetadataCache {
        if let Ok(Some(cached)) = achievement_repo::query_metadata_cache_by_id(pool, advancement_id).await {
            return cached;
        }

        // 如果数据库尚未入库，触发一次字典同步再查
        let _ = Self::sync_dictionaries_to_db(pool, base_dir).await;
        if let Ok(Some(cached)) = achievement_repo::query_metadata_cache_by_id(pool, advancement_id).await {
            return cached;
        }

        // 最终兜底：从外部语言包翻译或 ID 推断
        let fallback = crate::services::instance::translation_loader::TranslationLoader::resolve_advancement_metadata(
            base_dir,
            advancement_id,
        );
        let _ = achievement_repo::upsert_metadata_cache(pool, &[fallback.clone()]).await;
        fallback
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_parse_embedded_vanilla_json() {
        let vanilla_hash = format!("{:x}", md5::compute(AdvancementDictionaryLoader::EMBEDDED_VANILLA_JSON.as_bytes()));
        let list = AdvancementDictionaryLoader::parse_dict_json(
            AdvancementDictionaryLoader::EMBEDDED_VANILLA_JSON,
            "vanilla",
            &vanilla_hash,
        ).expect("必须成功解析内置原版 JSON 字典");

        assert!(list.len() >= 100, "原版成就条目数应不少于 100 条，当前解析: {}", list.len());

        let bullseye = list.iter().find(|i| i.advancement_id == "minecraft:adventure/bullseye");
        assert!(bullseye.is_some());
        let bullseye = bullseye.unwrap();
        assert_eq!(bullseye.title, "靶心");
        assert_eq!(bullseye.frame_type, "challenge");

        // 验证 1.21/26.2 新成就
        let crafter = list.iter().find(|i| i.advancement_id == "minecraft:adventure/crafter_crafting_crafter");
        assert!(crafter.is_some());
        let crafter = crafter.unwrap();
        assert_eq!(crafter.title, "合成者造合成者");
        assert_eq!(crafter.frame_type, "challenge");
    }

    #[test]
    fn test_custom_dictionary_override() {
        let base_dir = std::env::temp_dir().join(format!("test_dict_{}", Uuid::new_v4()));
        let custom_dir = base_dir.join("advancements").join("custom");
        fs::create_dir_all(&custom_dir).unwrap();

        let custom_json = r#"{
            "name": "我的自制成就包",
            "advancements": {
                "minecraft:story/smelt_iron": {
                    "title": "超级熔炼铁锭",
                    "description": "这是玩家自定义修改后的描述",
                    "frameType": "challenge",
                    "icon": "iron_ingot"
                },
                "mymod:custom/fly": {
                    "title": "飞天遁地",
                    "description": "自定义模组的成就",
                    "frameType": "goal",
                    "icon": "elytra"
                }
            }
        }"#;

        fs::write(custom_dir.join("my_pack.json"), custom_json).unwrap();

        let merged = AdvancementDictionaryLoader::load_all_metadata(&base_dir);

        // 验证覆盖了原版的 smelt_iron
        let smelt = merged.iter().find(|i| i.advancement_id == "minecraft:story/smelt_iron").unwrap();
        assert_eq!(smelt.title, "超级熔炼铁锭");
        assert_eq!(smelt.frame_type, "challenge");

        // 验证新增了自定义成就
        let fly = merged.iter().find(|i| i.advancement_id == "mymod:custom/fly").unwrap();
        assert_eq!(fly.title, "飞天遁地");
        assert_eq!(fly.frame_type, "goal");

        let _ = fs::remove_dir_all(base_dir);
    }
}
