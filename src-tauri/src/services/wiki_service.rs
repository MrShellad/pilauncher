// src-tauri/src/services/wiki_service.rs
use regex::Regex;
use serde::Deserialize;
use std::collections::HashMap;

/// 内嵌编译期加载的 wiki_rules.json
const WIKI_RULES_JSON: &str = include_str!("../../../src/assets/config/wiki_rules.json");

#[derive(Debug, Deserialize)]
struct WikiLangRule {
    url_template: String,
    replacements: Vec<WikiReplacement>,
}

#[derive(Debug, Deserialize)]
struct WikiReplacement {
    pattern: String,
    replace: String,
}

pub struct WikiService;

impl WikiService {
    /// 根据版本号和客户端语言代码生成对应语言的 Wiki URL
    ///
    /// - `version_id`: Minecraft 版本号，例如 "26.1-snapshot-1", "26.1.2-rc-1", "26.1-pre-3", "1.21.4"
    /// - `lang`: 客户端语言代码，例如 "zh-CN", "en-US", "ja"
    pub fn resolve_wiki_url(version_id: &str, lang: &str) -> String {
        let rules: HashMap<String, WikiLangRule> = match serde_json::from_str(WIKI_RULES_JSON) {
            Ok(r) => r,
            Err(_) => {
                // JSON 解析失败时回退到英文 Wiki 默认格式
                return format!(
                    "https://minecraft.wiki/w/Java_Edition_{}",
                    version_id
                );
            }
        };

        // 根据语言前缀匹配规则：zh-CN / zh-TW -> zh, ja -> ja, 其余 -> en
        let lang_key = Self::resolve_lang_key(lang);

        let rule = match rules.get(&lang_key) {
            Some(r) => r,
            None => {
                // 未找到匹配的语言规则，回退到英文
                return format!(
                    "https://minecraft.wiki/w/Java_Edition_{}",
                    version_id
                );
            }
        };

        // 按顺序应用所有正则替换规则
        let mut processed_version = version_id.to_string();
        for replacement in &rule.replacements {
            if let Ok(re) = Regex::new(&replacement.pattern) {
                processed_version = re
                    .replace_all(&processed_version, replacement.replace.as_str())
                    .to_string();
            }
        }

        // 将处理后的版本号插入 URL 模板
        rule.url_template.replace("{version}", &processed_version)
    }

    /// 将客户端语言代码映射到 wiki_rules.json 中的键
    fn resolve_lang_key(lang: &str) -> String {
        let lower = lang.to_lowercase();
        if lower.starts_with("zh") {
            "zh".to_string()
        } else if lower.starts_with("ja") {
            "ja".to_string()
        } else {
            "en".to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_release_version() {
        let url = WikiService::resolve_wiki_url("1.21.4", "en-US");
        assert_eq!(url, "https://minecraft.wiki/w/Java_Edition_1.21.4");
    }

    #[test]
    fn test_snapshot_zh() {
        let url = WikiService::resolve_wiki_url("26.1-snapshot-1", "zh-CN");
        assert_eq!(url, "https://zh.minecraft.wiki/w/Java%E7%89%8826.1-snapshot-1");
    }

    #[test]
    fn test_snapshot_en() {
        let url = WikiService::resolve_wiki_url("26.1-snapshot-1", "en-US");
        assert_eq!(url, "https://minecraft.wiki/w/Java_Edition_26.1_Snapshot_1");
    }

    #[test]
    fn test_snapshot_ja() {
        let url = WikiService::resolve_wiki_url("26.1-snapshot-1", "ja");
        assert_eq!(url, "https://ja.minecraft.wiki/w/Java_Edition_26.1_Snapshot_1");
    }

    #[test]
    fn test_rc_zh() {
        let url = WikiService::resolve_wiki_url("26.1.2-rc-1", "zh-CN");
        assert_eq!(url, "https://zh.minecraft.wiki/w/Java%E7%89%8826.1.2-rc-1");
    }

    #[test]
    fn test_rc_en() {
        let url = WikiService::resolve_wiki_url("26.1.2-rc-1", "en-US");
        assert_eq!(url, "https://minecraft.wiki/w/Java_Edition_26.1.2_Release_Candidate_1");
    }

    #[test]
    fn test_rc_ja() {
        let url = WikiService::resolve_wiki_url("26.1.2-rc-1", "ja");
        assert_eq!(url, "https://ja.minecraft.wiki/w/Java_Edition_26.1.2_Release_Candidate_1");
    }

    #[test]
    fn test_pre_zh() {
        let url = WikiService::resolve_wiki_url("26.1-pre-3", "zh-CN");
        assert_eq!(url, "https://zh.minecraft.wiki/w/Java%E7%89%8826.1-pre-3");
    }

    #[test]
    fn test_pre_en() {
        let url = WikiService::resolve_wiki_url("26.1-pre-3", "en-US");
        assert_eq!(url, "https://minecraft.wiki/w/Java_Edition_26.1_Pre-Release_3");
    }

    #[test]
    fn test_pre_ja() {
        let url = WikiService::resolve_wiki_url("26.1-pre-3", "ja");
        assert_eq!(url, "https://ja.minecraft.wiki/w/Java_Edition_26.1_Pre-Release_3");
    }
}
