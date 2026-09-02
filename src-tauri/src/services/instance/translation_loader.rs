// src-tauri/src/services/instance/translation_loader.rs
use once_cell::sync::Lazy;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;

use crate::domain::achievement::AdvancementMetadataCache;

static LANG_MAP_CACHE: Lazy<Mutex<HashMap<String, HashMap<String, String>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub struct TranslationLoader;

impl TranslationLoader {
    /// 从外部路径加载指定命名空间的语言映射表 (仅纯文本 JSON，零 ZIP 开销)
    pub fn load_mod_lang_map(base_dir: &Path, mod_id: &str) -> HashMap<String, String> {
        let cache_key = mod_id.to_string();
        if let Ok(guard) = LANG_MAP_CACHE.lock() {
            if let Some(map) = guard.get(&cache_key) {
                return map.clone();
            }
        }

        let mut result_map = HashMap::new();

        // 检索路径候选列表（优先 MC 标准资源包路径，兼顾平铺路径）
        let candidates = [
            base_dir.join("translations").join("assets").join(mod_id).join("lang").join("zh_cn.json"),
            base_dir.join("translations").join(mod_id).join("lang").join("zh_cn.json"),
            base_dir.join("translations").join(mod_id).join("zh_cn.json"),
            base_dir.join("translations").join("assets").join(mod_id).join("lang").join("en_us.json"),
            base_dir.join("translations").join(mod_id).join("en_us.json"),
        ];

        for path in &candidates {
            if path.is_file() {
                if let Ok(content) = fs::read_to_string(path) {
                    if let Ok(json) = serde_json::from_str::<Value>(&content) {
                        if let Some(obj) = json.as_object() {
                            for (k, v) in obj {
                                if let Some(s) = v.as_str() {
                                    result_map.insert(k.clone(), s.to_string());
                                }
                            }
                            if !result_map.is_empty() {
                                break;
                            }
                        }
                    }
                }
            }
        }

        if let Ok(mut guard) = LANG_MAP_CACHE.lock() {
            guard.insert(cache_key, result_map.clone());
        }

        result_map
    }

    /// 格式化兜底标题 (如 "all_bell_peppers" -> "All Bell Peppers")
    pub fn format_id_to_title(name: &str) -> String {
        name.replace('_', " ")
            .split_whitespace()
            .map(|word| {
                let mut c = word.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                }
            })
            .collect::<Vec<_>>()
            .join(" ")
    }

    /// 解析单个成就的元数据展示信息（标题、描述、图标、框架类型、分类）
    pub fn resolve_advancement_metadata(
        base_dir: &Path,
        advancement_id: &str,
    ) -> AdvancementMetadataCache {
        let now = chrono::Utc::now().timestamp_millis();

        // 1. 原版或用户自制成就字典优先匹配 (全量由 JSON 驱动，支持玩家外部自制扩展与热覆盖)
        let dict_list = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::load_all_metadata(base_dir);
        if let Some(matched) = dict_list.into_iter().find(|i| i.advancement_id == advancement_id) {
            return matched;
        }

        // 2. 模组成就：解析命名空间与路径
        let (namespace, subpath) = match advancement_id.split_once(':') {
            Some((ns, path)) => (ns, path),
            None => ("minecraft", advancement_id),
        };

        let path_parts: Vec<&str> = subpath.split('/').collect();
        let tail_name = path_parts.last().copied().unwrap_or(subpath);

        // 标准翻译键推导列表
        let title_candidates = [
            format!("advancements.{}.{}.title", namespace, tail_name),
            format!("advancements.{}.{}.title", namespace, subpath.replace('/', ".")),
            format!("advancement.{}.{}", namespace, tail_name),
            format!("advancement.{}.{}.title", namespace, tail_name),
        ];

        let desc_candidates = [
            format!("advancements.{}.{}.description", namespace, tail_name),
            format!("advancements.{}.{}.description", namespace, subpath.replace('/', ".")),
            format!("advancement.{}.{}.desc", namespace, tail_name),
            format!("advancement.{}.{}.description", namespace, tail_name),
        ];

        let lang_map = Self::load_mod_lang_map(base_dir, namespace);

        let mut resolved_title = None;
        for key in &title_candidates {
            if let Some(val) = lang_map.get(key) {
                resolved_title = Some(val.clone());
                break;
            }
        }

        let mut resolved_desc = None;
        for key in &desc_candidates {
            if let Some(val) = lang_map.get(key) {
                resolved_desc = Some(val.clone());
                break;
            }
        }

        let final_title = resolved_title.unwrap_or_else(|| Self::format_id_to_title(tail_name));
        let frame_type = if advancement_id.contains("challenge") || advancement_id.contains("kill_all") {
            "challenge"
        } else if advancement_id.contains("goal") {
            "goal"
        } else {
            "task"
        };

        AdvancementMetadataCache {
            advancement_id: advancement_id.to_string(),
            namespace: namespace.to_string(),
            parent_id: None,
            title: final_title,
            description: resolved_desc,
            frame_type: frame_type.to_string(),
            icon_rel_path: tail_name.to_string(),
            source_type: "mod".to_string(),
            source_hash: None,
            updated_at: now,
        }
    }
}
