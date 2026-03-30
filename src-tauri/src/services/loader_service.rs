// src-tauri/src/services/loader_service.rs
use crate::domain::loader::{BmclApiLoaderVersion, FabricLoaderMeta, QuiltLoaderMeta};
use crate::error::AppResult;
use crate::services::config_service::{ConfigService, DownloadSettings};
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::Client;
use std::collections::HashMap;
use std::time::Duration;
use tauri::{AppHandle, Runtime};
use tokio::sync::RwLock;

static LOADER_CACHE: Lazy<RwLock<HashMap<String, Vec<String>>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));

pub struct LoaderMetadataService;

impl LoaderMetadataService {
    pub async fn fetch_loader_versions<R: Runtime>(
        app: &AppHandle<R>,
        loader_type: &str,
        game_version: &str,
    ) -> AppResult<Vec<String>> {
        let dl_settings = ConfigService::get_download_settings(app);
        let cache_key = format!(
            "{}_{}_{}",
            loader_type.to_lowercase(),
            game_version,
            source_cache_suffix(loader_type, &dl_settings)
        );

        {
            let cache = LOADER_CACHE.read().await;
            if let Some(versions) = cache.get(&cache_key) {
                return Ok(versions.clone());
            }
        }

        let client = build_client(&dl_settings)?;

        let versions = match loader_type.to_lowercase().as_str() {
            "fabric" => fetch_fabric_versions(&client, &dl_settings, game_version).await?,
            "forge" => fetch_forge_versions(&client, &dl_settings, game_version).await?,
            "neoforge" => fetch_neoforge_versions(&client, &dl_settings, game_version).await?,
            "quilt" => fetch_quilt_versions(&client, &dl_settings, game_version).await?,
            _ => Vec::new(),
        };

        let mut cache = LOADER_CACHE.write().await;
        cache.insert(cache_key, versions.clone());

        Ok(versions)
    }
}

fn normalize_source_base(url: &str) -> Option<String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}

fn build_client(dl_settings: &DownloadSettings) -> AppResult<Client> {
    let mut builder = Client::builder()
        .user_agent("PiLauncher/1.0 (Loader Metadata)")
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)));

    if dl_settings.proxy_type != "none" {
        let host = dl_settings.proxy_host.trim();
        let port = dl_settings.proxy_port.trim();
        if !host.is_empty() && !port.is_empty() {
            let scheme = match dl_settings.proxy_type.as_str() {
                "http" => "http",
                "https" => "https",
                "socks5" => "socks5h",
                _ => "http",
            };
            let proxy_url = format!("{}://{}:{}", scheme, host, port);
            builder = builder.proxy(reqwest::Proxy::all(&proxy_url)?);
        }
    }

    Ok(builder.build()?)
}

fn source_cache_suffix(loader_type: &str, dl_settings: &DownloadSettings) -> String {
    match loader_type.to_lowercase().as_str() {
        "fabric" => format!("{}|{}", dl_settings.fabric_source, dl_settings.fabric_source_url),
        "forge" => format!("{}|{}", dl_settings.forge_source, dl_settings.forge_source_url),
        "neoforge" => format!(
            "{}|{}",
            dl_settings.neoforge_source, dl_settings.neoforge_source_url
        ),
        "quilt" => format!("{}|{}", dl_settings.quilt_source, dl_settings.quilt_source_url),
        _ => String::new(),
    }
}

fn parse_maven_metadata_versions(xml: &str) -> Vec<String> {
    let regex = Regex::new(r"<version>([^<]+)</version>").expect("valid maven metadata regex");
    regex
        .captures_iter(xml)
        .filter_map(|capture| capture.get(1).map(|m| m.as_str().to_string()))
        .collect()
}

async fn fetch_fabric_versions(
    client: &Client,
    dl_settings: &DownloadSettings,
    game_version: &str,
) -> AppResult<Vec<String>> {
    let base = normalize_source_base(&dl_settings.fabric_source_url)
        .unwrap_or_else(|| "https://meta.fabricmc.net".to_string());
    let url = format!("{}/v2/versions/loader/{}", base, game_version);
    let res = client.get(&url).send().await?;
    if res.status().is_success() {
        let data = res.json::<Vec<FabricLoaderMeta>>().await?;
        return Ok(data.into_iter().map(|v| v.loader.version).collect());
    }

    Ok(Vec::new())
}

async fn fetch_quilt_versions(
    client: &Client,
    dl_settings: &DownloadSettings,
    game_version: &str,
) -> AppResult<Vec<String>> {
    let base = normalize_source_base(&dl_settings.quilt_source_url)
        .unwrap_or_else(|| "https://meta.quiltmc.org".to_string());
    let url = format!("{}/v3/versions/loader/{}", base, game_version);
    let res = client.get(&url).send().await?;
    if res.status().is_success() {
        let data = res.json::<Vec<QuiltLoaderMeta>>().await?;
        return Ok(data.into_iter().map(|v| v.loader.version).collect());
    }

    Ok(Vec::new())
}

async fn fetch_forge_versions(
    client: &Client,
    dl_settings: &DownloadSettings,
    game_version: &str,
) -> AppResult<Vec<String>> {
    let selected = normalize_source_base(&dl_settings.forge_source_url)
        .unwrap_or_else(|| "https://bmclapi2.bangbang93.com/forge".to_string());

    if dl_settings.forge_source == "official" || selected.contains("maven.minecraftforge.net") {
        let metadata_base = if selected.ends_with("/forge") {
            selected.trim_end_matches("/forge").to_string()
        } else {
            selected
        };
        let metadata_url = format!(
            "{}/net/minecraftforge/forge/maven-metadata.xml",
            metadata_base.trim_end_matches('/')
        );
        let xml = client.get(&metadata_url).send().await?.text().await?;
        let mut versions = parse_maven_metadata_versions(&xml)
            .into_iter()
            .filter_map(|version| {
                version
                    .strip_prefix(&format!("{}-", game_version))
                    .map(|v| v.to_string())
            })
            .collect::<Vec<_>>();
        versions.reverse();
        return Ok(versions);
    }

    let url = format!("{}/minecraft/{}", selected, game_version);
    let res = client.get(&url).send().await?;
    if res.status().is_success() {
        let data = res.json::<Vec<BmclApiLoaderVersion>>().await?;
        return Ok(data.into_iter().map(|v| v.version).collect());
    }

    Ok(Vec::new())
}

fn neoforge_prefix_for_mc(game_version: &str) -> Option<String> {
    let mut parts = game_version.split('.');
    let major = parts.next()?;
    let minor = parts.next()?;
    let patch = parts.next().unwrap_or("0");

    if major == "1" {
        Some(format!("{}.{}.", minor, patch))
    } else {
        None
    }
}

async fn fetch_neoforge_versions(
    client: &Client,
    dl_settings: &DownloadSettings,
    game_version: &str,
) -> AppResult<Vec<String>> {
    let selected = normalize_source_base(&dl_settings.neoforge_source_url)
        .unwrap_or_else(|| "https://bmclapi2.bangbang93.com/neoforge".to_string());

    if dl_settings.neoforge_source == "official" || selected.contains("maven.neoforged.net") {
        let metadata_base = if selected.ends_with("/releases") {
            selected.clone()
        } else {
            "https://maven.neoforged.net/releases".to_string()
        };
        let metadata_url = format!(
            "{}/net/neoforged/neoforge/maven-metadata.xml",
            metadata_base.trim_end_matches('/')
        );
        let xml = client.get(&metadata_url).send().await?.text().await?;
        let mut versions = parse_maven_metadata_versions(&xml);

        if let Some(prefix) = neoforge_prefix_for_mc(game_version) {
            versions.retain(|version| version.starts_with(&prefix));
        }

        versions.reverse();
        if !versions.is_empty() {
            return Ok(versions);
        }
    }

    let list_base = if selected.ends_with("/neoforge") {
        selected
    } else {
        "https://bmclapi2.bangbang93.com/neoforge".to_string()
    };
    let url = format!("{}/list/{}", list_base, game_version);
    let res = client.get(&url).send().await?;
    if res.status().is_success() {
        let data = res.json::<Vec<BmclApiLoaderVersion>>().await?;
        return Ok(data.into_iter().map(|v| v.version).collect());
    }

    Ok(Vec::new())
}
