// src-tauri/src/services/downloader/loader_installer.rs
use crate::domain::event::DownloadProgressEvent;
use crate::error::AppResult;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Emitter, Runtime};

pub async fn install_loader<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_type: &str,
    loader_version: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    if loader_type.eq_ignore_ascii_case("Vanilla") || loader_version.is_empty() {
        return Ok(()); // 原版无需安装 Loader
    }

    if loader_type.eq_ignore_ascii_case("Fabric") {
        install_fabric(app, instance_id, mc_version, loader_version, global_mc_root).await?;
    } else if loader_type.eq_ignore_ascii_case("Forge") {
        // TODO: Forge 的安装较为复杂（需要运行 Installer 提取 client.lzma），这里暂时预留
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "ERROR".to_string(),
                file_name: "".to_string(),
                current: 0,
                total: 100,
                message: "当前版本暂未实现 Forge 的自动安装，请期待后续更新".to_string(),
            },
        );
    }

    Ok(())
}

async fn install_fabric<R: Runtime>(
    app: &AppHandle<R>,
    instance_id: &str,
    mc_version: &str,
    loader_version: &str,
    global_mc_root: &Path,
) -> AppResult<()> {
    let client = reqwest::Client::new();
    
    // Fabric 版本的标准命名格式 (例如: fabric-loader-0.15.7-1.20.4)
    let version_id = format!("fabric-loader-{}-{}", loader_version, mc_version);
    let version_dir = global_mc_root.join("versions").join(&version_id);
    fs::create_dir_all(&version_dir)?;

    let json_path = version_dir.join(format!("{}.json", version_id));

    // 1. 从 Fabric Meta API 获取 Profile JSON (国内同样可以使用 BMCLAPI 镜像)
    if !json_path.exists() {
        let _ = app.emit(
            "instance-deployment-progress",
            DownloadProgressEvent {
                instance_id: instance_id.to_string(),
                stage: "VANILLA_CORE".to_string(), // 借用核心阶段的 UI 展示
                file_name: format!("{}.json", version_id),
                current: 90,
                total: 100,
                message: format!("正在配置 Fabric {} 环境...", loader_version),
            },
        );

        let meta_url = format!(
            "https://bmclapi2.bangbang93.com/fabric-meta/v2/versions/loader/{}/{}/profile/json",
            mc_version, loader_version
        );

        let profile_json_text = client.get(&meta_url).send().await?.text().await?;
        fs::write(&json_path, &profile_json_text)?;
    }

    // 2. 极其关键的一步：Fabric 也有自己专属的 Libraries (比如 sponge-mixin, mappings)
    // 我们可以直接复用你写好的 dependencies::download_dependencies 函数！
    // 只需要把版本号指向刚生成的 Fabric 版本即可。
    crate::services::downloader::dependencies::download_dependencies(
        app,
        instance_id,
        &version_id, // 注意这里传入的是 fabric-loader-xxx
        global_mc_root,
    )
    .await?;

    Ok(())
}