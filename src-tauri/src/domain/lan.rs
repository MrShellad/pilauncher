// src-tauri/src/domain/lan.rs
use serde::{Deserialize, Serialize};

// 1. 本机身份模型
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceIdentity {
    pub device_id: String,
    pub device_name: String,
    pub private_key_b64: String,
    pub public_key_b64: String,
}

// 2. 已信任设备模型
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrustedDevice {
    pub device_id: String,
    pub device_name: String,
    pub public_key_b64: String,
    pub trusted_at: i64,
}

// 3. 局域网扫描到的设备模型
#[derive(Serialize, Clone)]
pub struct DiscoveredDevice {
    pub device_id: String,
    pub device_name: String,
    pub ip: String,
    pub port: u16,
}

// 4. HTTP RPC 握手请求模型
#[derive(Deserialize, Serialize, Clone)]
pub struct TrustRequest {
    pub device_id: String,
    pub device_name: String,
    pub public_key: String,
}