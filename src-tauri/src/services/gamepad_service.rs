// src-tauri/src/services/gamepad_service.rs
use gilrs::{Event, EventType, GamepadId, Gilrs};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Runtime};

// 确保在 domain/gamepad.rs 中定义了模型
use crate::domain::gamepad::NativeGamepadEvent;

pub struct GamepadService;

impl GamepadService {
    /// 辅助函数：将 GamepadId 解析为 u32 索引
    fn id_to_u32(id: GamepadId) -> u32 {
        let s = format!("{:?}", id);
        s.chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse::<u32>()
            .unwrap_or(0)
    }

    /// 启动基于 XInput/WinNative 的手柄服务
    pub fn start_listener<R: Runtime + 'static>(app: AppHandle<R>) {
        thread::spawn(move || {
            let mut gilrs = match Gilrs::new() {
                Ok(g) => g,
                Err(e) => {
                    eprintln!("[Gamepad Service] 初始化失败: {}", e);
                    return;
                }
            };

            println!("[Gamepad Service] 监听线程启动成功");

            let mut n: u64 = 0;

            loop {
                // 1. 处理事件队列
                while let Some(Event { id, event, .. }) = gilrs.next_event() {
                    n = 0;

                    #[cfg(debug_assertions)]
                    println!("[Rust Gamepad] 实时事件: {:?}", event);

                    let (kind, b_code, b_name, a_code, a_name, val) = match event {
                        EventType::Connected => ("Connected".to_string(), None, None, None, None, None),
                        EventType::Disconnected => ("Disconnected".to_string(), None, None, None, None, None),
                        EventType::ButtonPressed(btn, _) => (
                            "ButtonPressed".to_string(),
                            Some(btn as u32),
                            Some(format!("{:?}", btn)),
                            None,
                            None,
                            None
                        ),
                        EventType::ButtonReleased(btn, _) => (
                            "ButtonReleased".to_string(),
                            Some(btn as u32),
                            Some(format!("{:?}", btn)),
                            None,
                            None,
                            None
                        ),
                        EventType::ButtonChanged(btn, v, _) => (
                            "ButtonChanged".to_string(),
                            Some(btn as u32),
                            Some(format!("{:?}", btn)),
                            None,
                            None,
                            Some(v)
                        ),
                        EventType::AxisChanged(axis, v, _) => (
                            "AxisChanged".to_string(),
                            None,
                            None,
                            Some(axis as u32),
                            Some(format!("{:?}", axis)),
                            Some(v)
                        ),
                        _ => continue,
                    };

                    let payload = NativeGamepadEvent {
                        id: Self::id_to_u32(id),
                        kind,
                        button_code: b_code,
                        button_name: b_name,
                        axis_code: a_code,
                        axis_name: a_name,
                        axis_value: val,
                    };
                    
                    if let Err(e) = app.emit("native-gamepad-event", &payload) {
                         eprintln!("[Gamepad Service] Emit failed: {}", e);
                    }
                }

                // 2. 心跳诊断逻辑
                n += 1;
                if n % 250 == 0 {
                    let count = gilrs.gamepads().count();
                    if count > 0 {
                        for (id, gp) in gilrs.gamepads() {
                            #[cfg(debug_assertions)]
                            println!(
                                "[Gamepad Heartbeat] 活跃中: [{:?}] {} | 状态: {:?}",
                                id,
                                gp.name(),
                                gp.power_info()
                            );
                        }
                    }
                    if n > 10000 { n = 1; }
                }

                thread::sleep(Duration::from_millis(8));
            }
        });
    }
}
