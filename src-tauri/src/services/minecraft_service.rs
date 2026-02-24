// src-tauri/src/services/minecraft_service.rs
use crate::domain::minecraft::{RemoteVersionManifest, VersionGroup, McVersion};
use crate::error::AppResult;
use std::collections::BTreeMap;
use regex::Regex;
use tokio::sync::RwLock;
use once_cell::sync::Lazy;

static VERSION_CACHE: Lazy<RwLock<Option<Vec<VersionGroup>>>> = Lazy::new(|| RwLock::new(None));

pub struct McMetadataService;

const MANIFEST_URL: &str = "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";

impl McMetadataService {
    pub async fn fetch_remote_versions(force_refresh: bool) -> AppResult<Vec<VersionGroup>> {
        if !force_refresh {
            let cache = VERSION_CACHE.read().await;
            if let Some(ref data) = *cache { return Ok(data.clone()); }
        }

        let client = reqwest::Client::builder().user_agent("OreLauncher/1.0").build()?;
        let response = client.get(MANIFEST_URL).send().await?.json::<RemoteVersionManifest>().await?;

        // 1. 准备更精细的正则表达式
        let re_rc = Regex::new(r"^([\d\.]+)-rc\d+$").unwrap();       // 匹配 1.21.2-rc1
        let re_pre = Regex::new(r"^([\d\.]+)-pre\d+$").unwrap();     // 匹配 1.21.2-pre2
        let re_snapshot_w = Regex::new(r"^(\d{2})w\d+[a-z]$").unwrap();
        let re_snapshot_ver = Regex::new(r"^([\d\.]+)-snapshot-\d+$").unwrap();

        let mut groups_map: BTreeMap<String, (String, Vec<McVersion>)> = BTreeMap::new();

        for v in response.versions {
            let id = &v.id;
            
            // 2. 动态计算分组显示名称，不再放入统一分组
            let group_display = if let Some(caps) = re_rc.captures(id) {
                format!("{} 候选版 (RC)", &caps[1])
            } else if let Some(caps) = re_pre.captures(id) {
                format!("{} 预发布版 (Pre)", &caps[1])
            } else if v.r#type == "release" {
                let parts: Vec<&str> = id.split('.').collect();
                if parts.len() >= 2 { format!("Minecraft {}.{}", parts[0], parts[1]) } else { format!("Minecraft {}", id) }
            } else if v.r#type == "snapshot" {
                if let Some(caps) = re_snapshot_w.captures(id) {
                    format!("快照 20{}", &caps[1])
                } else if let Some(caps) = re_snapshot_ver.captures(id) {
                    format!("快照 {}", &caps[1])
                } else {
                    "其他快照".to_string()
                }
            } else {
                "其他版本".to_string()
            };

            let group_data = groups_map.entry(group_display.clone()).or_insert((group_display, Vec::new()));

            group_data.1.push(McVersion {
                id: id.clone(),
                r#type: v.r#type.clone(),
                release_time: v.release_time.split('T').next().unwrap_or("").to_string(),
                wiki_url: format!("https://minecraft.wiki/w/Java_Edition_{}", id),
            });
        }

        // 3. 转换并按时间线进行全局排序
        let mut result: Vec<VersionGroup> = groups_map
            .into_iter()
            .map(|(_, (name, mut versions))| {
                versions.sort_by(|a, b| b.release_time.cmp(&a.release_time));
                VersionGroup { group_name: name, versions }
            })
            .collect();

        result.sort_by(|a, b| {
            let latest_a = a.versions.first().map(|v| &v.release_time);
            let latest_b = b.versions.first().map(|v| &v.release_time);
            latest_b.cmp(&latest_a)
        });

        let mut cache = VERSION_CACHE.write().await;
        *cache = Some(result.clone());
        Ok(result)
    }
}