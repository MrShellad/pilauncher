// src-tauri/src/domain/lan.rs
use serde::{Deserialize, Serialize};

// 1. 本机身份模型 (密码学层面)
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceIdentity {
    pub device_id: String,
    pub device_name: String,
    pub user_uuid: String,
    pub private_key_b64: String,
    pub public_key_b64: String,
}

// 2. 已信任设备模型 (保存在 trusted_devices.json)
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TrustedDevice {
    pub device_id: String,
    pub device_name: String,
    pub user_uuid: String,
    pub public_key_b64: String,
    pub trusted_at: i64,
}

// 3. 局域网扫描到的设备模型 (用于前端雷达大盘展示)
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
    pub user_uuid: String,
    pub public_key: String,
}

// 5. 在线设备校验模型 (用于信任验证)
#[derive(Deserialize, Clone)]
pub struct OnlineDeviceCheck {
    pub device_id: String,
    pub device_name: String,
    pub public_key: String,
}

// ==========================================
// ✅ 6. 局域网富文本名片模型 (新增)
// 对方通过 /device/init 获取此信息，用于在 UI 上展示极其华丽的动态背景与名片
// ==========================================
#[derive(Serialize, Deserialize, Clone)]
pub struct DeviceInitInfo {
    pub device_id: String,
    pub device_name: String,
    pub username: String,
    pub user_uuid: String,
    pub is_premium: bool,
    pub is_donor: bool,                // 捐赠者 (展示特殊徽章)
    pub launcher_version: String,      // 启动器版本号
    pub instance_name: Option<String>, // 当前正在玩的整合包名字
    pub instance_id: Option<String>,   // 整合包ID
    pub bg_url: String,                // 个人中心背景图的拉取接口 (例如 "/device/bg")
}
