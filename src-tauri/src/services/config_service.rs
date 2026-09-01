// src-tauri/src/services/config_service.rs
use crate::domain::runtime::MemoryAllocationMode;
use crate::error::AppResult;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

const DEFAULT_SHARED_DOWNLOAD_FILTER_CONFIG: &str =
    include_str!("../../../src/assets/config/download_filter_categories.json");

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadSettings {
    #[serde(default = "default_minecraft_meta_source")]
    pub minecraft_meta_source: String,
    pub concurrency: usize,
    #[serde(default = "default_chunked_download_enabled")]
    pub chunked_download_enabled: bool,
    #[serde(default = "default_chunked_download_threads")]
    pub chunked_download_threads: usize,
    #[serde(default = "default_chunked_download_min_size_mb")]
    pub chunked_download_min_size_mb: u64,
    pub speed_limit: u64,
    pub speed_unit: String,
    pub proxy_type: String,
    pub proxy_host: String,
    pub proxy_port: String,
    pub retry_count: u32,
    pub timeout: u64,
    pub verify_after_download: bool,
    #[serde(default)]
    pub auto_check_latency: bool,
    #[serde(default)]
    pub strict_source_routing: bool,
    // 各路下载源路由配置
    pub vanilla_source: String,
    pub vanilla_source_url: String,
    pub fabric_source: String,
    pub fabric_source_url: String,
    pub forge_source: String,
    pub forge_source_url: String,
    pub neoforge_source: String,
    pub neoforge_source_url: String,
    #[serde(default = "default_quilt_source")]
    pub quilt_source: String,
    #[serde(default = "default_quilt_source_url")]
    pub quilt_source_url: String,
}

fn default_minecraft_meta_source() -> String {
    "bangbang93".to_string()
}

fn default_quilt_source() -> String {
    "official".to_string()
}

fn default_quilt_source_url() -> String {
    "https://meta.quiltmc.org".to_string()
}

fn default_chunked_download_enabled() -> bool {
    true
}

fn default_chunked_download_threads() -> usize {
    4
}

fn default_chunked_download_min_size_mb() -> u64 {
    8
}

fn default_playtime_auto_sync() -> bool {
    true
}

fn default_playtime_remote_path() -> String {
    "PiLauncher/playtime".to_string()
}

fn default_pre_launch_check() -> bool {
    true
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            minecraft_meta_source: "bangbang93".to_string(),
            concurrency: 8,
            chunked_download_enabled: true,
            chunked_download_threads: 4,
            chunked_download_min_size_mb: 8,
            speed_limit: 0,
            speed_unit: "MB/s".to_string(),
            proxy_type: "none".to_string(),
            proxy_host: "127.0.0.1".to_string(),
            proxy_port: "7890".to_string(),
            retry_count: 3,
            timeout: 15,
            verify_after_download: true,
            auto_check_latency: false,
            strict_source_routing: false,
            vanilla_source: "bmclapi".to_string(),
            vanilla_source_url: "https://bmclapi2.bangbang93.com".to_string(),
            fabric_source: "official".to_string(),
            fabric_source_url: "https://meta.fabricmc.net".to_string(),
            forge_source: "bmclapi".to_string(),
            forge_source_url: "https://bmclapi2.bangbang93.com/forge".to_string(),
            neoforge_source: "bmclapi".to_string(),
            neoforge_source_url: "https://bmclapi2.bangbang93.com/neoforge".to_string(),
            quilt_source: default_quilt_source(),
            quilt_source_url: default_quilt_source_url(),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PlaytimeSyncSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "default_playtime_auto_sync")]
    pub auto_sync: bool,
    #[serde(default)]
    pub webdav_url: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default = "default_playtime_remote_path")]
    pub remote_path: String,
}

impl Default for PlaytimeSyncSettings {
    fn default() -> Self {
        Self {
            enabled: false,
            auto_sync: default_playtime_auto_sync(),
            webdav_url: String::new(),
            username: String::new(),
            password: String::new(),
            remote_path: default_playtime_remote_path(),
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct JavaSettings {
    pub auto_detect: bool,
    pub java_path: String,
    pub major_java_paths: HashMap<String, String>,
    pub jvm_args: String,
    #[serde(default)]
    pub memory_allocation_mode: MemoryAllocationMode,
    pub max_memory: u32,
    pub min_memory: u32,
}
impl Default for JavaSettings {
    fn default() -> Self {
        Self {
            auto_detect: true,
            java_path: "java".to_string(),
            major_java_paths: HashMap::new(),
            jvm_args: String::new(),
            memory_allocation_mode: MemoryAllocationMode::Auto,
            max_memory: 4096,
            min_memory: 1024,
        }
    }
}

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GameSettings {
    pub fullscreen: bool,
    pub resolution: String,
    #[serde(default = "default_pre_launch_check")]
    pub pre_launch_check: bool,
}
impl Default for GameSettings {
    fn default() -> Self {
        Self {
            fullscreen: false,
            resolution: "854x480".to_string(),
            pre_launch_check: true,
        }
    }
}

pub struct ConfigService;

impl ConfigService {
    fn read_base_path_from_meta(path: &Path) -> Option<String> {
        let content = fs::read_to_string(path).ok()?;
        let json = serde_json::from_str::<serde_json::Value>(&content).ok()?;
        json.get("base_path")?.as_str().map(str::to_string)
    }

    fn write_meta_atomically(meta_path: &Path, data: &[u8]) -> Result<(), String> {
        let parent = meta_path
            .parent()
            .ok_or_else(|| "无法解析系统配置目录".to_string())?;
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;

        let temp_path = meta_path.with_extension("json.tmp");
        let backup_path = meta_path.with_extension("json.bak");
        if temp_path.exists() {
            fs::remove_file(&temp_path).map_err(|e| format!("清理临时配置失败: {e}"))?;
        }

        fs::write(&temp_path, data).map_err(|e| format!("写入临时配置失败: {e}"))?;
        fs::OpenOptions::new()
            .read(true)
            .write(true)
            .open(&temp_path)
            .and_then(|file| file.sync_all())
            .map_err(|e| format!("同步临时配置失败: {e}"))?;

        if backup_path.exists() {
            fs::remove_file(&backup_path).map_err(|e| format!("清理旧配置备份失败: {e}"))?;
        }
        if meta_path.exists() {
            fs::rename(meta_path, &backup_path).map_err(|e| format!("备份当前配置失败: {e}"))?;
        }

        if let Err(error) = fs::rename(&temp_path, meta_path) {
            if backup_path.exists() {
                let _ = fs::rename(&backup_path, meta_path);
            }
            return Err(format!("提交数据目录配置失败: {error}"));
        }

        if backup_path.exists() {
            fs::remove_file(&backup_path).map_err(|e| format!("清理配置备份失败: {e}"))?;
        }
        Ok(())
    }

    pub fn download_speed_limit_bytes_per_sec(dl_settings: &DownloadSettings) -> u64 {
        if dl_settings.speed_limit == 0 {
            0
        } else {
            match dl_settings.speed_unit.as_str() {
                // Mbps is a network-rate unit, while MB/s is a byte-rate unit.
                // Keep the conversion here so every downloader applies the same cap.
                "Mbps" => dl_settings
                    .speed_limit
                    .saturating_mul(1_000_000)
                    .saturating_div(8),
                _ => dl_settings.speed_limit.saturating_mul(1024 * 1024),
            }
        }
    }

    pub fn chunked_download_min_size_bytes(dl_settings: &DownloadSettings) -> u64 {
        dl_settings
            .chunked_download_min_size_mb
            .max(1)
            .saturating_mul(1024 * 1024)
    }

    /// Stall timeout for data transfer: 2x the connect timeout to tolerate
    /// slow or jittery connections without prematurely aborting large downloads.
    pub fn stall_timeout(dl_settings: &DownloadSettings) -> std::time::Duration {
        let base = dl_settings.timeout.max(1);
        std::time::Duration::from_secs(base.saturating_mul(2).max(30))
    }

    fn get_meta_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<PathBuf> {
        Ok(app
            .path()
            .app_config_dir()
            .expect("无法获取系统配置目录")
            .join("meta.json"))
    }

    pub fn get_base_path<R: Runtime>(app: &AppHandle<R>) -> AppResult<Option<String>> {
        let path = Self::get_meta_path(app)?;
        if let Some(base_path) = Self::read_base_path_from_meta(&path) {
            return Ok(Some(base_path));
        }

        // A process may have stopped between moving the old metadata aside and
        // committing the replacement. Keep the backup readable so first-run
        // detection never mistakes an interrupted settings write for a clean install.
        let backup_path = path.with_extension("json.bak");
        if let Some(base_path) = Self::read_base_path_from_meta(&backup_path) {
            return Ok(Some(base_path));
        }
        Ok(None)
    }

    pub fn ensure_base_path<R: Runtime>(app: &AppHandle<R>) -> Result<String, String> {
        if let Some(base_path) = Self::get_base_path(app).map_err(|e| e.to_string())? {
            Self::ensure_base_layout(Path::new(&base_path))?;
            return Ok(base_path);
        }

        let default_path = app.path().app_data_dir().map_err(|e| e.to_string())?;
        let default_path_str = default_path.to_string_lossy().to_string();
        Self::set_base_path(app, &default_path_str)?;
        Ok(default_path_str)
    }

    pub fn ensure_shared_download_filter_config_in_base_path(
        base_path: &Path,
    ) -> Result<PathBuf, String> {
        let shared_mods_dir = base_path.join("shared_mods");
        fs::create_dir_all(&shared_mods_dir)
            .map_err(|e| format!("failed to create shared_mods directory: {}", e))?;

        let file_path = shared_mods_dir.join("download_filter_categories.json");
        let bundled_value =
            serde_json::from_str::<serde_json::Value>(DEFAULT_SHARED_DOWNLOAD_FILTER_CONFIG)
                .map_err(|e| format!("failed to parse bundled filter config: {}", e))?;
        let bundled_version = bundled_value["version"].as_u64().unwrap_or(1);

        let should_write_default = match fs::read_to_string(&file_path) {
            Ok(content) => match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(existing_value) => {
                    existing_value["version"].as_u64().unwrap_or(0) < bundled_version
                }
                Err(_) => true,
            },
            Err(_) => true,
        };

        if should_write_default {
            let content = serde_json::to_string_pretty(&bundled_value)
                .map_err(|e| format!("failed to serialize filter config: {}", e))?;
            fs::write(&file_path, content)
                .map_err(|e| format!("failed to write shared filter config: {}", e))?;
        }

        Ok(file_path)
    }

    pub fn ensure_shared_download_filter_config<R: Runtime>(
        app: &AppHandle<R>,
    ) -> Result<PathBuf, String> {
        let base_path_str = Self::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "base path is not configured".to_string())?;
        Self::ensure_shared_download_filter_config_in_base_path(Path::new(&base_path_str))
    }

    fn get_settings_json<R: Runtime>(app: &AppHandle<R>) -> Option<serde_json::Value> {
        if let Ok(Some(base_path_str)) = Self::get_base_path(app) {
            let file_path = PathBuf::from(base_path_str)
                .join("config")
                .join("settings.json");
            if file_path.exists() {
                if let Ok(content) = fs::read_to_string(file_path) {
                    return serde_json::from_str(&content).ok();
                }
            }
        }
        None
    }

    pub fn get_download_settings<R: Runtime>(app: &AppHandle<R>) -> DownloadSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/download") {
                if let Ok(s) = serde_json::from_value(val.clone()) {
                    return s;
                }
            }
        }
        DownloadSettings::default()
    }

    pub fn get_java_settings<R: Runtime>(app: &AppHandle<R>) -> JavaSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/java") {
                if let Ok(s) = serde_json::from_value(val.clone()) {
                    return s;
                }
            }
        }
        JavaSettings::default()
    }

    pub fn get_playtime_sync_settings<R: Runtime>(app: &AppHandle<R>) -> PlaytimeSyncSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/playtimeSync") {
                if let Ok(s) = serde_json::from_value(val.clone()) {
                    return s;
                }
            }
        }

        PlaytimeSyncSettings::default()
    }

    pub fn get_game_settings<R: Runtime>(app: &AppHandle<R>) -> GameSettings {
        if let Some(json) = Self::get_settings_json(app) {
            if let Some(val) = json.pointer("/state/settings/game") {
                if let Ok(s) = serde_json::from_value(val.clone()) {
                    return s;
                }
            }
        }
        GameSettings::default()
    }

    pub fn set_base_path<R: Runtime>(app: &AppHandle<R>, target_path: &str) -> Result<(), String> {
        let target = Path::new(target_path);

        if target.exists() {
            let mut entries = fs::read_dir(target).map_err(|e| e.to_string())?;
            // 如果目录不为空
            if entries.next().is_some() {
                // ✅ 核心修改：检测是否为旧版数据目录特征
                let is_old_dir = target.join("instances").exists()
                    || target.join("config").join("settings.json").exists();

                // 检测是否为默认的数据目录，沙盒平台下默认数据目录可能预置了系统文件或非空
                let is_default_dir = if let Ok(default_dir) = app.path().app_data_dir() {
                    if let (Ok(p1), Ok(p2)) = (default_dir.canonicalize(), target.canonicalize()) {
                        p1 == p2
                    } else {
                        default_dir == target
                    }
                } else {
                    false
                };

                // 如果既不为空，又不是旧目录，也不是默认数据目录，则拦截
                if !is_old_dir && !is_default_dir {
                    return Err(
                        "所选目录不为空，且未检测到旧版 PiLauncher 数据！请选择空目录。"
                            .to_string(),
                    );
                }
            }
        } else {
            fs::create_dir_all(target).map_err(|e| e.to_string())?;
        }

        Self::ensure_base_layout(target)?;

        Self::ensure_shared_download_filter_config_in_base_path(target)?;
        let meta_path = Self::get_meta_path(app).map_err(|e| e.to_string())?;
        let data = serde_json::to_vec(&serde_json::json!({ "base_path": target_path }))
            .map_err(|e| e.to_string())?;
        Self::write_meta_atomically(&meta_path, &data)?;
        Ok(())
    }

    fn ensure_base_layout(target: &Path) -> Result<(), String> {
        let dirs_to_create = [
            target.join("runtime").join("assets"),
            target.join("runtime").join("libraries"),
            target.join("runtime").join("versions"),
            target.join("instances"),
            target.join("config"),
            target.join("shared_mods"),
        ];

        // 创建缺失的子层级（如果旧目录缺少某一项，顺手补齐）
        for dir in dirs_to_create {
            if !dir.exists() {
                fs::create_dir_all(&dir)
                    .map_err(|e| format!("创建目录失败 {}: {}", dir.display(), e))?;
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::{ConfigService, DownloadSettings};
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(label: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("pilauncher-{label}-{unique}"))
    }

    #[test]
    fn atomically_replaces_base_path_metadata_and_removes_temporary_files() {
        let root = unique_test_root("meta-atomic");
        fs::create_dir_all(&root).unwrap();
        let meta_path = root.join("meta.json");
        fs::write(&meta_path, r#"{"base_path":"old"}"#).unwrap();

        ConfigService::write_meta_atomically(&meta_path, br#"{"base_path":"new"}"#).unwrap();

        assert_eq!(
            ConfigService::read_base_path_from_meta(&meta_path).as_deref(),
            Some("new")
        );
        assert!(!meta_path.with_extension("json.tmp").exists());
        assert!(!meta_path.with_extension("json.bak").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backup_metadata_remains_readable_after_an_interrupted_commit() {
        let root = unique_test_root("meta-backup");
        fs::create_dir_all(&root).unwrap();
        let meta_path = root.join("meta.json");
        let backup_path = meta_path.with_extension("json.bak");
        fs::write(&backup_path, r#"{"base_path":"recoverable"}"#).unwrap();

        assert_eq!(
            ConfigService::read_base_path_from_meta(&backup_path).as_deref(),
            Some("recoverable")
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn converts_speed_limits_using_the_selected_unit() {
        let mb_per_second = DownloadSettings {
            speed_limit: 10,
            speed_unit: "MB/s".to_string(),
            ..DownloadSettings::default()
        };
        let megabits_per_second = DownloadSettings {
            speed_limit: 10,
            speed_unit: "Mbps".to_string(),
            ..DownloadSettings::default()
        };

        assert_eq!(
            ConfigService::download_speed_limit_bytes_per_sec(&mb_per_second),
            10 * 1024 * 1024
        );
        assert_eq!(
            ConfigService::download_speed_limit_bytes_per_sec(&megabits_per_second),
            1_250_000
        );
    }
}
