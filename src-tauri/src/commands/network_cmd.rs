// src-tauri/src/commands/network_cmd.rs
use crate::services::qrcode_service;
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::net::{TcpStream, ToSocketAddrs};
use std::time::{Duration, Instant};
use sysinfo::System;

#[derive(Debug, Serialize, Deserialize)]
pub struct DomainTestResult {
    pub domain: String,
    pub dns: bool,
    pub dns_info: String,
    pub tcp: bool,
    pub tls: bool,
    pub http: bool,
    pub latency: u64, // ms
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkTestReport {
    pub domains: Vec<DomainTestResult>,
    pub system: SystemInfo,
    pub network: NetworkInfo,
    pub timestamp: String,
    pub qrcode_uri: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub arch: String,
    pub cpu: String,
    pub memory: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkInfo {
    pub local_ip: String,
    pub dns_servers: Vec<String>,
}

#[tauri::command]
pub async fn run_network_test() -> Result<NetworkTestReport, String> {
    let domains = vec![
        "login.microsoftonline.com",
        "auth.xboxlive.com",
        "api.minecraftservices.com",
        "api.mojang.com",
        "sessionserver.mojang.com",
        "meta.fabricmc.net",
        "api.curseforge.com",
        "modrinth.com",
        "bmclapi2.bangbang93.com",
        "api.adoptium.net",
        "api.azul.com",
        "aka.ms",
    ];

    let mut results = Vec::new();

    for &domain in &domains {
        results.push(test_domain(domain).await);
    }

    // Collect system info
    let mut sys = System::new_all();
    sys.refresh_all();

    let system_info = SystemInfo {
        os: format!(
            "{} {}",
            System::name().unwrap_or_default(),
            System::os_version().unwrap_or_default()
        ),
        arch: System::cpu_arch(),
        cpu: sys
            .cpus()
            .first()
            .map(|c| c.brand().to_string())
            .unwrap_or_default(),
        memory: format!(
            "{:.2} GB / {:.2} GB",
            sys.used_memory() as f64 / 1024.0 / 1024.0 / 1024.0,
            sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0
        ),
    };

    // Network info
    let local_ip = local_ip_address::local_ip()
        .map(|ip| ip.to_string())
        .unwrap_or_else(|_| "Unknown".to_string());

    let network_info = NetworkInfo {
        local_ip,
        dns_servers: vec![], // Placeholder
    };

    let report = NetworkTestReport {
        domains: results,
        system: system_info,
        network: network_info,
        timestamp: chrono::Local::now().to_rfc3339(),
        qrcode_uri: None,
    };

    // Generate QR code from JSON data
    let json_data = serde_json::to_string(&report).map_err(|e| e.to_string())?;
    // Base64 encode the JSON
    let base64_data = base64::engine::general_purpose::STANDARD.encode(json_data.as_bytes());
    let qrcode_uri = qrcode_service::generate_qr_data_uri(&base64_data).ok();

    let mut final_report = report;
    final_report.qrcode_uri = qrcode_uri;

    Ok(final_report)
}

async fn test_domain(domain: &str) -> DomainTestResult {
    let start = Instant::now();
    let mut result = DomainTestResult {
        domain: domain.to_string(),
        dns: false,
        dns_info: String::new(),
        tcp: false,
        tls: false,
        http: false,
        latency: 0,
    };

    // 1. DNS Resolution
    let addr_str = format!("{}:443", domain);
    match addr_str.to_socket_addrs() {
        Ok(mut addrs) => {
            if let Some(addr) = addrs.next() {
                result.dns = true;
                result.dns_info = addr.ip().to_string();

                // 2. TCP Connection
                let tcp_start = Instant::now();
                match TcpStream::connect_timeout(&addr, Duration::from_secs(3)) {
                    Ok(_) => {
                        result.tcp = true;
                        result.latency = tcp_start.elapsed().as_millis() as u64;

                        // 3. HTTP & TLS Request using reqwest
                        // reqwest handles TLS handshake automatically
                        let client = reqwest::Client::builder()
                            .timeout(Duration::from_secs(5))
                            .build()
                            .unwrap();

                        match client.get(format!("https://{}", domain)).send().await {
                            Ok(_) => {
                                result.tls = true;
                                result.http = true;
                            }
                            Err(e) => {
                                // If TLS fails it might still be a成功的 TCP connect
                                // We can distinguish between TLS and HTTP failure if needed
                                // but usually for these domains, if HTTP fails, it's a connectivity issue.
                                if e.is_connect() || e.is_timeout() {
                                    // already fail
                                } else if e.to_string().contains("SSL")
                                    || e.to_string().contains("tls")
                                {
                                    // TLS failure
                                } else {
                                    // HTTP failure
                                    result.tls = true; // TCP was ok, TLS might have been ok but HTTP errored
                                }
                            }
                        }
                    }
                    Err(_) => {}
                }
            }
        }
        Err(_) => {
            result.dns_info = "Resolution failed".to_string();
        }
    }

    if result.latency == 0 {
        result.latency = start.elapsed().as_millis() as u64;
    }

    result
}
