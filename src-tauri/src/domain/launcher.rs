use serde::{Deserialize, Serialize};

/// 最终解析合并后的纯净启动配置 (无关乎是全局还是实例，到这里已经是最终结果)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolvedLaunchConfig {
    pub java_path: String,
    pub min_memory: u32, // MB
    pub max_memory: u32, // MB
    pub resolution_width: u32,
    pub resolution_height: u32,
    pub fullscreen: bool,
    pub custom_jvm_args: Vec<String>,
}

/// 统一的身份认证会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthSession {
    pub player_name: String,
    pub uuid: String,
    pub access_token: String,
    pub user_type: String, // "Legacy", "mojang", "msa"
}

/// 支持的加载器类型
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LoaderType {
    Vanilla,
    Fabric,
    Forge,
    NeoForge,
}
