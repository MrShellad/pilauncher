// src-tauri/src/services/loader_service.rs
use crate::domain::loader::{FabricLoaderMeta, BmclApiLoaderVersion};
use crate::error::AppResult;
use reqwest::Client;
use tokio::sync::RwLock;
use once_cell::sync::Lazy;
use std::collections::HashMap;

// 缓存设计：Key 为 "fabric_1.20.1", Value 为 ["0.15.7", "0.15.6"...]
static LOADER_CACHE: Lazy<RwLock<HashMap<String, Vec<String>>>> = Lazy::new(|| RwLock::new(HashMap::new()));

pub struct LoaderMetadataService;

impl LoaderMetadataService {
    pub async fn fetch_loader_versions(loader_type: &str, game_version: &str) -> AppResult<Vec<String>> {
        let cache_key = format!("{}_{}", loader_type.to_lowercase(), game_version);

        // 1. 检查缓存
        {
            let cache = LOADER_CACHE.read().await;
            if let Some(versions) = cache.get(&cache_key) {
                return Ok(versions.clone());
            }
        }

        let client = Client::builder()
            .user_agent("OreLauncher/1.0")
            .build()?;

        let mut versions = Vec::new();

        // 2. 根据不同的 Loader 请求不同的 API
        match loader_type.to_lowercase().as_str() {
            "fabric" => {
                let url = format!("https://meta.fabricmc.net/v2/versions/loader/{}", game_version);
                let res = client.get(&url).send().await?;
                if res.status().is_success() {
                    let data = res.json::<Vec<FabricLoaderMeta>>().await?;
                    versions = data.into_iter().map(|v| v.loader.version).collect();
                }
            }
            "forge" => {
                let url = format!("https://bmclapi2.bangbang93.com/forge/minecraft/{}", game_version);
                let res = client.get(&url).send().await?;
                if res.status().is_success() {
                    let data = res.json::<Vec<BmclApiLoaderVersion>>().await?;
                    versions = data.into_iter().map(|v| v.version).collect();
                }
            }
            "neoforge" => {
                let url = format!("https://bmclapi2.bangbang93.com/neoforge/list/{}", game_version);
                let res = client.get(&url).send().await?;
                if res.status().is_success() {
                    let data = res.json::<Vec<BmclApiLoaderVersion>>().await?;
                    versions = data.into_iter().map(|v| v.version).collect();
                }
            }
            _ => {}
        }

        // 3. 写入缓存并返回
        let mut cache = LOADER_CACHE.write().await;
        cache.insert(cache_key, versions.clone());

        Ok(versions)
    }
}