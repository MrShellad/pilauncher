use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Emitter, Runtime};
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
// 引入跨层的 DTO
use crate::domain::resource::{OreProjectDetail, OreProjectVersion, OreProjectDependency};
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
                    d_list.into_iter().map(|d| OreProjectDependency {
                        version_id: d.version_id,
                        project_id: d.project_id,
                        file_name: d.file_name,
                        dependency_type: d.dependency_type,
                    }).collect()
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

        // 2. 发起请求
        let client = Client::new();
        let mut response = client
            .get(url)
            .send()
            .await
            .map_err(|e| format!("请求失败: {}", e))?;

        if !response.status().is_success() {
            return Err(format!("下载失败, HTTP 状态码: {}", response.status()));
        }

        let total_size = response.content_length().unwrap_or(0);
        let mut downloaded: u64 = 0;

        let mut dest = File::create(&target_file_path)
            .await
            .map_err(|e| format!("无法创建文件: {}", e))?;

        const PROGRESS_INTERVAL_MS: u128 = 200;
        let mut last_emit = Instant::now();

        // 3. 边下载，边写入，节流推送进度以便前端计算实时网速
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            dest.write_all(&chunk)
                .await
                .map_err(|e| format!("写入磁盘失败: {}", e))?;
            downloaded += chunk.len() as u64;

            if last_emit.elapsed().as_millis() >= PROGRESS_INTERVAL_MS || downloaded >= total_size {
                let _ = app.emit(
                    "resource-download-progress",
                    ResourceProgressPayload {
                        task_id: file_name.to_string(),
                        file_name: file_name.to_string(),
                        stage: "DOWNLOADING_MOD".to_string(),
                        current: downloaded,
                        total: total_size.max(1),
                        message: format!("正在下载: {}", file_name),
                    },
                );
                last_emit = Instant::now();
            }
        }

        // 4. 下载完成封口事件
        let _ = app.emit(
            "resource-download-progress",
            ResourceProgressPayload {
                task_id: file_name.to_string(),
                file_name: file_name.to_string(),
                stage: "DONE".to_string(),
                current: total_size,
                total: total_size,
                message: format!("成功: 下载完成 {}", file_name),
            },
        );

        Ok(())
    }
}
