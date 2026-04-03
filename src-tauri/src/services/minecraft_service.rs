// src-tauri/src/services/minecraft_service.rs
use crate::domain::minecraft::{McVersion, RemoteVersionManifest, VersionGroup};
use crate::error::AppResult;
use crate::services::config_service::ConfigService;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::BTreeMap;
use std::time::Duration;
use tauri::{AppHandle, Runtime};
use tokio::sync::RwLock;

static VERSION_CACHE: Lazy<RwLock<Option<(String, Vec<VersionGroup>)>>> =
    Lazy::new(|| RwLock::new(None));

const BUNDLED_MCV_JSON: &str = include_str!("../../../src/assets/download/mcv.json");

pub struct McMetadataService;

#[derive(Debug, serde::Deserialize)]
struct BundledMcVersions {
    versions: Vec<String>,
}

const OFFICIAL_MANIFEST_URL: &str =
    "https://launchermeta.mojang.com/mc/game/version_manifest_v2.json";
const BANGBANG93_MANIFEST_URL: &str =
    "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json";

impl McMetadataService {
    fn resolve_manifest_urls<R: Runtime>(app: &AppHandle<R>) -> Vec<String> {
        let dl_settings = ConfigService::get_download_settings(app);
        match dl_settings.minecraft_meta_source.as_str() {
            "official" => vec![
                OFFICIAL_MANIFEST_URL.to_string(),
                BANGBANG93_MANIFEST_URL.to_string(),
            ],
            "bangbang93" => vec![
                BANGBANG93_MANIFEST_URL.to_string(),
                OFFICIAL_MANIFEST_URL.to_string(),
            ],
            _ => vec![
                BANGBANG93_MANIFEST_URL.to_string(),
                OFFICIAL_MANIFEST_URL.to_string(),
            ],
        }
    }

    fn build_version_groups_from_ids(versions: Vec<String>) -> Vec<VersionGroup> {
        let mut groups_map: BTreeMap<String, Vec<McVersion>> = BTreeMap::new();

        for id in versions {
            let version_type = if id.contains("-rc") {
                "rc"
            } else if id.contains("-pre") {
                "pre"
            } else if id.contains("snapshot") || id.contains("experimental") {
                "snapshot"
            } else {
                "release"
            };

            let group_name = if version_type == "rc" {
                if let Some((major, _)) = id.split_once("-rc") {
                    format!("{} 候选版 (RC)", major)
                } else {
                    "候选版 (RC)".to_string()
                }
            } else if version_type == "pre" {
                if let Some((major, _)) = id.split_once("-pre") {
                    format!("{} 预发布版 (Pre)", major)
                } else {
                    "预发布版 (Pre)".to_string()
                }
            } else if version_type == "snapshot" {
                if id.chars().take(2).all(|c| c.is_ascii_digit()) && id.contains('w') {
                    format!("快照 {}", id)
                } else {
                    "其他快照".to_string()
                }
            } else {
                let parts: Vec<&str> = id.split('.').collect();
                if parts.len() >= 2 {
                    format!("Minecraft {}.{}", parts[0], parts[1])
                } else {
                    format!("Minecraft {}", id)
                }
            };

            groups_map.entry(group_name).or_default().push(McVersion {
                id: id.clone(),
                r#type: version_type.to_string(),
                release_time: String::new(),
                wiki_url: format!("https://minecraft.wiki/w/Java_Edition_{}", id),
            });
        }

        let mut result: Vec<VersionGroup> = groups_map
            .into_iter()
            .map(|(group_name, mut versions)| {
                versions.sort_by(|a, b| b.id.cmp(&a.id));
                VersionGroup {
                    group_name,
                    versions,
                }
            })
            .collect();

        result.sort_by(|a, b| a.group_name.cmp(&b.group_name).reverse());
        result
    }

    fn load_bundled_version_groups() -> Option<Vec<VersionGroup>> {
        let bundled: BundledMcVersions = serde_json::from_str(BUNDLED_MCV_JSON).ok()?;
        Some(Self::build_version_groups_from_ids(bundled.versions))
    }

    pub async fn fetch_remote_versions<R: Runtime>(
        app: &AppHandle<R>,
        force_refresh: bool,
    ) -> AppResult<Vec<VersionGroup>> {
        let manifest_urls = Self::resolve_manifest_urls(app);
        let manifest_url = manifest_urls
            .first()
            .cloned()
            .unwrap_or_else(|| BANGBANG93_MANIFEST_URL.to_string());

        // Fetch logic
        let mut manifest_content = String::new();
        let mut should_fetch = true;
        let base_path_str = ConfigService::get_base_path(app)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))?
            .unwrap_or_else(|| ".".to_string());

        let runtime_dir = std::path::PathBuf::from(base_path_str).join("runtime");
        let manifest_path = runtime_dir.join("version_manifest_v2.json");

        if !force_refresh {
            let cache = VERSION_CACHE.read().await;
            if let Some((cached_manifest_url, data)) = cache.as_ref() {
                if cached_manifest_url == &manifest_url {
                    // Cache hit but we should verify the file exists on disk, or just return data.
                    // The user said: "If cache hits, we should also read from the official manifest file [meaning the local disk file] and write it, for later verification."
                    if manifest_path.exists() {
                        return Ok(data.clone());
                    }
                }
            }
            if manifest_path.exists() {
                manifest_content = tokio::fs::read_to_string(&manifest_path)
                    .await
                    .unwrap_or_default();
                if !manifest_content.is_empty() {
                    should_fetch = false;
                }
            }
        }

        if should_fetch || manifest_content.is_empty() {
            let client = reqwest::Client::builder()
                .user_agent("PiLauncher/1.0")
                .timeout(Duration::from_secs(12))
                .build()?;
            let attempts = 3;
            let mut last_error: Option<String> = None;

            'fetch_attempts: for attempt in 1..=attempts {
                for candidate_url in &manifest_urls {
                    match client.get(candidate_url).send().await {
                        Ok(resp) if resp.status().is_success() => {
                            manifest_content = resp.text().await?;
                            let _ = tokio::fs::create_dir_all(&runtime_dir).await;
                            let _ = tokio::fs::write(&manifest_path, &manifest_content).await;
                            break 'fetch_attempts;
                        }
                        Ok(resp) if resp.status().as_u16() == 429 || resp.status().is_server_error() => {
                            last_error = Some(format!("{} from {}", resp.status(), candidate_url));
                        }
                        Ok(resp) => {
                            last_error = Some(format!("{} from {}", resp.status(), candidate_url));
                        }
                        Err(err) => {
                            last_error = Some(format!("{} from {}", err, candidate_url));
                        }
                    }
                }

                if attempt < attempts {
                    tokio::time::sleep(Duration::from_millis(600 * attempt as u64)).await;
                }
            }

            if manifest_content.is_empty() && manifest_path.exists() {
                manifest_content = tokio::fs::read_to_string(&manifest_path)
                    .await
                    .unwrap_or_default();
            }

            if manifest_content.is_empty() {
                if let Some(fallback) = Self::load_bundled_version_groups() {
                    let mut cache = VERSION_CACHE.write().await;
                    *cache = Some((manifest_url, fallback.clone()));
                    return Ok(fallback);
                }

                return Err(std::io::Error::new(
                    std::io::ErrorKind::Other,
                    format!(
                        "Failed to fetch version list: {}",
                        last_error.unwrap_or_else(|| "unknown error".to_string())
                    ),
                )
                .into());
            }
        }

        if manifest_content.is_empty() {
            if let Some(fallback) = Self::load_bundled_version_groups() {
                let mut cache = VERSION_CACHE.write().await;
                *cache = Some((manifest_url, fallback.clone()));
                return Ok(fallback);
            }
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Failed to fetch version list and no cached manifest was available",
            )
            .into());
        }

        let response: RemoteVersionManifest = match serde_json::from_str(&manifest_content) {
            Ok(parsed) => parsed,
            Err(err) => {
                if let Some(fallback) = Self::load_bundled_version_groups() {
                    let mut cache = VERSION_CACHE.write().await;
                    *cache = Some((manifest_url, fallback.clone()));
                    return Ok(fallback);
                }
                return Err(std::io::Error::new(
                    std::io::ErrorKind::InvalidData,
                    err.to_string(),
                )
                .into());
            }
        };

        // 1. 准备更精细的正则表达式
        let re_rc = Regex::new(r"^([\d\.]+)-rc\d+$").unwrap(); // 匹配 1.21.2-rc1
        let re_pre = Regex::new(r"^([\d\.]+)-pre\d+$").unwrap(); // 匹配 1.21.2-pre2
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
                if parts.len() >= 2 {
                    format!("Minecraft {}.{}", parts[0], parts[1])
                } else {
                    format!("Minecraft {}", id)
                }
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

            let group_data = groups_map
                .entry(group_display.clone())
                .or_insert((group_display, Vec::new()));

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
                VersionGroup {
                    group_name: name,
                    versions,
                }
            })
            .collect();

        result.sort_by(|a, b| {
            let latest_a = a.versions.first().map(|v| &v.release_time);
            let latest_b = b.versions.first().map(|v| &v.release_time);
            latest_b.cmp(&latest_a)
        });

        let mut cache = VERSION_CACHE.write().await;
        *cache = Some((manifest_url, result.clone()));
        Ok(result)
    }
}
