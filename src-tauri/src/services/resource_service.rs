use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Runtime};
// 引入跨层的 DTO
use crate::domain::resource::{OreProjectDependency, OreProjectDetail, OreProjectVersion};
use crate::services::downloader::transfer::{download_file, DownloadRateLimiter, DownloadTuning};
use crate::services::file_write_lock;

// ==========================================
// 第三方 API (Modrinth) 的私有 DTO 模型
// ==========================================
#[derive(Deserialize)]
struct ModrinthRawProject {
    id: String,
    title: String,
    description: String,
    client_side: String,
    server_side: String,
    downloads: i32,
    followers: i32,
    updated: String,
    icon_url: Option<String>,
    loaders: Vec<String>,
    #[serde(default)]
    game_versions: Vec<String>,
    gallery: Option<Vec<ModrinthRawGallery>>,
}

#[derive(Deserialize)]
struct ModrinthRawGallery {
    url: String,
}

#[derive(Deserialize)]
struct ModrinthRawDependency {
    version_id: Option<String>,
    project_id: Option<String>,
    file_name: Option<String>,
    dependency_type: String,
}

#[derive(Deserialize)]
struct ModrinthRawVersion {
    id: String,
    name: String,
    version_number: String,
    date_published: String,
    loaders: Vec<String>,
    game_versions: Vec<String>,
    files: Vec<ModrinthRawFile>,
    dependencies: Option<Vec<ModrinthRawDependency>>,
}

#[derive(Deserialize)]
struct ModrinthRawFile {
    url: String,
    filename: String,
    primary: bool,
}

// 新增：发射给前端的进度事件结构体
#[derive(Clone, Serialize)]
pub struct ResourceProgressPayload {
    pub task_id: String,
    pub file_name: String,
    pub stage: String,
    pub current: u64,
    pub total: u64,
    pub message: String,
}

// ==========================================
// 服务类
// ==========================================
pub struct ResourceService;

impl ResourceService {
    /// 获取并清洗项目详情
    pub async fn fetch_project_detail(project_id: &str) -> Result<OreProjectDetail, String> {
        let url = format!("https://api.modrinth.com/v2/project/{}", project_id);
        let client = Client::new();

        let raw: ModrinthRawProject = client
            .get(&url)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let gallery_urls = match raw.gallery {
            Some(g) => g.into_iter().map(|img| img.url).collect(),
            None => vec![],
        };

        Ok(OreProjectDetail {
            id: raw.id,
            title: raw.title,
            author: "Unknown".to_string(),
            description: raw.description,
            icon_url: raw.icon_url,
            client_side: raw.client_side,
            server_side: raw.server_side,
            downloads: raw.downloads,
            followers: raw.followers,
            updated_at: raw.updated,
            loaders: raw.loaders,
            game_versions: raw.game_versions,
            gallery_urls,
        })
    }

    /// 获取并清洗版本列表
    pub async fn fetch_project_versions(
        project_id: &str,
        game_version: Option<&str>,
        loader: Option<&str>,
    ) -> Result<Vec<OreProjectVersion>, String> {
        let url = format!("https://api.modrinth.com/v2/project/{}/version", project_id);

        let mut query = Vec::new();
        if let Some(lv) = loader {
            if !lv.is_empty() {
                query.push(("loaders", format!("[\"{}\"]", lv)));
            }
        }
        if let Some(gv) = game_version {
            if !gv.is_empty() {
                query.push(("game_versions", format!("[\"{}\"]", gv)));
            }
        }

        let client = Client::new();
        let raw_versions: Vec<ModrinthRawVersion> = client
            .get(&url)
            .query(&query)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;

        let mut clean_versions = Vec::new();
        for v in raw_versions {
            let primary_file = v
                .files
                .iter()
                .find(|f| f.primary)
                .or_else(|| v.files.first());

            if let Some(file) = primary_file {
                // ✅ 映射依赖关系
                let deps = v.dependencies.map(|d_list| {
                    d_list
                        .into_iter()
                        .map(|d| OreProjectDependency {
                            version_id: d.version_id,
                            project_id: d.project_id,
                            file_name: d.file_name,
                            dependency_type: d.dependency_type,
                        })
                        .collect()
                });

                clean_versions.push(OreProjectVersion {
                    id: v.id,
                    name: v.name,
                    version_number: v.version_number,
                    date_published: v.date_published,
                    loaders: v.loaders,
                    game_versions: v.game_versions,
                    file_name: file.filename.clone(),
                    download_url: file.url.clone(),
                    dependencies: deps, // ✅ 赋值给前端需要的字段
                });
            }
        }

        Ok(clean_versions)
    }

    pub async fn download_resource<R: Runtime>(
        app: &AppHandle<R>,
        url: &str,
        file_name: &str,
        instance_id: &str,
        sub_folder: &str,
    ) -> Result<(), String> {
        // 1. 获取目标绝对路径
        let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)
            .map_err(|_| "无法获取基础路径".to_string())?
            .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

        let target_dir = PathBuf::from(base_path_str)
            .join("instances")
            .join(instance_id)
            .join(sub_folder);

        if !target_dir.exists() {
            tokio::fs::create_dir_all(&target_dir)
                .await
                .map_err(|e| e.to_string())?;
        }

        let target_file_path = target_dir.join(file_name);
        let path_key = target_file_path.to_string_lossy().to_string();

        // 同一路径同时只允许一个写入，避免并发写导致文件损坏
        let path_lock = file_write_lock::lock_for_path(&path_key);
        let _write_guard = path_lock.lock().await;

        // 2. 发起下载（支持分块 / 单连接自动回退）
        let dl_settings =
            crate::services::config_service::ConfigService::get_download_settings(app);
        let mut builder = Client::builder()
            .connect_timeout(std::time::Duration::from_secs(dl_settings.timeout.max(1)));
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
                builder =
                    builder.proxy(reqwest::Proxy::all(&proxy_url).map_err(|e| e.to_string())?);
            }
        }
        let client = builder
            .build()
            .map_err(|e| format!("创建下载客户端失败: {}", e))?;

        let speed_limit_bytes_per_sec =
            crate::services::config_service::ConfigService::download_speed_limit_bytes_per_sec(
                &dl_settings,
            );
        let rate_limiter = if speed_limit_bytes_per_sec > 0 {
            Some(Arc::new(DownloadRateLimiter::new(
                speed_limit_bytes_per_sec,
            )))
        } else {
            None
        };
        let tuning = DownloadTuning {
            chunked_enabled: dl_settings.chunked_download_enabled,
            chunked_threads: dl_settings.chunked_download_threads.max(1),
            chunked_threshold_bytes:
                crate::services::config_service::ConfigService::chunked_download_min_size_bytes(
                    &dl_settings,
                ),
        };
        let temp_target_path = target_file_path.with_extension("download");
        let candidate_urls = vec![url.to_string()];

        let _ = app.emit(
            "resource-download-progress",
            ResourceProgressPayload {
                task_id: file_name.to_string(),
                file_name: file_name.to_string(),
                stage: "DOWNLOADING_MOD".to_string(),
                current: 0,
                total: 100,
                message: format!("正在下载: {}", file_name),
            },
        );

        let no_cancel = Arc::new(std::sync::atomic::AtomicBool::new(false));
        let download_result = download_file(
            &client,
            &candidate_urls,
            &temp_target_path,
            tuning,
            std::time::Duration::from_secs(dl_settings.timeout.max(1)),
            &no_cancel,
            rate_limiter,
            None,
        )
        .await
        .map_err(|e| format!("下载失败: {}", e))?;

        let _ = tokio::fs::rename(&temp_target_path, &target_file_path)
            .await
            .map_err(|e| format!("移动文件失败: {}", e))?;

        // 4. 下载完成封口事件
        let _ = app.emit(
            "resource-download-progress",
            ResourceProgressPayload {
                task_id: file_name.to_string(),
                file_name: file_name.to_string(),
                stage: "DONE".to_string(),
                current: download_result.total_bytes.max(1),
                total: download_result.total_bytes.max(1),
                message: format!("成功: 下载完成 {}", file_name),
            },
        );

        Ok(())
    }
}
