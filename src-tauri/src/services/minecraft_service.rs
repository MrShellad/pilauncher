// src-tauri/src/services/minecraft_service.rs
use crate::domain::minecraft::{McVersion, RemoteVersionManifest, VersionGroup};
use crate::domain::modpack::MissingRuntime;
use crate::error::AppResult;
use crate::services::config_service::ConfigService;
use once_cell::sync::Lazy;
use regex::Regex;
use std::collections::BTreeMap;
use std::env;
use std::path::Path;
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
                        Ok(resp)
                            if resp.status().as_u16() == 429 || resp.status().is_server_error() =>
                        {
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
                return Err(
                    std::io::Error::new(std::io::ErrorKind::InvalidData, err.to_string()).into(),
                );
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

pub fn get_mc_os() -> &'static str {
    match env::consts::OS {
        "windows" => "windows",
        "macos" => "osx",
        "linux" => "linux",
        _ => env::consts::OS,
    }
}

pub fn get_mc_arch() -> &'static str {
    match env::consts::ARCH {
        "x86_64" => "64",
        "x86" => "32",
        "aarch64" => "arm64",
        _ => env::consts::ARCH,
    }
}

pub fn evaluate_library_rules(rules: Option<&Vec<serde_json::Value>>) -> bool {
    let Some(rules) = rules else {
        return true;
    };

    let current_os = get_mc_os();
    let mut is_allowed = false;

    for rule in rules {
        let action = rule["action"].as_str().unwrap_or("disallow");
        let os_match = match rule.get("os") {
            Some(os_obj) => os_obj["name"].as_str().unwrap_or("") == current_os,
            None => true,
        };

        if os_match {
            is_allowed = action == "allow";
        }
    }

    is_allowed
}

pub fn legacy_library_download_path(name: &str, classifier: Option<&str>) -> Option<String> {
    let parts: Vec<&str> = name.split(':').collect();
    if parts.len() < 3 {
        return None;
    }

    let group = parts[0].replace('.', "/");
    let artifact = parts[1];
    let version = parts[2];

    Some(match classifier {
        Some(classifier) => format!(
            "{}/{}/{}/{}-{}-{}.jar",
            group, artifact, version, artifact, version, classifier
        ),
        None => format!(
            "{}/{}/{}/{}-{}.jar",
            group, artifact, version, artifact, version
        ),
    })
}

pub fn resolve_loader_folder(
    loader_type: &str,
    mc_version: &str,
    loader_version: &str,
) -> Option<String> {
    if loader_version.trim().is_empty() || loader_type.eq_ignore_ascii_case("vanilla") {
        return None;
    }

    match loader_type.to_lowercase().as_str() {
        "fabric" => Some(format!("fabric-loader-{}-{}", loader_version, mc_version)),
        "forge" => Some(format!("{}-forge-{}", mc_version, loader_version)),
        "neoforge" => Some(format!("neoforge-{}", loader_version)),
        "quilt" => Some(format!("quilt-loader-{}-{}", loader_version, mc_version)),
        _ => None,
    }
}

pub fn parse_third_party_json(
    dir_name: &str,
    json: &serde_json::Value,
) -> (String, String, String) {
    let mut mc_version = dir_name.to_string();
    let mut loader_type = "vanilla".to_string();
    let mut loader_version = String::new();

    if let Some(inherits) = json.get("inheritsFrom").and_then(|value| value.as_str()) {
        mc_version = inherits.to_string();
    }

    if let Some(args) = json
        .get("arguments")
        .and_then(|value| value.get("game"))
        .and_then(|value| value.as_array())
    {
        let mut iter = args.iter();
        while let Some(arg) = iter.next() {
            if let Some(arg_str) = arg.as_str() {
                if arg_str == "--fml.mcVersion" {
                    if let Some(value) = iter.next().and_then(|next| next.as_str()) {
                        mc_version = value.to_string();
                    }
                } else if arg_str == "--fml.forgeVersion" {
                    if let Some(value) = iter.next().and_then(|next| next.as_str()) {
                        loader_type = "forge".to_string();
                        loader_version = value.to_string();
                    }
                } else if arg_str == "--fml.neoForgeVersion" {
                    if let Some(value) = iter.next().and_then(|next| next.as_str()) {
                        loader_type = "neoforge".to_string();
                        loader_version = value.to_string();
                    }
                }
            }
        }
    }

    if loader_type == "vanilla" || loader_version.is_empty() || mc_version == dir_name {
        if let Some(libraries) = json.get("libraries").and_then(|value| value.as_array()) {
            for library in libraries {
                if let Some(name) = library.get("name").and_then(|value| value.as_str()) {
                    if name.starts_with("net.fabricmc:fabric-loader:") {
                        loader_type = "fabric".to_string();
                        if let Some(version) = name.split(':').nth(2) {
                            loader_version = version.to_string();
                        }
                    } else if name.starts_with("org.quiltmc:quilt-loader:") {
                        loader_type = "quilt".to_string();
                        if let Some(version) = name.split(':').nth(2) {
                            loader_version = version.to_string();
                        }
                    } else if name.starts_with("net.neoforged:neoforge:") {
                        loader_type = "neoforge".to_string();
                        if let Some(version) = name.split(':').nth(2) {
                            loader_version = version.to_string();
                        }
                    } else if name.starts_with("net.minecraftforge:forge:") {
                        loader_type = "forge".to_string();
                        if let Some(version) = name.split(':').nth(2) {
                            let version = version.to_string();
                            if version.contains('-') {
                                loader_version =
                                    version.split('-').nth(1).unwrap_or(&version).to_string();
                            } else {
                                loader_version = version;
                            }
                        }
                    }

                    if mc_version == dir_name || mc_version.is_empty() {
                        if name.starts_with("net.fabricmc:intermediary:")
                            || name.starts_with("org.quiltmc:hashed:")
                        {
                            if let Some(version) = name.split(':').nth(2) {
                                mc_version = version.to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    if loader_type == "vanilla" && loader_version.is_empty() {
        let id_lower = dir_name.to_lowercase();
        if id_lower.contains("neoforge") {
            loader_type = "neoforge".to_string();
            let parts: Vec<&str> = dir_name.split("neoforge-").collect();
            if parts.len() >= 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("forge") {
            loader_type = "forge".to_string();
            let parts: Vec<&str> = dir_name.split("-forge-").collect();
            if parts.len() == 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("fabric") {
            loader_type = "fabric".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 && parts[0] == "fabric" && parts[1] == "loader" {
                loader_version = parts[2].to_string();
            } else if parts.len() >= 2 && parts[1].contains("Fabric ") {
                loader_version = parts[1].replace("Fabric ", "");
            }
        } else if id_lower.contains("quilt") {
            loader_type = "quilt".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 {
                loader_version = parts[2].to_string();
            }
        }
    }

    (mc_version, loader_type, loader_version)
}

pub fn detect_missing_runtime(
    runtime_dir: &Path,
    instance_id: &str,
    mc_version: &str,
    loader_type: &str,
    loader_version: &str,
) -> Option<MissingRuntime> {
    let core_dir = runtime_dir.join("versions").join(mc_version);
    let core_json = core_dir.join(format!("{}.json", mc_version));
    let core_jar = core_dir.join(format!("{}.jar", mc_version));

    let mut is_missing = !core_json.exists() || !core_jar.exists();

    if let Some(loader_folder) = resolve_loader_folder(loader_type, mc_version, loader_version) {
        let loader_json = runtime_dir
            .join("versions")
            .join(&loader_folder)
            .join(format!("{}.json", loader_folder));
        if !loader_json.exists() {
            is_missing = true;
        }
    }

    if !is_missing {
        return None;
    }

    Some(MissingRuntime {
        instance_id: instance_id.to_string(),
        mc_version: mc_version.to_string(),
        loader_type: loader_type.to_string(),
        loader_version: loader_version.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::parse_third_party_json;
    use serde_json::json;

    #[test]
    fn parses_forge_third_party_json() {
        let json_data = json!({
            "arguments": {
                "game": [
                    "--fml.mcVersion", "1.20.1",
                    "--fml.forgeVersion", "47.4.18"
                ]
            }
        });
        let (mc, loader, version) = parse_third_party_json("1.20.1-Forge_47.4.18", &json_data);
        assert_eq!(mc, "1.20.1");
        assert_eq!(loader, "forge");
        assert_eq!(version, "47.4.18");
    }

    #[test]
    fn parses_neoforge_third_party_json() {
        let json_data = json!({
            "arguments": {
                "game": [
                    "--fml.mcVersion", "1.21.1",
                    "--fml.neoForgeVersion", "21.1.113"
                ]
            }
        });
        let (mc, loader, version) =
            parse_third_party_json("Cobblemon Modpack [NeoForge]", &json_data);
        assert_eq!(mc, "1.21.1");
        assert_eq!(loader, "neoforge");
        assert_eq!(version, "21.1.113");
    }

    #[test]
    fn parses_fabric_third_party_json() {
        let json_data = json!({
            "libraries": [
                { "name": "net.fabricmc:fabric-loader:0.18.4" },
                { "name": "net.fabricmc:intermediary:1.20.1" }
            ]
        });
        let (mc, loader, version) = parse_third_party_json("1.20.1-Fabric 0.18.4", &json_data);
        assert_eq!(mc, "1.20.1");
        assert_eq!(loader, "fabric");
        assert_eq!(version, "0.18.4");
    }

    #[test]
    fn falls_back_to_directory_name_for_third_party_json() {
        let json_data = json!({});
        let (mc, loader, version) = parse_third_party_json("1.19.2-forge-43.2.0", &json_data);
        assert_eq!(mc, "1.19.2-forge-43.2.0");
        assert_eq!(loader, "forge");
        assert_eq!(version, "43.2.0");
    }
}
