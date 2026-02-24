// src-tauri/src/domain/animation.rs
use serde::{Deserialize, Serialize};

/// 前端请求加载动画的参数模型
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct AnimationRequest {
    /// 动画文件名，例如 "hover.animation.json"
    pub animation_name: String,
    /// 当前实例（整合包）的根目录绝对路径
    pub instance_path: String,
    /// 是否为高级版用户
    pub is_premium: bool,
    /// 用户是否开启了“优先使用用户目录动画”的开关
    pub user_prioritized: bool,
}