use gilrs::{Event, EventType, GamepadId, Gilrs};
use serde::Serialize;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Debug, Clone, Serialize)]
pub struct NativeGamepadEvent {
    pub id: u32,
    pub kind: String,          // "Connected", "Disconnected", "ButtonPressed", "ButtonReleased"
    pub button_code: Option<u32>,
}

fn id_to_u32(id: GamepadId) -> u32 {
    // GamepadId 内部就是一个小整数索引，这里用 debug 表示再解析，避免依赖不稳定 API
    // 通常格式为 "GamepadId(0)"，解析数字部分失败时退回 0
    let s = format!("{:?}", id);
    s.chars()
        .filter(|c| c.is_ascii_digit())
        .collect::<String>()
        .parse::<u32>()
        .unwrap_or(0)
}

pub fn start_gamepad_listener<R: Runtime + 'static>(app: AppHandle<R>) {
    tauri::async_runtime::spawn(async move {
        let mut gilrs = match Gilrs::new() {
            Ok(g) => g,
            Err(e) => {
                eprintln!("[Gamepad] 初始化 gilrs 失败: {}", e);
                return;
            }
        };

        println!("[Gamepad] gilrs gamepad listener started");

        loop {
            while let Some(Event { id, event, .. }) = gilrs.next_event() {
                let (kind, button_code) = match event {
                    EventType::Connected => ("Connected".to_string(), None),
                    EventType::Disconnected => ("Disconnected".to_string(), None),
                    EventType::ButtonPressed(btn, _) => ("ButtonPressed".to_string(), Some(btn as u32)),
                    EventType::ButtonReleased(btn, _) => ("ButtonReleased".to_string(), Some(btn as u32)),
                    _ => continue,
                };

                let payload = NativeGamepadEvent {
                    id: id_to_u32(id),
                    kind,
                    button_code,
                };

                let _ = app.emit("native-gamepad-event", payload);
            }

            tokio::time::sleep(Duration::from_millis(8)).await;
        }
    });
}

