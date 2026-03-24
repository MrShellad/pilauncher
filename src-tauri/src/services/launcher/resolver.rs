// src-tauri/src/services/launcher/resolver.rs
use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::ResolvedLaunchConfig;
use crate::services::config_service::ConfigService;
use crate::services::runtime_service;
use std::path::PathBuf;
use tauri::{AppHandle, Runtime};

pub struct ConfigResolver;

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

        let mut java_path =
            if instance_runtime.use_global_java || instance_runtime.java_path.is_empty() {
                global_java.java_path.clone()
            } else {
                instance_runtime.java_path.clone()
            };
        if java_path == "auto" || java_path.is_empty() {
            java_path = "java".to_string();
        }

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

        let mut custom_jvm_args: Vec<String> = global_java
            .jvm_args
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if !instance_runtime.use_global_java && !instance_runtime.jvm_args.is_empty() {
            let extra_args: Vec<String> = instance_runtime
                .jvm_args
                .split_whitespace()
                .map(|s| s.to_string())
                .collect();
            custom_jvm_args.extend(extra_args);
        }

        ResolvedLaunchConfig {
            java_path,
            min_memory,
            max_memory,
            resolution_width,
            resolution_height,
            fullscreen: global_game.fullscreen,
            custom_jvm_args,
        }
    }
}
