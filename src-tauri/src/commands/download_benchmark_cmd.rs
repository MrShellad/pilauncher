use crate::services::config_service::{ConfigService, DownloadSettings};
use crate::services::downloader::dependencies::mirror::{route_asset_object_urls, route_assets_index_urls};
use crate::services::loader_service::LoaderMetadataService;
use futures::future::join_all;
use reqwest::header::{ACCEPT_ENCODING, CONTENT_RANGE, RANGE};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::env;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Runtime};
use tokio::io::AsyncWriteExt;

const DOWNLOAD_SAMPLE_SIZE_BYTES: u64 = 200 * 1024;
const DOWNLOAD_CONCURRENCY_STREAMS: usize = 4;
const DOWNLOAD_TEST_GAME_VERSION: &str = "1.21.1";
const DOWNLOAD_TEST_JAVA_VERSION: u8 = 21;

#[derive(Debug, Serialize, Deserialize)]
pub struct DownloadBenchmarkReport {
    pub sample_size_bytes: u64,
    pub concurrency_streams: usize,
    pub timestamp: String,
    pub assets: Vec<DownloadBenchmarkResult>,
    pub java: Vec<DownloadBenchmarkResult>,
    pub loader: Vec<DownloadBenchmarkResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadBenchmarkResult {
    pub target: String,
    pub source_id: String,
    pub source_name: String,
    pub url: String,
    pub ok: bool,
    pub bytes_tested: u64,
    pub content_length: Option<u64>,
    pub ttfb_ms: Option<u64>,
    pub download_speed_mbps: Option<f64>,
    pub concurrent_speed_mbps: Option<f64>,
    pub range_supported: bool,
    pub temp_cleared: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct NamedSource {
    target: String,
    source_id: String,
    source_name: String,
    url: String,
}

#[derive(Debug)]
struct DownloadProbeMetrics {
    bytes_tested: u64,
    content_length: Option<u64>,
    ttfb_ms: u64,
    download_speed_mbps: f64,
}

#[tauri::command]
pub async fn run_download_benchmark<R: Runtime>(app: AppHandle<R>) -> Result<DownloadBenchmarkReport, String> {
    let download_settings = ConfigService::get_download_settings(&app);
    let client = build_download_client(&download_settings).map_err(|error| error.to_string())?;
    let temp_root = prepare_benchmark_temp_dir(&app).await.map_err(|error| error.to_string())?;

    let assets_sources = resolve_assets_sources(&client, &download_settings).await.unwrap_or_default();
    let java_sources = resolve_java_sources(&client).await.unwrap_or_default();
    let loader_sources = resolve_loader_sources(&app, &download_settings).await.unwrap_or_default();

    let assets = benchmark_sources(&client, &temp_root, "assets", &assets_sources, &download_settings).await;
    let java = benchmark_sources(&client, &temp_root, "java", &java_sources, &download_settings).await;
    let loader = benchmark_sources(&client, &temp_root, "loader", &loader_sources, &download_settings).await;

    let _ = tokio::fs::remove_dir_all(&temp_root).await;

    Ok(DownloadBenchmarkReport {
        sample_size_bytes: DOWNLOAD_SAMPLE_SIZE_BYTES,
        concurrency_streams: DOWNLOAD_CONCURRENCY_STREAMS,
        timestamp: chrono::Local::now().to_rfc3339(),
        assets,
        java,
        loader,
    })
}

fn build_download_client(dl_settings: &DownloadSettings) -> Result<reqwest::Client, reqwest::Error> {
    let mut builder = reqwest::Client::builder()
        .user_agent("PiLauncher/1.0 (Download Benchmark)")
        .connect_timeout(Duration::from_secs(dl_settings.timeout.max(1)))
        .timeout(Duration::from_secs(dl_settings.timeout.max(1).max(15)));

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

    builder.build()
}

async fn prepare_benchmark_temp_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, std::io::Error> {
    let root = if let Ok(Some(base_path)) = ConfigService::get_base_path(app) {
        PathBuf::from(base_path).join("temp").join("download-benchmark")
    } else {
        std::env::temp_dir().join("pilauncher-download-benchmark")
    };

    let target = root.join(format!("{}", chrono::Utc::now().timestamp_millis()));
    tokio::fs::create_dir_all(&target).await?;
    Ok(target)
}

async fn benchmark_sources(client: &reqwest::Client, temp_root: &Path, category: &str, sources: &[NamedSource], dl_settings: &DownloadSettings) -> Vec<DownloadBenchmarkResult> {
    let mut results = Vec::with_capacity(sources.len());
    for (index, source) in sources.iter().enumerate() {
        results.push(benchmark_source(client, temp_root, category, index, source, dl_settings).await);
    }
    results
}

async fn benchmark_source(client: &reqwest::Client, temp_root: &Path, category: &str, index: usize, source: &NamedSource, dl_settings: &DownloadSettings) -> DownloadBenchmarkResult {
    let base_name = format!("{}-{}-{}", category, index, sanitize_file_component(&source.source_id));
    let single_path = temp_root.join(format!("{}-single.bin", base_name));
    let concurrent_root = temp_root.join(format!("{}-concurrent", base_name));

    let range_supported = detect_range_support(client, &source.url).await.unwrap_or(false);
    let single_metrics = probe_partial_download(client, &source.url, &single_path, dl_settings).await;
    let concurrent_metrics = if single_metrics.is_ok() {
        probe_concurrent_downloads(client, &source.url, &concurrent_root, dl_settings).await.ok()
    } else {
        None
    };

    let mut temp_cleared = true;
    if tokio::fs::remove_file(&single_path).await.is_err() && single_path.exists() {
        temp_cleared = false;
    }
    if tokio::fs::remove_dir_all(&concurrent_root).await.is_err() && concurrent_root.exists() {
        temp_cleared = false;
    }

    match single_metrics {
        Ok(metrics) => DownloadBenchmarkResult {
            target: source.target.clone(),
            source_id: source.source_id.clone(),
            source_name: source.source_name.clone(),
            url: source.url.clone(),
            ok: true,
            bytes_tested: metrics.bytes_tested,
            content_length: metrics.content_length,
            ttfb_ms: Some(metrics.ttfb_ms),
            download_speed_mbps: Some(metrics.download_speed_mbps),
            concurrent_speed_mbps: concurrent_metrics,
            range_supported,
            temp_cleared,
            error: None,
        },
        Err(error) => DownloadBenchmarkResult {
            target: source.target.clone(),
            source_id: source.source_id.clone(),
            source_name: source.source_name.clone(),
            url: source.url.clone(),
            ok: false,
            bytes_tested: 0,
            content_length: None,
            ttfb_ms: None,
            download_speed_mbps: None,
            concurrent_speed_mbps: None,
            range_supported,
            temp_cleared,
            error: Some(error),
        },
    }
}
async fn detect_range_support(client: &reqwest::Client, url: &str) -> Result<bool, String> {
    let response = client
        .get(url)
        .header(ACCEPT_ENCODING, "identity")
        .header(RANGE, "bytes=0-0")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().as_u16() != 206 {
        return Ok(false);
    }

    Ok(response
        .headers()
        .get(CONTENT_RANGE)
        .and_then(|value| value.to_str().ok())
        .is_some())
}

async fn probe_partial_download(client: &reqwest::Client, url: &str, temp_path: &Path, dl_settings: &DownloadSettings) -> Result<DownloadProbeMetrics, String> {
    if let Some(parent) = temp_path.parent() {
        tokio::fs::create_dir_all(parent).await.map_err(|error| error.to_string())?;
    }

    let request_started = Instant::now();
    let mut response = client
        .get(url)
        .header(ACCEPT_ENCODING, "identity")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let content_length = response.content_length();
    let mut file = tokio::fs::File::create(temp_path).await.map_err(|error| error.to_string())?;
    let mut bytes_tested = 0u64;
    let mut first_byte_at: Option<Instant> = None;

    while bytes_tested < DOWNLOAD_SAMPLE_SIZE_BYTES {
        let next_chunk = tokio::time::timeout(
            Duration::from_secs(dl_settings.timeout.max(1).max(15)),
            response.chunk(),
        )
        .await
        .map_err(|_| "download timed out".to_string())?
        .map_err(|error| error.to_string())?;

        let Some(chunk) = next_chunk else {
            break;
        };

        if first_byte_at.is_none() {
            first_byte_at = Some(Instant::now());
        }

        let remaining = (DOWNLOAD_SAMPLE_SIZE_BYTES - bytes_tested) as usize;
        let write_len = remaining.min(chunk.len());
        file.write_all(&chunk[..write_len]).await.map_err(|error| error.to_string())?;
        bytes_tested += write_len as u64;

        if write_len < chunk.len() {
            break;
        }
    }

    file.flush().await.map_err(|error| error.to_string())?;

    if bytes_tested == 0 {
        return Err("empty response".to_string());
    }

    let first_byte_at = first_byte_at.ok_or_else(|| "no first byte received".to_string())?;
    let ttfb_ms = first_byte_at.duration_since(request_started).as_millis() as u64;
    let download_elapsed = first_byte_at.elapsed().as_secs_f64().max(0.001);
    let download_speed_mbps = bytes_to_mbps(bytes_tested, download_elapsed);

    Ok(DownloadProbeMetrics {
        bytes_tested,
        content_length,
        ttfb_ms,
        download_speed_mbps,
    })
}

async fn probe_concurrent_downloads(client: &reqwest::Client, url: &str, temp_dir: &Path, dl_settings: &DownloadSettings) -> Result<f64, String> {
    tokio::fs::create_dir_all(temp_dir).await.map_err(|error| error.to_string())?;

    let started = Instant::now();
    let mut tasks = Vec::with_capacity(DOWNLOAD_CONCURRENCY_STREAMS);
    for index in 0..DOWNLOAD_CONCURRENCY_STREAMS {
        let client = client.clone();
        let url = url.to_string();
        let temp_path = temp_dir.join(format!("{}.bin", index));
        let settings = dl_settings.clone();
        tasks.push(tokio::spawn(async move {
            probe_partial_download(&client, &url, &temp_path, &settings)
                .await
                .map(|metrics| metrics.bytes_tested)
        }));
    }

    let mut total_bytes = 0u64;
    for result in join_all(tasks).await {
        let bytes = result
            .map_err(|error| error.to_string())?
            .map_err(|error| error.to_string())?;
        total_bytes += bytes;
    }

    let elapsed = started.elapsed().as_secs_f64().max(0.001);
    Ok(bytes_to_mbps(total_bytes, elapsed))
}

fn bytes_to_mbps(bytes: u64, seconds: f64) -> f64 {
    ((bytes as f64 * 8.0) / 1_000_000.0) / seconds.max(0.001)
}

async fn resolve_assets_sources(client: &reqwest::Client, dl_settings: &DownloadSettings) -> Result<Vec<NamedSource>, String> {
    let version_manifest_text = fetch_text_from_candidates(client, &build_version_manifest_urls(dl_settings)).await?;
    let manifest_json: Value = serde_json::from_str(&version_manifest_text).map_err(|error| error.to_string())?;

    let version_url = manifest_json["versions"]
        .as_array()
        .and_then(|versions| {
            versions.iter().find_map(|entry| {
                if entry["id"].as_str() == Some(DOWNLOAD_TEST_GAME_VERSION) {
                    entry["url"].as_str().map(|value| value.to_string())
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("missing version {}", DOWNLOAD_TEST_GAME_VERSION))?;

    let version_json_text = fetch_text_from_candidates(client, &[version_url]).await?;
    let version_json: Value = serde_json::from_str(&version_json_text).map_err(|error| error.to_string())?;
    let asset_index_url = version_json["assetIndex"]["url"]
        .as_str()
        .ok_or_else(|| "missing asset index url".to_string())?;

    let asset_index_text = fetch_text_from_candidates(client, &route_assets_index_urls(asset_index_url, dl_settings)).await?;
    let asset_index_json: Value = serde_json::from_str(&asset_index_text).map_err(|error| error.to_string())?;
    let (hash, _) = select_asset_sample(&asset_index_json).ok_or_else(|| "unable to find a 200KB asset sample".to_string())?;
    let prefix = &hash[0..2];

    Ok(build_asset_sources(dl_settings, prefix, &hash))
}

fn select_asset_sample(asset_index_json: &Value) -> Option<(String, u64)> {
    let mut candidates = asset_index_json["objects"]
        .as_object()?
        .values()
        .filter_map(|entry| {
            let hash = entry["hash"].as_str()?.to_string();
            let size = entry["size"].as_u64()?;
            if size >= DOWNLOAD_SAMPLE_SIZE_BYTES {
                Some((hash, size))
            } else {
                None
            }
        })
        .collect::<Vec<_>>();

    candidates.sort_by_key(|(_, size)| *size);
    candidates.into_iter().next()
}

fn build_asset_sources(dl_settings: &DownloadSettings, prefix: &str, hash: &str) -> Vec<NamedSource> {
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    let routed = route_asset_object_urls(prefix, hash, dl_settings);
    for (index, url) in routed.into_iter().enumerate() {
        let (source_id, source_name) = if index == 0 {
            (
                dl_settings.vanilla_source.clone(),
                current_source_name(
                    "Assets",
                    &dl_settings.vanilla_source,
                    &dl_settings.vanilla_source_url,
                ),
            )
        } else if url.contains("bangbang93.com") {
            ("bmclapi".to_string(), "Assets / BMCLAPI".to_string())
        } else {
            ("official".to_string(), "Assets / Official".to_string())
        };

        push_named_source(&mut sources, &mut seen, NamedSource {
            target: "Assets".to_string(),
            source_id,
            source_name,
            url,
        });
    }

    sources
}
async fn resolve_java_sources(client: &reqwest::Client) -> Result<Vec<NamedSource>, String> {
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    for provider in ["adoptium", "zulu", "aks"] {
        if let Some((source_id, source_name, url)) = resolve_java_download_url(client, provider).await? {
            push_named_source(&mut sources, &mut seen, NamedSource {
                target: format!("Java {}", DOWNLOAD_TEST_JAVA_VERSION),
                source_id,
                source_name,
                url,
            });
        }
    }

    Ok(sources)
}

async fn resolve_java_download_url(client: &reqwest::Client, provider: &str) -> Result<Option<(String, String, String)>, String> {
    let os = match env::consts::OS {
        "windows" => "windows",
        "macos" => "mac",
        "linux" => "linux",
        _ => "linux",
    };
    let arch = match env::consts::ARCH {
        "x86_64" => "x64",
        "aarch64" => "aarch64",
        "x86" => "x86",
        _ => "x64",
    };
    let ext = if os == "windows" { "zip" } else { "tar.gz" };

    match provider {
        "adoptium" => {
            let urls = [
                format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jre&jvm_impl=hotspot&os={}", DOWNLOAD_TEST_JAVA_VERSION, arch, os),
                format!("https://api.adoptium.net/v3/assets/feature_releases/{}/ga?architecture={}&heap_size=normal&image_type=jdk&jvm_impl=hotspot&os={}", DOWNLOAD_TEST_JAVA_VERSION, arch, os),
            ];
            let package = fetch_first_non_empty_json_array(client, &urls).await?;
            let url = package["binaries"][0]["package"]["link"]
                .as_str()
                .ok_or_else(|| "missing Adoptium download url".to_string())?;
            Ok(Some(("adoptium".to_string(), "Java / Adoptium".to_string(), url.to_string())))
        }
        "zulu" => {
            let zulu_os = match os {
                "mac" => "macos",
                _ => os,
            };
            let zulu_arch = match arch {
                "x64" => "x86",
                "aarch64" => "arm64",
                _ => "x86",
            };
            let hw_bitness = if arch == "x86" { "32" } else { "64" };
            let urls = [
                format!("https://api.azul.com/metadata/v1/zulu/packages?java_version={}&os={}&arch={}&hw_bitness={}&archive_type={}&java_package_type=jre&latest=true", DOWNLOAD_TEST_JAVA_VERSION, zulu_os, zulu_arch, hw_bitness, ext),
                format!("https://api.azul.com/metadata/v1/zulu/packages?java_version={}&os={}&arch={}&hw_bitness={}&archive_type={}&java_package_type=jdk&latest=true", DOWNLOAD_TEST_JAVA_VERSION, zulu_os, zulu_arch, hw_bitness, ext),
            ];
            let package = fetch_first_non_empty_json_array(client, &urls).await?;
            let url = package["download_url"]
                .as_str()
                .ok_or_else(|| "missing Zulu download url".to_string())?;
            Ok(Some(("zulu".to_string(), "Java / Azul Zulu".to_string(), url.to_string())))
        }
        "aks" => {
            let aks_os = match os {
                "mac" => "macOS",
                "windows" => "windows",
                _ => "linux",
            };
            let aks_arch = match arch {
                "x64" => "x64",
                "aarch64" => "aarch64",
                _ => "x64",
            };
            Ok(Some((
                "aks".to_string(),
                "Java / Microsoft AKS".to_string(),
                format!("https://aka.ms/download-jdk/microsoft-jdk-{}-{}-{}.{}", DOWNLOAD_TEST_JAVA_VERSION, aks_os, aks_arch, ext),
            )))
        }
        _ => Ok(None),
    }
}

async fn fetch_first_non_empty_json_array(client: &reqwest::Client, urls: &[String]) -> Result<Value, String> {
    for url in urls {
        let response = client.get(url).send().await.map_err(|error| error.to_string())?;
        if !response.status().is_success() {
            continue;
        }
        let json: Value = response.json().await.map_err(|error| error.to_string())?;
        if let Some(items) = json.as_array() {
            if let Some(first) = items.first() {
                return Ok(first.clone());
            }
        }
    }

    Err("no provider metadata available".to_string())
}

async fn resolve_loader_sources<R: Runtime>(app: &AppHandle<R>, dl_settings: &DownloadSettings) -> Result<Vec<NamedSource>, String> {
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    if let Some(version) = resolve_latest_loader_version(app, "fabric").await? {
        for source in build_fabric_loader_sources(dl_settings, &version) {
            push_named_source(&mut sources, &mut seen, source);
        }
    }

    if let Some(version) = resolve_latest_loader_version(app, "forge").await? {
        for source in build_forge_loader_sources(dl_settings, &version) {
            push_named_source(&mut sources, &mut seen, source);
        }
    }

    if let Some(version) = resolve_latest_loader_version(app, "neoforge").await? {
        for source in build_neoforge_loader_sources(dl_settings, &version) {
            push_named_source(&mut sources, &mut seen, source);
        }
    }

    if let Some(version) = resolve_latest_loader_version(app, "quilt").await? {
        for source in build_quilt_loader_sources(dl_settings, &version) {
            push_named_source(&mut sources, &mut seen, source);
        }
    }

    Ok(sources)
}

async fn resolve_latest_loader_version<R: Runtime>(app: &AppHandle<R>, loader_type: &str) -> Result<Option<String>, String> {
    let versions = LoaderMetadataService::fetch_loader_versions(app, loader_type, DOWNLOAD_TEST_GAME_VERSION)
        .await
        .map_err(|error| error.to_string())?;
    Ok(versions.into_iter().next())
}
fn build_fabric_loader_sources(dl_settings: &DownloadSettings, version: &str) -> Vec<NamedSource> {
    let artifact_path = format!("net/fabricmc/fabric-loader/{0}/fabric-loader-{0}.jar", version);
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    if let Some(base) = fabric_maven_base_from_source_url(&dl_settings.fabric_source_url) {
        push_named_source(&mut sources, &mut seen, NamedSource {
            target: "Fabric Loader".to_string(),
            source_id: dl_settings.fabric_source.clone(),
            source_name: current_source_name("Fabric", &dl_settings.fabric_source, &base),
            url: format!("{}/{}", base, artifact_path),
        });
    }

    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "Fabric Loader".to_string(),
        source_id: "bmclapi".to_string(),
        source_name: "Fabric / BMCLAPI".to_string(),
        url: format!("https://bmclapi2.bangbang93.com/maven/{}", artifact_path),
    });
    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "Fabric Loader".to_string(),
        source_id: "official".to_string(),
        source_name: "Fabric / Official".to_string(),
        url: format!("https://maven.fabricmc.net/{}", artifact_path),
    });

    sources
}

fn build_forge_loader_sources(dl_settings: &DownloadSettings, version: &str) -> Vec<NamedSource> {
    let artifact_path = format!("net/minecraftforge/forge/{0}-{1}/forge-{0}-{1}-installer.jar", DOWNLOAD_TEST_GAME_VERSION, version);
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    if let Some(base) = normalize_source_base(&dl_settings.forge_source_url) {
        push_named_source(&mut sources, &mut seen, NamedSource {
            target: "Forge Loader".to_string(),
            source_id: dl_settings.forge_source.clone(),
            source_name: current_source_name("Forge", &dl_settings.forge_source, &base),
            url: format!("{}/{}", forge_maven_base(&base), artifact_path),
        });
    }

    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "Forge Loader".to_string(),
        source_id: "bmclapi".to_string(),
        source_name: "Forge / BMCLAPI".to_string(),
        url: format!("https://bmclapi2.bangbang93.com/maven/{}", artifact_path),
    });
    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "Forge Loader".to_string(),
        source_id: "official".to_string(),
        source_name: "Forge / Official".to_string(),
        url: format!("https://maven.minecraftforge.net/{}", artifact_path),
    });

    sources
}

fn build_neoforge_loader_sources(dl_settings: &DownloadSettings, version: &str) -> Vec<NamedSource> {
    let artifact_path = format!("net/neoforged/neoforge/{0}/neoforge-{0}-installer.jar", version);
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    if let Some(base) = normalize_source_base(&dl_settings.neoforge_source_url) {
        push_named_source(&mut sources, &mut seen, NamedSource {
            target: "NeoForge Loader".to_string(),
            source_id: dl_settings.neoforge_source.clone(),
            source_name: current_source_name("NeoForge", &dl_settings.neoforge_source, &base),
            url: format!("{}/{}", neoforge_maven_base(&base), artifact_path),
        });
    }

    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "NeoForge Loader".to_string(),
        source_id: "bmclapi".to_string(),
        source_name: "NeoForge / BMCLAPI".to_string(),
        url: format!("https://bmclapi2.bangbang93.com/maven/{}", artifact_path),
    });
    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "NeoForge Loader".to_string(),
        source_id: "official".to_string(),
        source_name: "NeoForge / Official".to_string(),
        url: format!("https://maven.neoforged.net/releases/{}", artifact_path),
    });

    sources
}

fn build_quilt_loader_sources(dl_settings: &DownloadSettings, version: &str) -> Vec<NamedSource> {
    let artifact_path = format!("org/quiltmc/quilt-loader/{0}/quilt-loader-{0}.jar", version);
    let mut sources = Vec::new();
    let mut seen = HashSet::new();

    if let Some(base) = quilt_maven_base_from_source_url(&dl_settings.quilt_source_url) {
        push_named_source(&mut sources, &mut seen, NamedSource {
            target: "Quilt Loader".to_string(),
            source_id: dl_settings.quilt_source.clone(),
            source_name: current_source_name("Quilt", &dl_settings.quilt_source, &base),
            url: format!("{}/{}", base, artifact_path),
        });
    }

    push_named_source(&mut sources, &mut seen, NamedSource {
        target: "Quilt Loader".to_string(),
        source_id: "official".to_string(),
        source_name: "Quilt / Official".to_string(),
        url: format!("https://maven.quiltmc.org/repository/release/{}", artifact_path),
    });

    sources
}

fn fabric_maven_base_from_source_url(url: &str) -> Option<String> {
    let base = normalize_source_base(url)?;
    if base.ends_with("/fabric-meta") {
        Some(base.trim_end_matches("/fabric-meta").to_string() + "/maven")
    } else if base.ends_with("/maven") {
        Some(base)
    } else {
        Some(format!("{}/maven", base))
    }
}

fn quilt_maven_base_from_source_url(url: &str) -> Option<String> {
    let base = normalize_source_base(url)?;
    if base.ends_with("/quilt-meta") {
        Some(base.trim_end_matches("/quilt-meta").to_string() + "/repository/release")
    } else if base.ends_with("/repository/release") {
        Some(base)
    } else {
        Some(format!("{}/repository/release", base))
    }
}

fn forge_maven_base(base: &str) -> String {
    if base.ends_with("/forge") {
        format!("{}/maven", base.trim_end_matches("/forge"))
    } else if base.ends_with("/maven") {
        base.to_string()
    } else {
        format!("{}/maven", base)
    }
}

fn neoforge_maven_base(base: &str) -> String {
    if base.ends_with("/neoforge") {
        format!("{}/maven", base.trim_end_matches("/neoforge"))
    } else if base.ends_with("/releases") || base.ends_with("/maven") {
        base.to_string()
    } else {
        format!("{}/maven", base)
    }
}

fn current_source_name(kind: &str, source_id: &str, base: &str) -> String {
    let host = reqwest::Url::parse(base)
        .ok()
        .and_then(|url| url.host_str().map(|value| value.to_string()))
        .unwrap_or_else(|| base.to_string());
    format!("{} / Current ({}, {})", kind, source_id, host)
}

fn build_version_manifest_urls(dl_settings: &DownloadSettings) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = HashSet::new();

    if let Some(base) = normalize_source_base(&dl_settings.vanilla_source_url) {
        let current = format!("{}/mc/game/version_manifest_v2.json", base);
        if seen.insert(current.clone()) {
            urls.push(current);
        }
    }

    for url in [
        "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json",
        "https://bmclapi2.bangbang93.com/mc/game/version_manifest_v2.json",
    ] {
        if seen.insert(url.to_string()) {
            urls.push(url.to_string());
        }
    }

    urls
}

async fn fetch_text_from_candidates(client: &reqwest::Client, urls: &[String]) -> Result<String, String> {
    let mut last_error = "unknown error".to_string();
    for url in urls {
        match client.get(url).send().await {
            Ok(response) if response.status().is_success() => return response.text().await.map_err(|error| error.to_string()),
            Ok(response) => last_error = format!("{} -> {}", url, response.status()),
            Err(error) => last_error = format!("{} -> {}", url, error),
        }
    }
    Err(last_error)
}

fn push_named_source(sources: &mut Vec<NamedSource>, seen: &mut HashSet<String>, source: NamedSource) {
    if seen.insert(source.url.clone()) {
        sources.push(source);
    }
}

fn normalize_source_base(url: &str) -> Option<String> {
    let trimmed = url.trim().trim_end_matches('/');
    if trimmed.is_empty() { None } else { Some(trimmed.to_string()) }
}

fn sanitize_file_component(input: &str) -> String {
    input.chars().map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' }).collect::<String>()
}
