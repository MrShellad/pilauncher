use serde::Serialize;

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
