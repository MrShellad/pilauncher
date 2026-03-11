// src-tauri/src/services/modpack_service.rs
use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{
    InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::domain::modpack::ModpackMetadata;
use crate::services::config_service::ConfigService;
use chrono::Local;
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Emitter, Runtime};
use zip::ZipArchive;
// ✅ 并发下载所需的依赖
use futures::stream::{iter, StreamExt};
use reqwest::Client;
use std::sync::Arc;
use tokio::sync::Mutex;

/// 1. 解析整合包元数据 (支持 CurseForge 和 Modrinth)
pub fn parse_modpack(path: &str) -> Result<ModpackMetadata, String> {
    let file = File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("无法读取压缩包: {}", e))?;

    // ==========================================
    // 🔍 尝试一：解析 CurseForge (manifest.json)
    // ==========================================
    if let Ok(mut manifest_file) = archive.by_name("manifest.json") {
        let mut contents = String::new();
        manifest_file
            .read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value =
            serde_json::from_str(&contents).map_err(|e| format!("JSON 解析失败: {}", e))?;

        let name = json["name"].as_str().unwrap_or("未命名整合包").to_string();
        let author = json["author"].as_str().unwrap_or("未知作者").to_string();
        let version = json["minecraft"]["version"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();

        let mut loader = String::from("Vanilla");
        let mut loader_version = String::new();

        if let Some(loaders) = json["minecraft"]["modLoaders"].as_array() {
            if let Some(primary_loader) = loaders
                .iter()
                .find(|l| l["primary"].as_bool().unwrap_or(false))
            {
                let id = primary_loader["id"].as_str().unwrap_or("");
                let parts: Vec<&str> = id.split('-').collect();
                if parts.len() == 2 {
                    let mut c = parts[0].chars();
                    loader = match c.next() {
                        None => String::new(),
                        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                    };
                    loader_version = parts[1].to_string();
                }
            }
        }

        return Ok(ModpackMetadata {
            name,
            version,
            loader,
            loader_version,
            author,
            source: "CurseForge".to_string(),
        });
    }

    // ==========================================
    // 🔍 尝试二：解析 Modrinth (modrinth.index.json)
    // ==========================================
    if let Ok(mut index_file) = archive.by_name("modrinth.index.json") {
        let mut contents = String::new();
        index_file
            .read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value =
            serde_json::from_str(&contents).map_err(|e| format!("JSON 解析失败: {}", e))?;

        let name = json["name"].as_str().unwrap_or("未命名整合包").to_string();
        let version = json["dependencies"]["minecraft"]
            .as_str()
            .unwrap_or("Unknown")
            .to_string();

        let mut loader = String::from("Vanilla");
        let mut loader_version = String::new();

        if let Some(fabric) = json["dependencies"]["fabric-loader"].as_str() {
            loader = "Fabric".to_string();
            loader_version = fabric.to_string();
        } else if let Some(forge) = json["dependencies"]["forge"].as_str() {
            loader = "Forge".to_string();
            loader_version = forge.to_string();
        } else if let Some(neoforge) = json["dependencies"]["neoforge"].as_str() {
            loader = "NeoForge".to_string();
            loader_version = neoforge.to_string();
        } else if let Some(quilt) = json["dependencies"]["quilt-loader"].as_str() {
            loader = "Quilt".to_string();
            loader_version = quilt.to_string();
        }

        return Ok(ModpackMetadata {
            name,
            version,
            loader,
            loader_version,
            author: "Modrinth Creator".to_string(),
            source: "Modrinth".to_string(),
        });
    }

    Err("未识别的整合包格式：压缩包内未找到 manifest.json 或 modrinth.index.json".to_string())
}

/// 2. 整合包导入业务总管
pub async fn execute_import<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_name: &str,
) -> Result<(), String> {
    // 1. 获取全局基础目录
    let base_path_str = crate::services::config_service::ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;
    let base_dir = PathBuf::from(base_path_str);

    // 2. 解析元数据
    let metadata = parse_modpack(zip_path)?;

    // 3. 生成合法安全的文件夹 ID
    let instance_id = instance_name
        .replace(" ", "_")
        .replace("/", "")
        .replace("\\", "");
    let instance_root = base_dir.join("instances").join(&instance_id);

    // 4. 创建实例底层结构
    let sub_dirs = [
        "mods",
        "config",
        "saves",
        "resourcepacks",
        "screenshots",
        "piconfig",
    ];
    for dir in sub_dirs {
        fs::create_dir_all(instance_root.join(dir)).map_err(|e| e.to_string())?;
    }

    // 5. 写入启动配置 instance.json
    let config = InstanceConfig {
        id: instance_id.clone(),
        name: instance_name.to_string(),
        mc_version: metadata.version.clone(),
        loader: LoaderConfig {
            r#type: metadata.loader.to_lowercase(),
            version: metadata.loader_version.clone(),
        },
        java: JavaConfig {
            path: "auto".to_string(),
            version: "auto".to_string(),
        },
        memory: MemoryConfig {
            min: 1024,
            max: 4096,
        },
        resolution: ResolutionConfig {
            width: 1280,
            height: 720,
        },
        play_time: 0.0,
        last_played: "从未游玩".to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        cover_image: None, // ✅ 核心修复：补全缺失的 cover_image 字段
        gamepad: None,
    };
    fs::write(
        instance_root.join("instance.json"),
        serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;

    // 6. 提取本地资源 (overrides)
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "EXTRACTING".to_string(),
            file_name: "overrides".to_string(),
            current: 50,
            total: 100,
            message: "正在解压整合包内的存档、配置与资源...".to_string(),
        },
    );

    extract_overrides(zip_path, &instance_root, &metadata.source).map_err(|e| e.to_string())?;

    // 7. 补全原版核心
    let global_mc_root = base_dir.join("runtime");
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: format!("准备下载补全 Minecraft {} 游戏本体", metadata.version),
        },
    );

    crate::services::downloader::core_installer::install_vanilla_core(
        app,
        &instance_id,
        &metadata.version,
        &global_mc_root,
    )
    .await
    .map_err(|e| e.to_string())?;

    crate::services::downloader::dependencies::download_dependencies(
        app,
        &instance_id,
        &metadata.version,
        &global_mc_root,
    )
    .await
    .map_err(|e| e.to_string())?;

    // 8. 安装 Loader (Fabric/Forge)
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "VANILLA_CORE".to_string(),
            file_name: "".to_string(),
            current: 90,
            total: 100,
            message: format!(
                "正在配置 {} {} 模组加载器...",
                metadata.loader, metadata.loader_version
            ),
        },
    );

    // 调用 Loader 安装器
    crate::services::downloader::loader_installer::install_loader(
        app,
        &instance_id,
        &metadata.version,
        &metadata.loader,
        &metadata.loader_version,
        &global_mc_root,
    )
    .await
    .map_err(|e| e.to_string())?;

    // 9. 拉取整合包 Mod
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "DOWNLOADING_MOD".to_string(),
            file_name: "".to_string(),
            current: 0,
            total: 100,
            message: "准备拉取整合包 Mod...".to_string(),
        },
    );

    fetch_modpack_mods(
        app,
        zip_path,
        &instance_root,
        &metadata.source,
        &instance_id,
    )
    .await?;

    // 10. 全部完成
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "DONE".to_string(),
            file_name: "".to_string(),
            current: 100,
            total: 100,
            message: "整合包环境部署成功！".to_string(),
        },
    );

    Ok(())
}

/// 3. 提取覆盖文件 (overrides)
fn extract_overrides(zip_path: &str, target_dir: &Path, _source: &str) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let override_prefixes = resolve_override_prefixes(&mut archive)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let Some(relative_path) = override_prefixes
            .iter()
            .find_map(|prefix| outpath.strip_prefix(prefix).ok())
        else {
            continue;
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let final_path = target_dir.join(relative_path);

        if file.is_dir() {
            fs::create_dir_all(&final_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = final_path.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&final_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn resolve_override_prefixes<R: Read + std::io::Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<PathBuf>, String> {
    if let Ok(mut manifest_file) = archive.by_name("manifest.json") {
        let mut contents = String::new();
        manifest_file
            .read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        let declared = json["overrides"].as_str().unwrap_or("overrides");
        return Ok(vec![normalize_override_prefix(declared)]);
    }

    if archive.by_name("modrinth.index.json").is_ok() {
        return Ok(vec![
            normalize_override_prefix("overrides"),
            normalize_override_prefix("client-overrides"),
        ]);
    }

    Ok(vec![normalize_override_prefix("overrides")])
}

fn normalize_override_prefix(prefix: &str) -> PathBuf {
    let trimmed = prefix.trim_matches('/').trim_matches('\\');
    if trimmed.is_empty() {
        PathBuf::new()
    } else {
        PathBuf::from(trimmed)
    }
}

/// 4. 路由并启动对应源的 Mod 下载逻辑
async fn fetch_modpack_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    source: &str,
    instance_id: &str,
) -> Result<(), String> {
    if source == "Modrinth" {
        fetch_modrinth_mods(app, zip_path, instance_root, instance_id).await
    } else if source == "CurseForge" {
        fetch_curseforge_mods(app, zip_path, instance_root, instance_id).await
    } else {
        Ok(())
    }
}

/// 5. 并发拉取 Modrinth 源的 Mod 文件
async fn fetch_modrinth_mods<R: Runtime>(
    app: &AppHandle<R>,
    zip_path: &str,
    instance_root: &Path,
    instance_id: &str,
) -> Result<(), String> {
    let contents = {
        let file = File::open(zip_path).map_err(|e| e.to_string())?;
        let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

        let mut index_file = archive
            .by_name("modrinth.index.json")
            .map_err(|e| e.to_string())?;
        let mut data = String::new();
        index_file
            .read_to_string(&mut data)
            .map_err(|e| e.to_string())?;
        data
    };

    let json: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    let mut tasks: Vec<(String, PathBuf, String)> = Vec::new();

    if let Some(files) = json["files"].as_array() {
        for f in files {
            if let Some(env) = f["env"].as_object() {
                if let Some(client_env) = env.get("client").and_then(|v| v.as_str()) {
                    if client_env == "unsupported" {
                        continue;
                    }
                }
            }
            if let Some(url) = f["downloads"]
                .as_array()
                .and_then(|a| a.get(0))
                .and_then(|v| v.as_str())
            {
                if let Some(path) = f["path"].as_str() {
                    let target_path = instance_root.join(path);
                    let file_name = target_path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();
                    tasks.push((url.to_string(), target_path, file_name));
                }
            }
        }
    }

    let total = tasks.len() as u64;
    if total == 0 {
        return Ok(());
    }

    // ✅ 读取用户的并发与限速配置
    let dl_settings = ConfigService::get_download_settings(app);
    let concurrency = if dl_settings.concurrency > 0 {
        dl_settings.concurrency
    } else {
        16
    };
    let limit_per_thread = if dl_settings.speed_limit > 0 {
        (dl_settings.speed_limit * 1024 * 1024) / (concurrency as u64)
    } else {
        0
    };

    let client = Client::builder()
        .user_agent("OreLauncher/1.0")
        .build()
        .unwrap();
    let completed: Arc<Mutex<u64>> = Arc::new(Mutex::new(0));

    let fetches = iter(tasks)
        .map(|(url, path, name): (String, PathBuf, String)| {
            let client = client.clone();
            let app = app.clone();
            let completed = Arc::clone(&completed);
            let i_id = instance_id.to_string();
            let limit = limit_per_thread;

            async move {
                if let Some(parent) = path.parent() {
                    let _ = fs::create_dir_all(parent);
                }

                if !path.exists() {
                    if let Ok(mut res) = client.get(&url).send().await {
                        if res.status().is_success() {
                            // ✅ 精准流式限速机制
                            let mut file_data = Vec::new();
                            while let Ok(Some(chunk)) = res.chunk().await {
                                file_data.extend_from_slice(&chunk);
                                if limit > 0 {
                                    let duration = std::time::Duration::from_secs_f64(
                                        chunk.len() as f64 / limit as f64,
                                    );
                                    tokio::time::sleep(duration).await;
                                }
                            }
                            let _ = fs::write(&path, file_data);
                        }
                    }
                }

                let mut c = completed.lock().await;
                *c += 1;

                let _ = app.emit(
                    "instance-deployment-progress",
                    DownloadProgressEvent {
                        instance_id: i_id,
                        stage: "DOWNLOADING_MOD".to_string(),
                        file_name: name.clone(),
                        current: *c,
                        total,
                        message: format!("正在拉取模组: {} ({}/{})", name, *c, total),
                    },
                );
            }
        })
        .buffer_unordered(concurrency); // ✅ 严格遵循用户设置的并发数

    fetches.collect::<Vec<()>>().await;
    Ok(())
}

/// 6. 拉取 CurseForge 源的 Mod 文件 (待后续补充 CF 算法)
async fn fetch_curseforge_mods<R: Runtime>(
    app: &AppHandle<R>,
    _zip_path: &str,
    _instance_root: &Path,
    instance_id: &str,
) -> Result<(), String> {
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.to_string(),
            stage: "DOWNLOADING_MOD".to_string(),
            file_name: "CurseForge".to_string(),
            current: 0,
            total: 100,
            message: "CurseForge Mod 下载解析准备中...".to_string(),
        },
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::extract_overrides;
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::Path;
    use uuid::Uuid;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    #[test]
    fn extracts_declared_curseforge_override_directory() {
        let temp_root = create_temp_dir("cf_overrides");
        let zip_path = temp_root.join("pack.zip");
        let instance_dir = temp_root.join("instance");

        write_zip(
            &zip_path,
            &[
                (
                    "manifest.json",
                    r#"{"name":"Pack","minecraft":{"version":"1.20.1","modLoaders":[]},"overrides":"my-overrides"}"#,
                ),
                ("my-overrides/config/settings.txt", "ok"),
            ],
        );

        fs::create_dir_all(&instance_dir).unwrap();
        extract_overrides(zip_path.to_str().unwrap(), &instance_dir, "CurseForge").unwrap();

        assert_eq!(
            fs::read_to_string(instance_dir.join("config/settings.txt")).unwrap(),
            "ok"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn extracts_modrinth_client_and_standard_overrides() {
        let temp_root = create_temp_dir("mrpack_overrides");
        let zip_path = temp_root.join("pack.mrpack");
        let instance_dir = temp_root.join("instance");

        write_zip(
            &zip_path,
            &[
                (
                    "modrinth.index.json",
                    r#"{"files":[],"dependencies":{"minecraft":"1.20.1"}}"#,
                ),
                ("client-overrides/options.txt", "graphics=fancy"),
                ("overrides/resourcepacks/demo.txt", "enabled"),
            ],
        );

        fs::create_dir_all(&instance_dir).unwrap();
        extract_overrides(zip_path.to_str().unwrap(), &instance_dir, "Modrinth").unwrap();

        assert_eq!(
            fs::read_to_string(instance_dir.join("options.txt")).unwrap(),
            "graphics=fancy"
        );
        assert_eq!(
            fs::read_to_string(instance_dir.join("resourcepacks/demo.txt")).unwrap(),
            "enabled"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    fn create_temp_dir(prefix: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("{}_{}", prefix, Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_zip(zip_path: &Path, entries: &[(&str, &str)]) {
        let file = File::create(zip_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

        for (name, contents) in entries {
            zip.start_file(name, options).unwrap();
            zip.write_all(contents.as_bytes()).unwrap();
        }

        zip.finish().unwrap();
    }
}
