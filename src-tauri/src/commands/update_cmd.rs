// src-tauri/src/commands/update_cmd.rs
//
// 灰度更新检查：通过自定义 API 端点查询最新版本信息，
// 并将用户 MC 账号 UUID 与 region 注入查询参数，实现灰度发布控制。

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Runtime};

/// 前端可读的更新信息结构
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UpdateInfo {
    /// 是否有可用更新
    pub available: bool,
    /// 新版本号（若无更新则为当前版本）
    pub version: String,
    /// 更新日志（Markdown 格式）
    pub body: String,
    /// 安装包下载直链（供 install_update 使用）
    pub url: String,
    /// 签名字符串（供验证完整性）
    pub signature: String,
}

/// 来自灰度 API 的原始 JSON 响应结构
/// 兼容 Tauri updater JSON v2 格式
#[derive(Debug, Deserialize)]
struct ApiUpdateResponse {
    version: String,
    notes: Option<String>,
    platforms: Option<serde_json::Value>,
    url: Option<String>,
    signature: Option<String>,
}

/// 检查灰度更新
/// 
/// # 参数
/// - `app`       Tauri AppHandle，用于读取当前版本信息
/// - `uuid`      用户正版 MC 账号 UUID（含分隔符，如 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
/// - `region`    地区标识，目前统一传入 `CN`
#[tauri::command]
pub async fn check_update<R: Runtime>(
    app: AppHandle<R>,
    uuid: String,
    region: String,
) -> Result<UpdateInfo, String> {
    // 1. 获取当前版本
    let current_version = app.package_info().version.to_string();

    // 2. 获取平台 target 和 arch
    let target = get_target();
    let arch = get_arch();

    // 3. 构建灰度 API URL
    let endpoint = format!(
        "https://pil.nav4ai.net/api/updater?version={}&target={}&arch={}&uuid={}&region={}",
        urlencoding::encode(&current_version),
        urlencoding::encode(&target),
        urlencoding::encode(&arch),
        urlencoding::encode(&uuid),
        urlencoding::encode(&region),
    );

    println!("[Updater] 🔍 正在检查更新: {}", endpoint);

    // 4. 发起 HTTP 请求
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("构建 HTTP 客户端失败: {}", e))?;

    let resp = client
        .get(&endpoint)
        .header("User-Agent", format!("PiLauncher/{}", current_version))
        .send()
        .await
        .map_err(|e| format!("请求更新服务器失败: {}", e))?;

    let status = resp.status();

    // 5. 无更新时服务端返回 204 No Content
    if status == reqwest::StatusCode::NO_CONTENT || status == reqwest::StatusCode::NOT_MODIFIED {
        println!("[Updater] ✅ 当前已是最新版本 v{}", current_version);
        return Ok(UpdateInfo {
            available: false,
            version: current_version,
            body: String::new(),
            url: String::new(),
            signature: String::new(),
        });
    }

    if !status.is_success() {
        return Err(format!("更新服务器返回异常状态码: {}", status));
    }

    // 6. 解析响应 JSON
    let update: ApiUpdateResponse = resp
        .json()
        .await
        .map_err(|e| format!("解析更新响应失败: {}", e))?;

    // 7. 从 platforms 字段中提取当前平台的 url 和 signature（Tauri v2 格式）
    let (dl_url, signature) = extract_platform_assets(&update, &target, &arch);

    println!(
        "[Updater] 🆕 发现新版本 v{} (当前 v{})",
        update.version, current_version
    );

    Ok(UpdateInfo {
        available: true,
        version: update.version,
        body: update.notes.unwrap_or_default(),
        url: dl_url,
        signature,
    })
}

/// 提取当前平台对应的下载 URL 和签名
fn extract_platform_assets(
    update: &ApiUpdateResponse,
    target: &str,
    arch: &str,
) -> (String, String) {
    // 尝试 platforms 字段（Tauri v2 updater JSON 格式）
    if let Some(platforms) = &update.platforms {
        // 尝试 "windows-x86_64" 格式的 key
        let key = format!("{}-{}", target, arch);
        if let Some(platform) = platforms.get(&key) {
            let url = platform
                .get("url")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let sig = platform
                .get("signature")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            return (url, sig);
        }

        // 回退：直接遍历第一个平台
        if let Some(obj) = platforms.as_object() {
            if let Some(first) = obj.values().next() {
                let url = first
                    .get("url")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                let sig = first
                    .get("signature")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                return (url, sig);
            }
        }
    }

    // 回退：顶层 url/signature 字段（简化版服务端响应）
    (
        update.url.clone().unwrap_or_default(),
        update.signature.clone().unwrap_or_default(),
    )
}

/// 获取运行时 target 字符串
fn get_target() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "macos")]
    return "darwin".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
}

/// 获取运行时 arch 字符串
fn get_arch() -> String {
    #[cfg(target_arch = "x86_64")]
    return "x86_64".to_string();
    #[cfg(target_arch = "aarch64")]
    return "aarch64".to_string();
    #[cfg(not(any(target_arch = "x86_64", target_arch = "aarch64")))]
    return std::env::consts::ARCH.to_string();
}
