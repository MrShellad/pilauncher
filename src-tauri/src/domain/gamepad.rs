use serde::{Deserialize, Serialize};

// 核心实体：原生的手柄事件结构体
#[derive(Debug, Clone, Serialize)]
pub struct NativeGamepadEvent {
    pub id: u32,
    pub kind: String,
    pub button_code: Option<u32>,
    pub button_name: Option<String>,
    pub axis_code: Option<u32>,
    pub axis_name: Option<String>,
    pub axis_value: Option<f32>,
}

// ✅ 手柄 Mod 缓存元数据（存储在 shared_mods/gamepad_meta.json）
#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct GamepadModMeta {
    pub file_name: String,
    pub download_url: String,
    pub cached_at: u64,
}

// ✅ 手柄 Mod 状态检测结果，返回给前端
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GamepadModStatus {
    pub installed: bool,                  // 实例 mods/ 中是否已存在手柄 mod
    pub needs_install: bool,              // 完全没有，需要安装
    pub needs_update: bool,               // 有但版本旧，可以更新（由前端 API 比对）
    pub local_file_name: Option<String>,  // 本地已安装/缓存的文件名
    pub remote_file_name: Option<String>, // 远端最新文件名（由前端填充）
    pub has_cache: bool,                  // shared_mods 中是否有缓存
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GamepadMeta {
    pub managed_gamepad_mod: Option<String>,
    pub original_gamepad_mod_name: Option<String>,
}
