// src-tauri/src/services/lan/mdns_service.rs
use crate::domain::lan::DiscoveredDevice;
use mdns_sd::{ServiceDaemon, ServiceEvent, ServiceInfo};
use std::collections::HashMap;
use std::time::Duration;
use std::sync::OnceLock; // ✅ 引入原生全局锁

pub struct MdnsScanner;

// ✅ 核心修复 1：创建全局单例的 mDNS 守护进程
// mDNS 必须在应用的整个生命周期内存活，否则局部变量一销毁，广播和扫描就会立刻终止！
fn get_mdns_daemon() -> ServiceDaemon {
    static DAEMON: OnceLock<ServiceDaemon> = OnceLock::new();
    DAEMON.get_or_init(|| {
        ServiceDaemon::new().expect("Failed to create mDNS daemon")
    }).clone() // ServiceDaemon 底层是 Arc，克隆极度轻量
}

impl MdnsScanner {
    /// 启动 mDNS 后台广播服务 (对外宣告我的存在)
    pub fn start_broadcast(device_id: &str, device_name: &str, http_port: u16) {
        let mdns = get_mdns_daemon(); // ✅ 使用全局单例守护进程

        let service_type = "_pilauncher._tcp.local.";
        let instance_name = format!("{}_{}", device_name, device_id);
        
        let ip = "0.0.0.0";

        let mut properties = HashMap::new();
        properties.insert("version".to_string(), "1.0".to_string());
        properties.insert("device_name".to_string(), device_name.to_string());
        properties.insert("device_id".to_string(), device_id.to_string());

        let service_info = ServiceInfo::new(
            service_type,
            &instance_name,
            &format!("{}.local.", instance_name),
            ip,
            http_port,
            properties,
        )
        .unwrap();

        // 只要启动器不关，DAEMON 就不死，局域网内的其他人就能一直搜到你！
        mdns.register(service_info)
            .expect("Failed to register mDNS service");
    }

    /// 阻塞式扫描局域网指定时间，并返回拼装好的领域模型给 Command 层
    pub async fn scan_for_seconds(seconds: u64) -> Result<Vec<DiscoveredDevice>, String> {
        let mdns = get_mdns_daemon(); // ✅ 使用全局单例守护进程
        let service_type = "_pilauncher._tcp.local.";
        let receiver = mdns.browse(service_type).map_err(|e| e.to_string())?;

        let mut devices = Vec::new();
        let timeout = tokio::time::sleep(Duration::from_secs(seconds));
        tokio::pin!(timeout);

        loop {
            tokio::select! {
                _ = &mut timeout => break,
                event = receiver.recv_async() => {
                    if let Ok(ServiceEvent::ServiceResolved(info)) = event {
                        let device_id = info.get_property_val_str("device_id").unwrap_or("").to_string();
                        let device_name = info.get_property_val_str("device_name").unwrap_or("").to_string();

                        if let Some(ip) = info.get_addresses().iter().next() {
                            devices.push(DiscoveredDevice {
                                device_id,
                                device_name,
                                ip: ip.to_string(),
                                port: info.get_port(),
                            });
                        }
                    }
                }
            }
        }

        // ✅ 核心修复 2：超时后务必手动停止该服务类型的 Browse！
        // 这一步彻底掐断了雷达引擎，防止它继续向已经被销毁的 receiver 发送数据，彻底消除 "closed channel" 报错！
        let _ = mdns.stop_browse(service_type);

        Ok(devices)
    }
}