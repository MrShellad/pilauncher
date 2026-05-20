// src-tauri/src/domain/manifest.rs
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstanceManifest {
    pub version_info: VersionInfo,
    pub launch_control: LaunchControl,
    pub conditions: Vec<Rule>,
    pub downloads: DownloadSystem,
    pub libraries: Vec<LibraryMeta>,
    pub resources: ResourceIndexRef,
    pub java_env: JavaEnvironment,
    pub mods: Vec<ModManifest>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VersionInfo {
    pub id: String,
    pub r#type: String,
    pub main_class: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LaunchControl {
    pub game_args: Vec<String>,
    pub jvm_args: Vec<String>,
    pub window: WindowSettings,
    pub quick_play: Option<QuickPlayConfig>,
    pub demo: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WindowSettings {
    pub width: u32,
    pub height: u32,
    pub fullscreen: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct QuickPlayConfig {
    pub path: String,
    pub singleplayer: Option<String>,
    pub multiplayer: Option<String>,
    pub realms: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadSystem {
    pub client: Option<DownloadFile>,
    pub client_mappings: Option<DownloadFile>,
    pub server: Option<DownloadFile>,
    pub server_mappings: Option<DownloadFile>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadFile {
    pub url: String,
    pub sha1: String,
    pub size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Rule {
    pub action: String, // "allow" or "disallow"
    pub os: Option<OsRule>,
    pub features: Option<HashMap<String, bool>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OsRule {
    pub name: Option<String>,    // "windows", "osx", "linux"
    pub version: Option<String>, // regex
    pub arch: Option<String>,    // "x86", "arm"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryMeta {
    pub name: String, // maven coordinate
    pub downloads: Option<LibraryDownloadsMeta>,
    pub rules: Option<Vec<Rule>>,
    pub natives: Option<HashMap<String, String>>, // OS -> classifier mapping
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryDownloadsMeta {
    pub artifact: Option<DownloadFile>,
    pub classifiers: Option<HashMap<String, DownloadFile>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResourceIndexRef {
    pub id: String, // e.g. "1.19"
    pub sha1: String,
    pub size: u64,
    pub url: String,
    pub total_size: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JavaEnvironment {
    pub path: String,              // "auto" or absolute path
    pub version: String,           // game java version string e.g. "17"
    pub component: Option<String>, // mojang component name "jre-legacy"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ModManifest {
    pub name: String,
    pub version: Option<String>,
    pub path: String, // path relative to mods folder
    pub download: Option<DownloadFile>,
    pub active: bool,
}
