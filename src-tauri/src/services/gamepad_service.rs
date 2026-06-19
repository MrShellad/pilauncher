// src-tauri/src/services/gamepad_service.rs

#[cfg(not(any(target_os = "android", target_os = "ios")))]
mod desktop {
    use gilrs::{Event, EventType, GamepadId, Gilrs};
    use std::collections::HashMap;
    use std::thread;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, Runtime};

    use crate::domain::gamepad::NativeGamepadEvent;

    const GAMEPAD_POLL_INTERVAL_MS: u64 = 16;
    const AXIS_DEADZONE: f32 = 0.08;
    const AXIS_EMIT_DELTA: f32 = 0.05;

    pub struct GamepadService;

    impl GamepadService {
        fn id_to_u32(id: GamepadId) -> u32 {
            let s = format!("{:?}", id);
            s.chars()
                .filter(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse::<u32>()
                .unwrap_or(0)
        }

        fn axis_direction(value: f32) -> i8 {
            if value > AXIS_DEADZONE {
                1
            } else if value < -AXIS_DEADZONE {
                -1
            } else {
                0
            }
        }

        pub fn start_listener<R: Runtime + 'static>(app: AppHandle<R>) {
            thread::spawn(move || {
                let mut gilrs = match Gilrs::new() {
                    Ok(g) => g,
                    Err(e) => {
                        eprintln!("[Gamepad Service] initialization failed: {}", e);
                        return;
                    }
                };

                println!("[Gamepad Service] listener thread started");
                let mut last_axis_values: HashMap<(u32, u32), f32> = HashMap::new();

                loop {
                    while let Some(Event { id, event, .. }) = gilrs.next_event() {
                        let gamepad_id = Self::id_to_u32(id);
                        let (kind, b_code, b_name, a_code, a_name, val) = match event {
                            EventType::Connected => {
                                ("Connected".to_string(), None, None, None, None, None)
                            }
                            EventType::Disconnected => {
                                ("Disconnected".to_string(), None, None, None, None, None)
                            }
                            EventType::ButtonPressed(btn, _) => (
                                "ButtonPressed".to_string(),
                                Some(btn as u32),
                                Some(format!("{:?}", btn)),
                                None,
                                None,
                                None,
                            ),
                            EventType::ButtonReleased(btn, _) => (
                                "ButtonReleased".to_string(),
                                Some(btn as u32),
                                Some(format!("{:?}", btn)),
                                None,
                                None,
                                None,
                            ),
                            EventType::ButtonChanged(btn, v, _) => (
                                "ButtonChanged".to_string(),
                                Some(btn as u32),
                                Some(format!("{:?}", btn)),
                                None,
                                None,
                                Some(v),
                            ),
                            EventType::AxisChanged(axis, v, _) => (
                                "AxisChanged".to_string(),
                                None,
                                None,
                                Some(axis as u32),
                                Some(format!("{:?}", axis)),
                                Some(v),
                            ),
                            _ => continue,
                        };

                        if kind == "Disconnected" {
                            last_axis_values.retain(|(tracked_id, _), _| *tracked_id != gamepad_id);
                        }

                        if kind == "AxisChanged" {
                            let Some(axis_code) = a_code else { continue };
                            let Some(axis_value) = val else { continue };
                            let key = (gamepad_id, axis_code);
                            let previous = last_axis_values.get(&key).copied();
                            let current_direction = Self::axis_direction(axis_value);
                            let direction_changed = previous
                                .map(|prev| Self::axis_direction(prev) != current_direction)
                                .unwrap_or(false);
                            let value_changed_enough = previous
                                .map(|prev| (axis_value - prev).abs() >= AXIS_EMIT_DELTA)
                                .unwrap_or(current_direction != 0);

                            if !direction_changed && !value_changed_enough {
                                continue;
                            }

                            if current_direction == 0 {
                                last_axis_values.remove(&key);
                            } else {
                                last_axis_values.insert(key, axis_value);
                            }
                        }

                        let payload = NativeGamepadEvent {
                            id: gamepad_id,
                            kind,
                            button_code: b_code,
                            button_name: b_name,
                            axis_code: a_code,
                            axis_name: a_name,
                            axis_value: val,
                        };

                        if let Err(e) = app.emit("native-gamepad-event", &payload) {
                            eprintln!("[Gamepad Service] emit failed: {}", e);
                        }
                    }

                    thread::sleep(Duration::from_millis(GAMEPAD_POLL_INTERVAL_MS));
                }
            });
        }
    }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
pub use desktop::GamepadService;

#[cfg(any(target_os = "android", target_os = "ios"))]
pub struct GamepadService;

#[cfg(any(target_os = "android", target_os = "ios"))]
impl GamepadService {
    pub fn start_listener<R: tauri::Runtime + 'static>(_app: tauri::AppHandle<R>) {
        println!("[Gamepad Service] Gamepad service is disabled on mobile targets.");
    }
}
