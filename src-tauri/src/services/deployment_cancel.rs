// src-tauri/src/services/deployment_cancel.rs
use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

/// 全局取消令牌注册表：每个正在部署的 instance_id 对应一个 AtomicBool 标志
static CANCEL_REGISTRY: Lazy<Mutex<HashMap<String, Arc<AtomicBool>>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

/// 注册一个新的取消令牌，返回 Arc<AtomicBool> 供部署流程检查
pub fn register(instance_id: &str) -> Arc<AtomicBool> {
    let token = Arc::new(AtomicBool::new(false));
    let mut map = CANCEL_REGISTRY.lock().unwrap();
    map.insert(instance_id.to_string(), Arc::clone(&token));
    token
}

/// 触发取消：将对应 instance_id 的标志设为 true
pub fn cancel(instance_id: &str) {
    let map = CANCEL_REGISTRY.lock().unwrap();
    if let Some(token) = map.get(instance_id) {
        token.store(true, Ordering::SeqCst);
    }
}

/// 注销令牌（部署完成/取消后调用）
pub fn unregister(instance_id: &str) {
    let mut map = CANCEL_REGISTRY.lock().unwrap();
    map.remove(instance_id);
}

/// 检查令牌是否已被取消
pub fn is_cancelled(token: &Arc<AtomicBool>) -> bool {
    token.load(Ordering::SeqCst)
}
