use serde::{Deserialize, Serialize};
use std::sync::{
    atomic::{AtomicU64, Ordering},
    Arc,
};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::UpdaterExt;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub body: String,
    pub url: String,
    pub signature: String,
}

#[derive(Debug, Deserialize)]
struct ApiUpdateResponse {
    version: String,
    notes: Option<String>,
    platforms: Option<serde_json::Value>,
    url: Option<String>,
    signature: Option<String>,
}

const UPDATE_TASK_ID: &str = "launcher-update";

#[derive(Debug, Serialize, Clone)]
struct UpdateProgressPayload {
    task_id: String,
    title: String,
    version: String,
    stage: String,
    current: u64,
    total: u64,
    message: String,
}

fn emit_update_progress<R: Runtime>(
    app: &AppHandle<R>,
    version: &str,
    stage: &str,
    current: u64,
    total: u64,
    message: impl Into<String>,
) {
    let title = if version.is_empty() {
        "PiLauncher 更新".to_string()
    } else {
        format!("PiLauncher v{}", version)
    };

    let _ = app.emit(
        "launcher-update-progress",
        UpdateProgressPayload {
            task_id: UPDATE_TASK_ID.to_string(),
            title,
            version: version.to_string(),
            stage: stage.to_string(),
            current,
            total,
            message: message.into(),
        },
    );
}

#[tauri::command]
pub async fn check_update<R: Runtime>(
    app: AppHandle<R>,
    uuid: String,
    region: String,
) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();
    let target = get_target();
    let arch = get_arch();
    let endpoint = build_check_endpoint(&current_version, &target, &arch, &uuid, &region);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|error| format!("构建 HTTP 客户端失败: {}", error))?;

    let response = client
        .get(&endpoint)
        .header("User-Agent", format!("PiLauncher/{}", current_version))
        .send()
        .await
        .map_err(|error| format!("请求更新接口失败: {}", error))?;

    let status = response.status();

    if status == reqwest::StatusCode::NO_CONTENT || status == reqwest::StatusCode::NOT_MODIFIED {
        return Ok(UpdateInfo {
            available: false,
            version: current_version,
            body: String::new(),
            url: String::new(),
            signature: String::new(),
        });
    }

    if !status.is_success() {
        return Err(format!("更新服务器返回了异常状态码: {}", status));
    }

    let update: ApiUpdateResponse = response
        .json()
        .await
        .map_err(|error| format!("解析更新响应失败: {}", error))?;

    let (url, signature) = extract_platform_assets(&update, &target, &arch);
    if url.is_empty() || signature.is_empty() {
        return Err("更新清单缺少当前平台的下载地址或签名".to_string());
    }

    Ok(UpdateInfo {
        available: true,
        version: update.version,
        body: update.notes.unwrap_or_default(),
        url,
        signature,
    })
}

#[tauri::command]
pub async fn install_update<R: Runtime>(
    app: AppHandle<R>,
    uuid: String,
    region: String,
    expected_version: Option<String>,
) -> Result<(), String> {
    let endpoint = build_install_endpoint(&uuid, &region, expected_version.as_deref());
    emit_update_progress(
        &app,
        expected_version.as_deref().unwrap_or(""),
        "CHECKING_UPDATE",
        0,
        0,
        "正在检查更新包元数据...",
    );

    let updater = app
        .updater_builder()
        .endpoints(vec![endpoint
            .parse()
            .map_err(|error| format!("更新地址无效: {}", error))?])
        .map_err(|error| format!("配置更新器失败: {}", error))?
        .build()
        .map_err(|error| format!("构建更新器失败: {}", error))?;

    let update = match updater.check().await {
        Ok(Some(update)) => update,
        Ok(None) => {
            let message = "当前没有可安装的更新。".to_string();
            emit_update_progress(
                &app,
                expected_version.as_deref().unwrap_or(""),
                "ERROR",
                0,
                0,
                message.clone(),
            );
            return Err(message);
        }
        Err(error) => {
            let message = format!("解析更新包失败: {}", error);
            emit_update_progress(
                &app,
                expected_version.as_deref().unwrap_or(""),
                "ERROR",
                0,
                0,
                message.clone(),
            );
            return Err(message);
        }
    };

    if let Some(expected_version) = expected_version.as_deref() {
        if update.version != expected_version {
            let message = format!(
                "解析出的更新版本不匹配：预期 {}，实际 {}",
                expected_version, update.version
            );
            emit_update_progress(&app, &update.version, "ERROR", 0, 0, message.clone());
            return Err(message);
        }
    }

    emit_update_progress(
        &app,
        &update.version,
        "DOWNLOADING_UPDATE",
        0,
        0,
        "正在开始下载启动器更新包...",
    );

    let version = update.version.clone();
    let progress_version = version.clone();
    let finish_version = version.clone();
    let progress_app = app.clone();
    let finish_app = app.clone();
    let downloaded_bytes = Arc::new(AtomicU64::new(0));
    let progress_bytes = Arc::clone(&downloaded_bytes);
    let finish_bytes = Arc::clone(&downloaded_bytes);

    if let Err(error) = update
        .download_and_install(
            move |chunk_length, content_length| {
                let current = progress_bytes.fetch_add(chunk_length as u64, Ordering::Relaxed)
                    + chunk_length as u64;
                let total = content_length.unwrap_or(current);
                emit_update_progress(
                    &progress_app,
                    &progress_version,
                    "DOWNLOADING_UPDATE",
                    current,
                    total,
                    "正在下载启动器更新包...",
                );
            },
            move || {
                let current = finish_bytes.load(Ordering::Relaxed);
                emit_update_progress(
                    &finish_app,
                    &finish_version,
                    "INSTALLING_UPDATE",
                    current,
                    current,
                    "下载完成，正在启动安装器...",
                );
            },
        )
        .await
    {
        let current = downloaded_bytes.load(Ordering::Relaxed);
        let message = format!("启动器更新失败: {}", error);
        emit_update_progress(&app, &version, "ERROR", current, current, message.clone());
        return Err(message);
    }

    let final_bytes = downloaded_bytes.load(Ordering::Relaxed);
    emit_update_progress(
        &app,
        &version,
        "DONE",
        final_bytes,
        final_bytes,
        "更新包下载完成，安装器已启动。",
    );

    Ok(())
}

fn extract_platform_assets(
    update: &ApiUpdateResponse,
    target: &str,
    arch: &str,
) -> (String, String) {
    if let Some(platforms) = &update.platforms {
        let key = format!("{}-{}", target, arch);
        if let Some(platform) = platforms.get(&key) {
            let url = platform
                .get("url")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            let signature = platform
                .get("signature")
                .and_then(|value| value.as_str())
                .unwrap_or_default()
                .to_string();
            return (url, signature);
        }

        if let Some(platform_map) = platforms.as_object() {
            if let Some(first_platform) = platform_map.values().next() {
                let url = first_platform
                    .get("url")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                let signature = first_platform
                    .get("signature")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                return (url, signature);
            }
        }
    }

    (
        update.url.clone().unwrap_or_default(),
        update.signature.clone().unwrap_or_default(),
    )
}

fn build_check_endpoint(
    current_version: &str,
    target: &str,
    arch: &str,
    uuid: &str,
    region: &str,
) -> String {
    format!(
        "https://pil.nav4ai.net/api/updater?version={}&target={}&arch={}&uuid={}&region={}",
        urlencoding::encode(current_version),
        urlencoding::encode(target),
        urlencoding::encode(arch),
        urlencoding::encode(uuid),
        urlencoding::encode(region),
    )
}

fn build_install_endpoint(uuid: &str, region: &str, expected_version: Option<&str>) -> String {
    let mut endpoint = format!(
        "https://pil.nav4ai.net/api/updater?version={{{{current_version}}}}&target={{{{target}}}}&arch={{{{arch}}}}&uuid={}&region={}&format=dynamic",
        urlencoding::encode(uuid),
        urlencoding::encode(region),
    );

    if let Some(expected_version) = expected_version {
        endpoint.push_str("&expected_version=");
        endpoint.push_str(&urlencoding::encode(expected_version));
    }

    endpoint
}

fn get_target() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "macos")]
    return "darwin".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
}

fn get_arch() -> String {
    #[cfg(target_arch = "x86_64")]
    return "x86_64".to_string();
    #[cfg(target_arch = "aarch64")]
    return "aarch64".to_string();
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    return std::env::consts::ARCH.to_string();
}
