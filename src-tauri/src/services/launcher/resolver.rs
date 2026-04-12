use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::ResolvedLaunchConfig;
use crate::domain::runtime::RuntimeConfig;
use crate::services::config_service::ConfigService;
use crate::services::runtime_service;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub struct ConfigResolver;

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

fn resolve_custom_jvm_args(global_jvm_args: &str, instance_runtime: &RuntimeConfig) -> Vec<String> {
    let mut custom_jvm_args = split_argument_string(global_jvm_args);

    if !instance_runtime.use_global_memory && !instance_runtime.jvm_args.trim().is_empty() {
        custom_jvm_args.extend(split_argument_string(&instance_runtime.jvm_args));
    }

    custom_jvm_args
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
                    max_memory: 4096,
                    min_memory: 1024,
                    jvm_args: "".to_string(),
                }
            });

        let java_path = runtime_service::resolve_instance_java_runtime(
            &instance_runtime,
            &global_java,
            &instance_cfg.mc_version,
            runtime_service::launcher_default_java_command(),
        )
        .java_path;

        let min_memory = if instance_runtime.use_global_memory || instance_runtime.min_memory == 0 {
            global_java.min_memory
        } else {
            instance_runtime.min_memory as u32
        };

        let max_memory = if instance_runtime.use_global_memory || instance_runtime.max_memory == 0 {
            global_java.max_memory
        } else {
            instance_runtime.max_memory as u32
        };

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

        let custom_jvm_args = resolve_custom_jvm_args(&global_java.jvm_args, &instance_runtime);

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
            resolve_custom_jvm_args("-XX:+UseG1GC", &instance_runtime),
            vec![
                "-XX:+UseG1GC".to_string(),
                "-XX:+UnlockExperimentalVMOptions".to_string(),
                "-Dfoo=bar baz".to_string(),
            ]
        );
    }
}
