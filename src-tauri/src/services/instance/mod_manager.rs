// src-tauri/src/services/instance/mod_manager.rs
use crate::services::config_service::ConfigService;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap; // ✅ 引入哈希表用于缓存
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModMetadata {
    pub file_name: String,
    pub mod_id: Option<String>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub icon_absolute_path: Option<String>, // JAR包内提取的物理图标
    pub network_icon_url: Option<String>,   // 网络缓存的图标 URL
    pub file_size: u64,
    pub is_enabled: bool, // 修复报错：状态字段
    pub modified_at: u64, // 新增：记录文件修改时间的时间戳
}

// 定义一个用于网络数据缓存的结构体
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ModCacheInfo {
    pub name: Option<String>,
    pub description: Option<String>,
    pub icon_url: Option<String>,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ModSnapshot {
    pub id: String,
    pub timestamp: String,
    pub mod_count: usize,
    pub description: String,
}

// ✅ 手柄 Mod 缓存元数据（存储在 shared_mods/gamepad_meta.json）
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GamepadModMeta {
    pub file_name: String,
    pub download_url: String,
    pub cached_at: u64,
}

// ✅ 手柄 Mod 状态检测结果，返回给前端
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GamepadModStatus {
    pub installed: bool,           // 实例 mods/ 中是否已存在手柄 mod
    pub needs_install: bool,       // 完全没有，需要安装
    pub needs_update: bool,        // 有但版本旧，可以更新（由前端 API 比对）
    pub local_file_name: Option<String>,  // 本地已安装/缓存的文件名
    pub remote_file_name: Option<String>, // 远端最新文件名（由前端填充）
    pub has_cache: bool,           // shared_mods 中是否有缓存
}

pub struct ModManagerService;

impl ModManagerService {
    fn get_instance_dir<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
        let base_path = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();
        Ok(PathBuf::from(base_path).join("instances").join(id))
    }

    // ================= 1. 读取并解析 Mods =================
    pub fn get_mods<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<Vec<ModMetadata>, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let mods_dir = instance_dir.join("mods");
        let piconfig_dir = instance_dir.join("piconfig");
        let icons_dir = piconfig_dir.join("mod_icons");
        let cache_path = piconfig_dir.join("mod_cache.json"); // 缓存文件位置

        fs::create_dir_all(&mods_dir).ok();
        fs::create_dir_all(&icons_dir).ok();

        // ✅ 读取本地缓存字典
        let cache_dict: HashMap<String, ModCacheInfo> = if cache_path.exists() {
            let content = fs::read_to_string(&cache_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        let mut mods = Vec::new();

        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    if file_name.ends_with(".jar") || file_name.ends_with(".jar.disabled") {
                        let is_enabled = !file_name.ends_with(".disabled");
                        let base_name = file_name.trim_end_matches(".disabled").to_string(); // 用去掉 disabled 的原名做key

                        let mut meta = Self::parse_single_jar(&path, &icons_dir);
                        meta.is_enabled = is_enabled;

                        // ✅ 兜底逻辑：优先使用JAR包内的结果，如果没有，从本地缓存补充网络信息
                        if let Some(cached) = cache_dict.get(&base_name) {
                            if meta.name.is_none() {
                                meta.name = cached.name.clone();
                            }
                            if meta.description.is_none() {
                                meta.description = cached.description.clone();
                            }
                            meta.network_icon_url = cached.icon_url.clone();
                        }

                        mods.push(meta);
                    }
                }
            }
        }

        mods.sort_by(|a, b| {
            b.is_enabled
                .cmp(&a.is_enabled)
                .then_with(|| a.file_name.cmp(&b.file_name))
        });
        Ok(mods)
    }

    fn parse_single_jar(jar_path: &Path, icons_dir: &Path) -> ModMetadata {
        let file_name = jar_path.file_name().unwrap().to_string_lossy().to_string();
        let file_size = fs::metadata(jar_path).map(|m| m.len()).unwrap_or(0);

        let modified_at = fs::metadata(jar_path)
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut meta = ModMetadata {
            file_name: file_name.clone(),
            mod_id: None,
            name: None,
            version: None,
            description: None,
            icon_absolute_path: None,
            network_icon_url: None,
            file_size,
            is_enabled: true,
            modified_at, // ✅ 赋值给结构体
        };

        if let Ok(file) = File::open(jar_path) {
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                let mut icon_to_extract = None;

                if let Ok(mut mod_json) = archive.by_name("fabric.mod.json") {
                    let mut contents = String::new();
                    if mod_json.read_to_string(&mut contents).is_ok() {
                        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                            meta.mod_id = json["id"].as_str().map(|s| s.to_string());
                            meta.name = json["name"].as_str().map(|s| s.to_string());
                            meta.version = json["version"].as_str().map(|s| s.to_string());
                            meta.description = json["description"].as_str().map(|s| s.to_string());
                            if let Some(icon_path) = json["icon"].as_str() {
                                icon_to_extract = Some(icon_path.to_string());
                            }
                        }
                    }
                }

                if let Some(icon_path) = icon_to_extract {
                    if let Ok(mut icon_file) = archive.by_name(&icon_path) {
                        let ext = Path::new(&icon_path)
                            .extension()
                            .unwrap_or_default()
                            .to_string_lossy();
                        let target_icon = icons_dir.join(format!(
                            "{}.{}",
                            meta.mod_id.as_ref().unwrap_or(&file_name),
                            ext
                        ));
                        if let Ok(mut out_file) = File::create(&target_icon) {
                            std::io::copy(&mut icon_file, &mut out_file).ok();
                            meta.icon_absolute_path =
                                Some(target_icon.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
        meta
    }

    // ✅ 新增：将前端获取到的网络数据持久化写入 mod_cache.json
    pub fn update_mod_cache<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        file_name: &str,
        name: &str,
        desc: &str,
        icon_url: &str,
    ) -> Result<(), String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let piconfig = instance_dir.join("piconfig");
        fs::create_dir_all(&piconfig).ok();

        let cache_path = piconfig.join("mod_cache.json");
        let mut cache: HashMap<String, ModCacheInfo> = if cache_path.exists() {
            let content = fs::read_to_string(&cache_path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            HashMap::new()
        };

        // 以原文件名 (不带 .disabled) 为 Key 存入
        cache.insert(
            file_name.to_string(),
            ModCacheInfo {
                name: Some(name.to_string()),
                description: Some(desc.to_string()),
                icon_url: Some(icon_url.to_string()),
            },
        );

        let new_content = serde_json::to_string_pretty(&cache).unwrap();
        fs::write(&cache_path, new_content).map_err(|e| e.to_string())?;

        Ok(())
    }

    // ✅ 新增：检测手柄 Mod 并更新 instance.json
    pub fn check_and_update_gamepad<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
    ) -> Result<bool, String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let config_path = instance_dir.join("instance.json");
        let mods_dir = instance_dir.join("mods");

        // 读取当前 instance.json
        let mut config: Option<crate::domain::instance::InstanceConfig> = None;
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                config = serde_json::from_str(&content).ok();
            }
        }

        let mut has_gamepad = false;
        if let Ok(entries) = fs::read_dir(&mods_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_lowercase();
                    // 仅判断启用的 mod (.jar)
                    if file_name.ends_with(".jar") && !file_name.ends_with(".disabled") {
                        if file_name.contains("controllable") || file_name.contains("midnightcontrols") || file_name.contains("controlify") {
                            has_gamepad = true;
                            break;
                        }
                    }
                }
            }
        }

        // 保存检测结果回 instance.json
        if let Some(mut cfg) = config {
            cfg.gamepad = Some(has_gamepad);
            if let Ok(new_content) = serde_json::to_string_pretty(&cfg) {
                let _ = fs::write(&config_path, new_content);
            }
        }

        Ok(has_gamepad)
    }

    // ✅ 获取 shared_mods 目录
    fn get_shared_mods_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base_path_str = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .unwrap_or_default();
        let dir = PathBuf::from(base_path_str).join("shared_mods");
        fs::create_dir_all(&dir).ok();
        Ok(dir)
    }

    // ✅ 读取 gamepad_meta.json 缓存
    fn read_gamepad_meta<R: Runtime>(app: &AppHandle<R>) -> Result<HashMap<String, GamepadModMeta>, String> {
        let shared_dir = Self::get_shared_mods_dir(app)?;
        let meta_path = shared_dir.join("gamepad_meta.json");
        if meta_path.exists() {
            let content = fs::read_to_string(&meta_path).unwrap_or_default();
            Ok(serde_json::from_str(&content).unwrap_or_default())
        } else {
            Ok(HashMap::new())
        }
    }

    // ✅ 写入 gamepad_meta.json 缓存
    fn write_gamepad_meta<R: Runtime>(app: &AppHandle<R>, meta: &HashMap<String, GamepadModMeta>) -> Result<(), String> {
        let shared_dir = Self::get_shared_mods_dir(app)?;
        let meta_path = shared_dir.join("gamepad_meta.json");
        let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
        fs::write(&meta_path, content).map_err(|e| e.to_string())?;
        Ok(())
    }

    // ✅ 手柄 Mod 状态检测（纯本地检测，不再拉取远端配置）
    // 前端通过 Modrinth/CurseForge API 动态解析下载链接
    pub async fn check_gamepad_mod_status<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<GamepadModStatus, String> {
        // 1. 检查实例 mods/ 中是否已安装手柄 mod
        let installed = Self::check_and_update_gamepad(app, instance_id)?;

        if installed {
            return Ok(GamepadModStatus {
                installed: true,
                needs_install: false,
                needs_update: false,
                local_file_name: None,
                remote_file_name: None,
                has_cache: false,
            });
        }

        // 2. 检查 shared_mods 缓存
        let meta = Self::read_gamepad_meta(app)?;
        let loader_key = loader_type.to_lowercase();
        let cache_key = format!("{}_{}", mc_version, loader_key);
        let cached = meta.get(&cache_key);
        let has_cache = cached.map_or(false, |c| {
            let shared_dir = Self::get_shared_mods_dir(app).unwrap_or_default();
            shared_dir.join(&c.file_name).exists()
        });

        let local_fn = cached.map(|c| c.file_name.clone());

        Ok(GamepadModStatus {
            installed: false,
            needs_install: !has_cache,
            needs_update: false, // 更新检测由前端通过 API 比对完成
            local_file_name: local_fn,
            remote_file_name: None,
            has_cache,
        })
    }

    // ✅ 从远端 URL 下载指定 Mod 到实例的 mods 文件夹，并缓存到 shared_mods
    pub async fn install_remote_mod<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        download_url: &str,
        file_name: &str,
        mc_version: &str,
        loader_type: &str,
    ) -> Result<(), String> {
        let instance_dir = Self::get_instance_dir(app, instance_id)?;
        let mods_dir = instance_dir.join("mods");
        fs::create_dir_all(&mods_dir).ok();

        let target_path = mods_dir.join(file_name);
        let shared_mods_dir = Self::get_shared_mods_dir(app)?;
        let shared_target = shared_mods_dir.join(file_name);
        let mut needs_download = true;

        if shared_target.exists() {
            if let Ok(file) = File::open(&shared_target) {
                if zip::ZipArchive::new(file).is_ok() {
                    needs_download = false;
                }
            }
        }

        if needs_download {
            println!("正在下载推荐 Mod: {}", download_url);
            let client = reqwest::Client::new();
            let mut response = client
                .get(download_url)
                .send()
                .await
                .map_err(|e| format!("下载请求失败: {}", e))?;

            if !response.status().is_success() {
                return Err(format!("下载失败，状态码: {}", response.status()));
            }

            let total_size = response.content_length().unwrap_or(0);
            let mut downloaded: u64 = 0;

            use tokio::io::AsyncWriteExt;
            let mut dest = tokio::fs::File::create(&shared_target)
                .await
                .map_err(|e| format!("无法创建缓存文件: {}", e))?;

            while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
                dest.write_all(&chunk)
                    .await
                    .map_err(|e| format!("写入磁盘失败: {}", e))?;
                downloaded += chunk.len() as u64;

                let _ = app.emit(
                    "resource-download-progress",
                    crate::services::resource_service::ResourceProgressPayload {
                        task_id: file_name.to_string(),
                        file_name: file_name.to_string(),
                        stage: "DOWNLOADING_MOD".to_string(),
                        current: downloaded,
                        total: total_size,
                        message: format!("正在下载手柄组件: {}", file_name),
                    },
                );
            }

            let _ = app.emit(
                "resource-download-progress",
                crate::services::resource_service::ResourceProgressPayload {
                    task_id: file_name.to_string(),
                    file_name: file_name.to_string(),
                    stage: "DONE".to_string(),
                    current: total_size,
                    total: total_size,
                    message: format!("成功: {}", file_name),
                },
            );
        } else {
            println!("从缓存中发现有效的 Mod: {}", file_name);
        }

        fs::copy(&shared_target, &target_path)
            .map_err(|e| format!("复制文件到实例 mods 目录失败: {}", e))?;

        // ✅ 更新 gamepad_meta.json 缓存记录
        let cache_key = format!("{}_{}", mc_version, loader_type.to_lowercase());
        let mut meta = Self::read_gamepad_meta(app)?;
        meta.insert(cache_key, GamepadModMeta {
            file_name: file_name.to_string(),
            download_url: download_url.to_string(),
            cached_at: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
        });
        Self::write_gamepad_meta(app, &meta)?;

        Ok(())
    }

    // 保持你原有的快照功能不变...
    pub fn create_snapshot<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        desc: &str,
    ) -> Result<ModSnapshot, String> {
        /* ... */
        Ok(ModSnapshot {
            id: "".into(),
            timestamp: "".into(),
            mod_count: 0,
            description: "".into(),
        })
    }
    pub fn rollback_snapshot<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        snapshot_id: &str,
    ) -> Result<(), String> {
        /* ... */
        Ok(())
    }
}
