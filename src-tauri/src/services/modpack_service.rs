// src-tauri/src/services/modpack_service.rs
use crate::domain::modpack::ModpackMetadata;
use crate::domain::event::DownloadProgressEvent;
use crate::domain::instance::{InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig};
use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};
use zip::ZipArchive;
use tauri::{AppHandle, Emitter, Runtime};
use chrono::Local;

pub fn parse_modpack(path: &str) -> Result<ModpackMetadata, String> {
    // 1. 打开 ZIP 文件
    let file = File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    let mut archive = ZipArchive::new(file).map_err(|e| format!("无法读取压缩包: {}", e))?;

    // ==========================================
    // 🔍 尝试一：解析 CurseForge (manifest.json)
    // ==========================================
    if let Ok(mut manifest_file) = archive.by_name("manifest.json") {
        let mut contents = String::new();
        manifest_file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        
        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|e| format!("JSON 解析失败: {}", e))?;
        
        let name = json["name"].as_str().unwrap_or("未命名整合包").to_string();
        let author = json["author"].as_str().unwrap_or("未知作者").to_string();
        let version = json["minecraft"]["version"].as_str().unwrap_or("Unknown").to_string();
        
        let mut loader = String::from("Vanilla");
        let mut loader_version = String::new();
        
        if let Some(loaders) = json["minecraft"]["modLoaders"].as_array() {
            if let Some(primary_loader) = loaders.iter().find(|l| l["primary"].as_bool().unwrap_or(false)) {
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
            name, version, loader, loader_version, author, source: "CurseForge".to_string(),
        });
    }

    // ==========================================
    // 🔍 尝试二：解析 Modrinth (modrinth.index.json)
    // ==========================================
    if let Ok(mut index_file) = archive.by_name("modrinth.index.json") {
        let mut contents = String::new();
        index_file.read_to_string(&mut contents).map_err(|e| e.to_string())?;
        
        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|e| format!("JSON 解析失败: {}", e))?;
        
        let name = json["name"].as_str().unwrap_or("未命名整合包").to_string();
        let version = json["dependencies"]["minecraft"].as_str().unwrap_or("Unknown").to_string();
        
        let mut loader = String::from("Vanilla");
        let mut loader_version = String::new();
        
        if let Some(fabric) = json["dependencies"]["fabric-loader"].as_str() {
            loader = "Fabric".to_string(); loader_version = fabric.to_string();
        } else if let Some(forge) = json["dependencies"]["forge"].as_str() {
            loader = "Forge".to_string(); loader_version = forge.to_string();
        } else if let Some(neoforge) = json["dependencies"]["neoforge"].as_str() {
            loader = "NeoForge".to_string(); loader_version = neoforge.to_string();
        } else if let Some(quilt) = json["dependencies"]["quilt-loader"].as_str() {
            loader = "Quilt".to_string(); loader_version = quilt.to_string();
        }

        return Ok(ModpackMetadata {
            name, version, loader, loader_version, 
            author: "Modrinth Creator".to_string(), 
            source: "Modrinth".to_string(),
        });
    }

    Err("未识别的整合包格式：压缩包内未找到 manifest.json 或 modrinth.index.json".to_string())
}

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
    let instance_id = instance_name.replace(" ", "_").replace("/", "").replace("\\", "");
    let instance_root = base_dir.join("instances").join(&instance_id);

    // 4. 创建实例底层结构
    let sub_dirs = ["mods", "config", "saves", "resourcepacks", "screenshots", "piconfig"];
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
        memory: MemoryConfig { min: 1024, max: 4096 },
        resolution: ResolutionConfig { width: 1280, height: 720 },
        play_time: 0.0,
        last_played: "从未游玩".to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
    };
    fs::write(
        instance_root.join("instance.json"),
        serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?,
    ).map_err(|e| e.to_string())?;

    // 6. 发送事件：开始解压本地资源
    let _ = app.emit(
        "instance-deployment-progress",
        DownloadProgressEvent {
            instance_id: instance_id.clone(),
            stage: "EXTRACTING".to_string(),
            file_name: "overrides".to_string(),
            current: 50, // 假进度防空跑
            total: 100,
            message: "正在解压整合包内的存档、配置与资源...".to_string(),
        },
    );

    extract_overrides(zip_path, &instance_root, &metadata.source).map_err(|e| e.to_string())?;

    // 7. 发送事件：交接给核心下载器进行环境补全
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

    // 调用你现成的 core_installer
    crate::services::downloader::core_installer::install_vanilla_core(
        app, &instance_id, &metadata.version, &global_mc_root,
    ).await.map_err(|e| e.to_string())?;

    // 调用你现成的 dependencies
    crate::services::downloader::dependencies::download_dependencies(
        app, &instance_id, &metadata.version, &global_mc_root,
    ).await.map_err(|e| e.to_string())?;

    // TODO: (未来在此处解析并下载缺失的 Mod .jar 实体)

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

// ✅ 辅助工具：提取并拷贝 ZIP 中的 overrides 资源
fn extract_overrides(zip_path: &str, target_dir: &Path, source: &str) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    // 大多平台的变动文件都会被塞进 overrides 目录内
    let override_prefix = "overrides/";

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let outpath_str = outpath.to_string_lossy().to_string();
        
        // 我们只关心且只解压 overrides 下的文件（防止恶意 zip 污染磁盘）
        if outpath_str.starts_with(override_prefix) {
            let relative_path = outpath.strip_prefix(override_prefix).unwrap();
            if relative_path.as_os_str().is_empty() { continue; }

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
    }
    Ok(())
}