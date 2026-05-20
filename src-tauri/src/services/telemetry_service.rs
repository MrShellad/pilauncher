use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration as StdDuration;
use sysinfo::System;
use tauri::{AppHandle, Manager, Runtime};
use uuid::Uuid;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

const DEFAULT_TRACK_ENDPOINT: &str = "https://pil.nav4ai.net/api/track/client-installation";
const TELEMETRY_META_FILE: &str = "client_installation_telemetry.json";
const UPLOAD_INTERVAL_DAYS: i64 = 3;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInstallationTelemetry {
    pub installation_id: String,
    pub platform: String,
    pub memory_bytes: u64,
    pub gpu: String,
    pub app_version: String,
    pub first_installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClientInstallationMeta {
    installation_id: String,
    first_installed_at: String,
    #[serde(default)]
    uploaded_at: Option<String>,
    #[serde(default)]
    last_uploaded_version: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientInstallationTrackResult {
    pub uploaded: bool,
    pub skipped: bool,
    pub reason: Option<String>,
    pub installation_id: String,
}

pub async fn track_client_installation<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<ClientInstallationTrackResult, String> {
    let meta_path = telemetry_meta_path(app)?;
    let mut meta = load_or_create_installation_meta(&meta_path)?;
    let app_version = app.package_info().version.to_string();

    let is_new_version = match &meta.last_uploaded_version {
        Some(version) => version != &app_version,
        None => true,
    };

    if !is_new_version && should_skip_upload(meta.uploaded_at.as_deref()) {
        return Ok(ClientInstallationTrackResult {
            uploaded: false,
            skipped: true,
            reason: Some("uploaded-recently".to_string()),
            installation_id: meta.installation_id,
        });
    }

    let Some(api_key) = telemetry_api_key() else {
        return Ok(ClientInstallationTrackResult {
            uploaded: false,
            skipped: true,
            reason: Some("api-key-not-configured".to_string()),
            installation_id: meta.installation_id,
        });
    };

    let payload = build_client_installation_payload(app, &meta).await;
    let endpoint = telemetry_endpoint();
    let client = reqwest::Client::builder()
        .timeout(StdDuration::from_secs(10))
        .build()
        .map_err(|error| format!("Failed to create telemetry HTTP client: {}", error))?;

    let response = client
        .post(&endpoint)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .header(reqwest::header::ACCEPT, "application/json")
        .header("x-api-key", &api_key)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("User-Agent", format!("PiLauncher/{}", payload.app_version))
        .json(&payload)
        .send()
        .await
        .map_err(|error| format!("Failed to upload installation telemetry: {}", error))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!(
            "Installation telemetry upload failed with status {}: {}",
            status, body
        ));
    }

    meta.uploaded_at = Some(utc_iso_timestamp_now());
    meta.last_uploaded_version = Some(app_version);
    write_installation_meta(&meta_path, &meta)?;

    Ok(ClientInstallationTrackResult {
        uploaded: true,
        skipped: false,
        reason: None,
        installation_id: meta.installation_id,
    })
}

async fn build_client_installation_payload<R: Runtime>(
    app: &AppHandle<R>,
    meta: &ClientInstallationMeta,
) -> ClientInstallationTelemetry {
    let app_version = app.package_info().version.to_string();
    let (memory_bytes, gpu) =
        tokio::task::spawn_blocking(|| (detect_memory_bytes(), detect_gpu_name()))
            .await
            .unwrap_or_else(|_| (0, "Unknown".to_string()));

    ClientInstallationTelemetry {
        installation_id: meta.installation_id.clone(),
        platform: platform_label().to_string(),
        memory_bytes,
        gpu,
        app_version,
        first_installed_at: normalize_utc_iso_timestamp(&meta.first_installed_at)
            .unwrap_or_else(|| meta.first_installed_at.clone()),
    }
}

fn telemetry_endpoint() -> String {
    option_env!("CLIENT_INSTALLATION_TRACK_API_URL")
        .unwrap_or(DEFAULT_TRACK_ENDPOINT)
        .trim()
        .to_string()
}

fn telemetry_api_key() -> Option<String> {
    option_env!("CLIENT_INSTALLATION_TRACK_API_KEY")
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
}

fn should_skip_upload(uploaded_at: Option<&str>) -> bool {
    let Some(uploaded_at) = uploaded_at else {
        return false;
    };
    let Ok(last_uploaded_at) = DateTime::parse_from_rfc3339(uploaded_at) else {
        return false;
    };

    let next_allowed_at =
        last_uploaded_at.with_timezone(&Utc) + ChronoDuration::days(UPLOAD_INTERVAL_DAYS);
    Utc::now() < next_allowed_at
}

fn utc_iso_timestamp_now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn normalize_utc_iso_timestamp(value: &str) -> Option<String> {
    DateTime::parse_from_rfc3339(value).ok().map(|timestamp| {
        timestamp
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Millis, true)
    })
}

fn telemetry_meta_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|error| format!("Failed to resolve app config directory: {}", error))?;
    fs::create_dir_all(&config_dir)
        .map_err(|error| format!("Failed to create app config directory: {}", error))?;
    Ok(config_dir.join(TELEMETRY_META_FILE))
}

fn load_or_create_installation_meta(path: &PathBuf) -> Result<ClientInstallationMeta, String> {
    if let Ok(content) = fs::read_to_string(path) {
        if let Ok(mut meta) = serde_json::from_str::<ClientInstallationMeta>(&content) {
            if !meta.installation_id.trim().is_empty() && !meta.first_installed_at.trim().is_empty()
            {
                let mut normalized = false;

                if let Some(first_installed_at) =
                    normalize_utc_iso_timestamp(&meta.first_installed_at)
                {
                    normalized |= first_installed_at != meta.first_installed_at;
                    meta.first_installed_at = first_installed_at;
                }

                if let Some(uploaded_at) = meta
                    .uploaded_at
                    .as_deref()
                    .and_then(normalize_utc_iso_timestamp)
                {
                    normalized |= meta.uploaded_at.as_deref() != Some(uploaded_at.as_str());
                    meta.uploaded_at = Some(uploaded_at);
                }

                if normalized {
                    write_installation_meta(path, &meta)?;
                }

                return Ok(meta);
            }
        }
    }

    let meta = ClientInstallationMeta {
        installation_id: Uuid::new_v4().to_string(),
        first_installed_at: utc_iso_timestamp_now(),
        uploaded_at: None,
        last_uploaded_version: None,
    };
    write_installation_meta(path, &meta)?;
    Ok(meta)
}

fn write_installation_meta(path: &PathBuf, meta: &ClientInstallationMeta) -> Result<(), String> {
    let content = serde_json::to_string_pretty(meta)
        .map_err(|error| format!("Failed to serialize telemetry metadata: {}", error))?;
    fs::write(path, content)
        .map_err(|error| format!("Failed to write telemetry metadata: {}", error))
}

fn platform_label() -> &'static str {
    #[cfg(target_os = "windows")]
    return "Windows";
    #[cfg(target_os = "macos")]
    return "macOS";
    #[cfg(target_os = "linux")]
    return "Linux";
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return std::env::consts::OS;
}

fn detect_memory_bytes() -> u64 {
    let mut system = System::new();
    system.refresh_memory();
    system.total_memory()
}

fn detect_gpu_name() -> String {
    detect_gpu_name_platform().unwrap_or_else(|| "Unknown".to_string())
}

#[cfg(target_os = "windows")]
fn detect_gpu_name_platform() -> Option<String> {
    let mut command = Command::new("powershell.exe");
    command.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        "(Get-CimInstance Win32_VideoController | Where-Object { $_.Name } | Select-Object -First 1 -ExpandProperty Name)",
    ]);
    command.creation_flags(0x08000000);

    first_output_line(command.output().ok()?.stdout)
}

#[cfg(target_os = "macos")]
fn detect_gpu_name_platform() -> Option<String> {
    let output = Command::new("system_profiler")
        .arg("SPDisplaysDataType")
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| line.trim().strip_prefix("Chipset Model:"))
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}

#[cfg(target_os = "linux")]
fn detect_gpu_name_platform() -> Option<String> {
    let output = Command::new("lspci").output().ok()?;
    if !output.status.success() {
        return None;
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|line| {
            let lower = line.to_ascii_lowercase();
            lower.contains("vga compatible controller")
                || lower.contains("3d controller")
                || lower.contains("display controller")
        })
        .map(|line| {
            line.split_once(':')
                .map(|(_, value)| value.trim())
                .unwrap_or(line.trim())
                .to_string()
        })
        .filter(|line| !line.is_empty())
}

#[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
fn detect_gpu_name_platform() -> Option<String> {
    None
}

fn first_output_line(output: Vec<u8>) -> Option<String> {
    String::from_utf8_lossy(&output)
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToOwned::to_owned)
}
