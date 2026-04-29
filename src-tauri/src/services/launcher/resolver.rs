use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::ResolvedLaunchConfig;
use crate::domain::runtime::{MemoryAllocationMode, MemoryStats, RuntimeConfig};
use crate::services::config_service::ConfigService;
use crate::services::runtime_service;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub struct ConfigResolver;

const MEMORY_STEP_MB: u32 = 512;
const MIN_MEMORY_MB: u32 = 1024;
const MAX_INITIAL_MEMORY_MB: u32 = 8192;
const INITIAL_MEMORY_RATIO: f64 = 0.45;

#[derive(Debug, Clone, Copy)]
struct MemoryThresholds {
    recommended: u32,
    safe_limit: u32,
    total_hard_limit: u32,
    hard_limit: u32,
}

fn split_argument_string(raw: &str) -> Vec<String> {
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut chars = raw.chars().peekable();
    let mut quote = None;

    while let Some(ch) = chars.next() {
        match quote {
            Some('"') => match ch {
                '"' => quote = None,
                '\\' => {
                    if matches!(chars.peek(), Some('"') | Some('\\')) {
                        if let Some(escaped) = chars.next() {
                            current.push(escaped);
                        }
                    } else {
                        current.push(ch);
                    }
                }
                _ => current.push(ch),
            },
            Some('\'') => {
                if ch == '\'' {
                    quote = None;
                } else {
                    current.push(ch);
                }
            }
            Some(_) => current.push(ch),
            None => match ch {
                '"' | '\'' => quote = Some(ch),
                ch if ch.is_whitespace() => {
                    if !current.is_empty() {
                        parts.push(std::mem::take(&mut current));
                    }
                }
                _ => current.push(ch),
            },
        }
    }

    if !current.is_empty() {
        parts.push(current);
    }

    parts
}

fn parse_java_major_version(value: &str) -> Option<u32> {
    value.trim().parse::<u32>().ok()
}

fn adapt_gc_args_for_java_major(mut args: Vec<String>, java_major: &str) -> Vec<String> {
    let Some(major) = parse_java_major_version(java_major) else {
        return args;
    };
    if major >= 21 {
        return args;
    }

    if major >= 17 {
        args.retain(|arg| arg != "-XX:+ZGenerational");
        return args;
    }

    let first_zgc_index = args
        .iter()
        .position(|arg| arg == "-XX:+UseZGC" || arg == "-XX:+ZGenerational");
    if first_zgc_index.is_none() {
        return args;
    }

    args.retain(|arg| arg != "-XX:+UseZGC" && arg != "-XX:+ZGenerational");
    if !args.iter().any(|arg| arg == "-XX:+UseG1GC") {
        args.insert(
            first_zgc_index.unwrap().min(args.len()),
            "-XX:+UseG1GC".to_string(),
        );
    }

    args
}

fn resolve_custom_jvm_args(
    global_jvm_args: &str,
    instance_runtime: &RuntimeConfig,
    java_major: &str,
) -> Vec<String> {
    let mut custom_jvm_args = split_argument_string(global_jvm_args);

    if !instance_runtime.use_global_memory && !instance_runtime.jvm_args.trim().is_empty() {
        custom_jvm_args.extend(split_argument_string(&instance_runtime.jvm_args));
    }

    adapt_gc_args_for_java_major(custom_jvm_args, java_major)
}

fn round_down_to_step(value: f64) -> u32 {
    if !value.is_finite() || value <= 0.0 {
        return MIN_MEMORY_MB;
    }

    ((value / MEMORY_STEP_MB as f64).floor() as u32)
        .saturating_mul(MEMORY_STEP_MB)
        .max(MIN_MEMORY_MB)
}

fn clamp_memory(value: u32, min: u32, max: u32) -> u32 {
    if max < min {
        return min;
    }

    value.max(min).min(max)
}

fn compute_memory_thresholds(stats: &MemoryStats) -> MemoryThresholds {
    let total = (stats.total.min(u32::MAX as u64) as u32).max(MIN_MEMORY_MB);
    let available = (stats.available.min(u32::MAX as u64) as u32).max(MIN_MEMORY_MB);

    let total_hard_limit = round_down_to_step(total as f64 * 0.8);
    let available_hard_limit = round_down_to_step(available as f64 * 0.8);
    let hard_limit = total_hard_limit
        .min(available_hard_limit)
        .max(MIN_MEMORY_MB);
    let recommended = clamp_memory(
        round_down_to_step(total as f64 * 0.6),
        MIN_MEMORY_MB,
        total_hard_limit,
    );
    let safe_limit = clamp_memory(
        round_down_to_step(available as f64 * 0.7),
        MIN_MEMORY_MB,
        available_hard_limit,
    );

    MemoryThresholds {
        recommended,
        safe_limit,
        total_hard_limit,
        hard_limit,
    }
}

fn sanitize_requested_memory(requested: u32, total_hard_limit: u32) -> u32 {
    let requested = requested.max(MIN_MEMORY_MB);
    clamp_memory(
        requested,
        MIN_MEMORY_MB,
        total_hard_limit.max(MIN_MEMORY_MB),
    )
}

fn resolve_initial_memory(max_memory: u32) -> u32 {
    clamp_memory(
        round_down_to_step(max_memory as f64 * INITIAL_MEMORY_RATIO),
        MIN_MEMORY_MB,
        max_memory.min(MAX_INITIAL_MEMORY_MB),
    )
}

fn resolve_memory_limits(
    mode: &MemoryAllocationMode,
    requested_max: u32,
    _requested_min: u32,
    thresholds: &MemoryThresholds,
) -> (u32, u32) {
    let requested_max = sanitize_requested_memory(requested_max, thresholds.total_hard_limit);

    let max_memory = match mode {
        MemoryAllocationMode::Auto => clamp_memory(
            thresholds.recommended.min(thresholds.safe_limit),
            MIN_MEMORY_MB,
            thresholds.hard_limit,
        ),
        MemoryAllocationMode::Manual => clamp_memory(
            requested_max.min(thresholds.safe_limit),
            MIN_MEMORY_MB,
            thresholds.hard_limit,
        ),
        MemoryAllocationMode::Force => requested_max,
    };

    let min_memory = resolve_initial_memory(max_memory);
    (min_memory, max_memory)
}

impl ConfigResolver {
    pub fn resolve<R: Runtime>(
        app: &AppHandle<R>,
        instance_cfg: &InstanceConfig,
    ) -> ResolvedLaunchConfig {
        let global_java = ConfigService::get_java_settings(app);
        let global_game = ConfigService::get_game_settings(app);

        let base_path = ConfigService::get_base_path(app)
            .ok()
            .flatten()
            .unwrap_or_default();
        let instance_dir = PathBuf::from(base_path)
            .join("instances")
            .join(&instance_cfg.id);

        let instance_runtime =
            runtime_service::get_instance_runtime(&instance_dir).unwrap_or_else(|_| {
                crate::domain::runtime::RuntimeConfig {
                    use_global_java: true,
                    use_global_memory: true,
                    java_path: "".to_string(),
                    memory_allocation_mode: MemoryAllocationMode::Auto,
                    max_memory: 4096,
                    min_memory: 1024,
                    jvm_args: "".to_string(),
                }
            });

        let java_runtime = runtime_service::resolve_instance_java_runtime(
            &instance_runtime,
            &global_java,
            &instance_cfg.mc_version,
            runtime_service::launcher_default_java_command(),
        );
        let java_path = java_runtime.java_path.clone();

        let memory_mode = if instance_runtime.use_global_memory {
            global_java.memory_allocation_mode.clone()
        } else {
            instance_runtime.memory_allocation_mode.clone()
        };

        let requested_min_memory =
            if instance_runtime.use_global_memory || instance_runtime.min_memory == 0 {
                global_java.min_memory
            } else {
                instance_runtime.min_memory as u32
            };

        let requested_max_memory =
            if instance_runtime.use_global_memory || instance_runtime.max_memory == 0 {
                global_java.max_memory
            } else {
                instance_runtime.max_memory as u32
            };

        let memory_thresholds = compute_memory_thresholds(&runtime_service::get_system_memory());
        let (min_memory, max_memory) = resolve_memory_limits(
            &memory_mode,
            requested_max_memory,
            requested_min_memory,
            &memory_thresholds,
        );

        let (global_w, global_h) = {
            let parts: Vec<&str> = global_game.resolution.split('x').collect();
            let w = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(854);
            let h = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(480);
            (w, h)
        };

        let resolution_width = if instance_cfg.resolution.width == 0 {
            global_w
        } else {
            instance_cfg.resolution.width
        };
        let resolution_height = if instance_cfg.resolution.height == 0 {
            global_h
        } else {
            instance_cfg.resolution.height
        };

        let custom_jvm_args = resolve_custom_jvm_args(
            &global_java.jvm_args,
            &instance_runtime,
            &java_runtime.required_java_major,
        );

        ResolvedLaunchConfig {
            java_path,
            min_memory,
            max_memory,
            resolution_width,
            resolution_height,
            fullscreen: global_game.fullscreen,
            custom_jvm_args,
            server_binding: if instance_cfg.auto_join_server.unwrap_or(true) {
                instance_cfg.server_binding.clone()
            } else {
                None
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn runtime_config() -> RuntimeConfig {
        RuntimeConfig {
            use_global_java: true,
            use_global_memory: true,
            java_path: String::new(),
            memory_allocation_mode: MemoryAllocationMode::Auto,
            max_memory: 4096,
            min_memory: 1024,
            jvm_args: String::new(),
        }
    }

    #[test]
    fn split_argument_string_preserves_quoted_segments() {
        assert_eq!(
            split_argument_string(
                r#"-XX:+UseG1GC "-Djava.library.path=C:\Program Files\Java\bin" '-Dfoo=bar baz'"#
            ),
            vec![
                "-XX:+UseG1GC".to_string(),
                r#"-Djava.library.path=C:\Program Files\Java\bin"#.to_string(),
                "-Dfoo=bar baz".to_string(),
            ]
        );
    }

    #[test]
    fn instance_jvm_args_follow_memory_scope_not_java_scope() {
        let mut instance_runtime = runtime_config();
        instance_runtime.use_global_java = true;
        instance_runtime.use_global_memory = false;
        instance_runtime.jvm_args =
            r#"-XX:+UnlockExperimentalVMOptions "-Dfoo=bar baz""#.to_string();

        assert_eq!(
            resolve_custom_jvm_args("-XX:+UseG1GC", &instance_runtime, "21"),
            vec![
                "-XX:+UseG1GC".to_string(),
                "-XX:+UnlockExperimentalVMOptions".to_string(),
                "-Dfoo=bar baz".to_string(),
            ]
        );
    }

    #[test]
    fn java_below_17_replaces_zgc_defaults_with_g1gc() {
        let instance_runtime = runtime_config();

        assert_eq!(
            resolve_custom_jvm_args(
                "-XX:+UseZGC -XX:+ZGenerational -XX:+ParallelRefProcEnabled",
                &instance_runtime,
                "16",
            ),
            vec![
                "-XX:+UseG1GC".to_string(),
                "-XX:+ParallelRefProcEnabled".to_string(),
            ]
        );
    }

    #[test]
    fn java_17_to_20_removes_generational_zgc_only() {
        let instance_runtime = runtime_config();

        assert_eq!(
            resolve_custom_jvm_args(
                "-XX:+UseZGC -XX:+ZGenerational -XX:+ParallelRefProcEnabled",
                &instance_runtime,
                "17",
            ),
            vec![
                "-XX:+UseZGC".to_string(),
                "-XX:+ParallelRefProcEnabled".to_string(),
            ]
        );
    }

    #[test]
    fn java_21_and_newer_keeps_generational_zgc_defaults() {
        let instance_runtime = runtime_config();

        assert_eq!(
            resolve_custom_jvm_args(
                "-XX:+UseZGC -XX:+ZGenerational -XX:+ParallelRefProcEnabled",
                &instance_runtime,
                "21",
            ),
            vec![
                "-XX:+UseZGC".to_string(),
                "-XX:+ZGenerational".to_string(),
                "-XX:+ParallelRefProcEnabled".to_string(),
            ]
        );
    }

    #[test]
    fn java_below_17_does_not_duplicate_existing_g1gc_arg() {
        let instance_runtime = runtime_config();

        assert_eq!(
            resolve_custom_jvm_args(
                "-XX:+UseG1GC -XX:+UseZGC -XX:+ZGenerational",
                &instance_runtime,
                "8",
            ),
            vec!["-XX:+UseG1GC".to_string()]
        );
    }

    #[test]
    fn auto_mode_uses_recommended_and_safe_limit_minimum() {
        let thresholds = compute_memory_thresholds(&MemoryStats {
            total: 16 * 1024,
            available: 6 * 1024,
        });

        let (_, max_memory) =
            resolve_memory_limits(&MemoryAllocationMode::Auto, 8192, 1024, &thresholds);

        assert_eq!(thresholds.recommended, 9728);
        assert_eq!(thresholds.safe_limit, 4096);
        assert_eq!(max_memory, 4096);
    }

    #[test]
    fn manual_mode_is_capped_by_safe_limit() {
        let thresholds = compute_memory_thresholds(&MemoryStats {
            total: 16 * 1024,
            available: 6 * 1024,
        });

        let (_, max_memory) =
            resolve_memory_limits(&MemoryAllocationMode::Manual, 8192, 1024, &thresholds);

        assert_eq!(max_memory, 4096);
    }

    #[test]
    fn force_mode_ignores_safe_and_available_memory_hard_limits() {
        let thresholds = compute_memory_thresholds(&MemoryStats {
            total: 16 * 1024,
            available: 6 * 1024,
        });

        let (min_memory, max_memory) =
            resolve_memory_limits(&MemoryAllocationMode::Force, 8192, 1024, &thresholds);

        assert_eq!(thresholds.hard_limit, 4608);
        assert_eq!(min_memory, 3584);
        assert_eq!(max_memory, 8192);
    }

    #[test]
    fn initial_memory_scales_from_heap_and_caps_at_eight_gb() {
        assert_eq!(resolve_initial_memory(2048), 1024);
        assert_eq!(resolve_initial_memory(8192), 3584);
        assert_eq!(resolve_initial_memory(24 * 1024), 8192);
    }
}
