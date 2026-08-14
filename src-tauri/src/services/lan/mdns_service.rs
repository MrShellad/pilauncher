// src-tauri/src/services/lan/mdns_service.rs
use crate::domain::lan::DiscoveredDevice;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::sync::OnceLock;
use std::time::Duration;
// ✅ 引入获取真实 IP 的库
use local_ip_address::local_ip;

pub struct MdnsScanner;

fn get_mdns_daemon() -> ServiceDaemon {
    static DAEMON: OnceLock<ServiceDaemon> = OnceLock::new();
    DAEMON
        .get_or_init(|| ServiceDaemon::new().expect("Failed to create mDNS daemon"))
        .clone()
}

impl MdnsScanner {
    /// 启动 mDNS 后台广播服务
    pub fn start_broadcast(device_id: &str, device_name: &str, public_key: &str, http_port: u16) {
        let mdns = get_mdns_daemon();

        let service_type = "_pilauncher._tcp.local.";
        // instance_name 可以包含下划线，这是给人看的 (服务名)
        let instance_name = format!("{}_{}", device_name, device_id);

        // ✅ 核心修复 1：Hostname 绝对不能包含下划线！我们把 UUID 的破折号也去掉，只留纯字母数字
        let clean_hostname = device_id.replace("-", "").to_lowercase();
        let host_name = format!("{}.local.", clean_hostname);

        // ✅ 核心修复 2：动态获取真实的局域网 IPv4 地址。决不能用 0.0.0.0！
        let ip = match local_ip() {
            Ok(addr) => addr.to_string(),
            Err(_) => {
                println!("[mDNS 广播] 警告：无法获取真实内网 IP，广播可能失败");
                "127.0.0.1".to_string()
            }
        };

        let mut properties = HashMap::new();
        properties.insert("version".to_string(), "1.0".to_string());
        properties.insert("device_name".to_string(), device_name.to_string());
        properties.insert("device_id".to_string(), device_id.to_string());
        properties.insert("public_key".to_string(), public_key.to_string());

        let service_info = match ServiceInfo::new(
            service_type,
            &instance_name,
            &host_name, // 传入洗干净的纯净 Hostname
            &ip,        // 传入真实的 192.168.x.x 地址
            http_port,
            properties,
        ) {
            Ok(info) => info,
            Err(e) => {
                println!("[mDNS 广播] 错误：无法创建服务信息 ({})，广播未启动", e);
                return;
            }
        };

        println!(
            "[mDNS 广播] 开始向局域网宣告自己 -> IP: {}, Host: {}",
            ip, host_name
        );

        if let Err(e) = mdns.register(service_info) {
            println!("[mDNS 广播] 错误：注册服务失败 ({})", e);
        }
    }

    /// 停止 mDNS 广播服务
    pub fn stop_broadcast(device_id: &str, device_name: &str) {
        let mdns = get_mdns_daemon();
        let service_type = "_pilauncher._tcp.local.";
        let instance_name = format!("{}_{}", device_name, device_id);
        let fullname = format!("{}.{}", instance_name, service_type);
        if let Err(e) = mdns.unregister(&fullname) {
            println!("[mDNS 广播] 注销服务失败: {}", e);
        } else {
            println!("[mDNS 广播] 成功注销服务: {}", fullname);
        }
    }

    /// 重启 mDNS 广播服务
    pub fn restart_broadcast(
        old_device_id: &str,
        old_device_name: &str,
        new_device_id: &str,
        new_device_name: &str,
        public_key: &str,
        http_port: u16,
    ) {
        Self::stop_broadcast(old_device_id, old_device_name);
        Self::start_broadcast(new_device_id, new_device_name, public_key, http_port);
    }

    /// 阻塞式扫描
    pub async fn scan_for_seconds(seconds: u64) -> Result<Vec<DiscoveredDevice>, String> {
        let mdns = get_mdns_daemon();
        let service_type = "_pilauncher._tcp.local.";
        let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;

        let mut devices = Vec::new();
        let timeout = tokio::time::sleep(Duration::from_secs(seconds));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                _ = &mut timeout => break,
                event = receiver.recv_async() => {
                    println!("[mDNS 雷达] 捕获到底层事件: {:?}", event);

                    if let Ok(ServiceEvent::ServiceResolved(info)) = event {
                        let device_id = info.get_property_val_str("device_id").unwrap_or("").to_string();
                        let device_name = info.get_property_val_str("device_name").unwrap_or("").to_string();
                        let public_key = info.get_property_val_str("public_key").unwrap_or("").to_string();

                        println!("[mDNS 雷达] 发现一台合规设备 -> Name: {}", device_name);

                        if let Some(ip) = info.get_addresses().iter().next() {
                            devices.push(DiscoveredDevice {
                                device_id,
                                device_name,
                                ip: ip.to_string(),
                                port: info.get_port(),
                                public_key,
                            });
                        }
                    }
                }
            }
        }

        let _ = mdns.stop_browse(service_type);
        Ok(devices)
    }
}
