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

        // ✅ 核心逻辑：根据 MC 版本自动选择最优全局 Java 路径
        let mut java_path = if instance_runtime.use_global_java || instance_runtime.java_path.is_empty() {
            let req_ver = Self::get_required_java_version(&instance_cfg.mc_version);
            global_java.major_java_paths.get(&req_ver)
                .filter(|p| !p.is_empty())
                .cloned()
                .unwrap_or_else(|| global_java.java_path.clone())
        } else {
            instance_runtime.java_path.clone()
        };

        if java_path == "auto" || java_path.is_empty() {
            // ✅ Windows 优先使用 javaw，避免出现黑色控制台窗口
            java_path = if cfg!(target_os = "windows") {
                "javaw".to_string()
            } else {
                "java".to_string()
            };
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

    /// 智能判断 MC 版本对应的最优 Java 主版本号
    fn get_required_java_version(mc_version: &str) -> String {
        let parts: Vec<&str> = mc_version.split('.').collect();
        if parts.len() < 2 {
            return "8".to_string();
        }

        if let Ok(minor) = parts[1].parse::<u32>() {
            if minor >= 21 {
                // 1.20.5 之后开始强制 Java 21
                if minor == 21 && parts.len() >= 3 {
                   if let Ok(patch) = parts[2].parse::<u32>() {
                       if patch >= 0 { // 实际上 1.20.5 就开始了，这里的 parts[1] 是 20，我们需要处理 1.20.5
                       }
                   }
                }
            }
            
            // 重新处理逻辑
            if minor >= 21 { return "21".to_string(); } // 1.21+
            if minor == 20 {
                if parts.len() >= 3 {
                    if let Ok(patch) = parts[2].parse::<u32>() {
                        if patch >= 5 { return "21".to_string(); }
                    }
                }
                return "17".to_string();
            }
            if minor >= 18 { return "17".to_string(); } // 1.18 - 1.20.4
            if minor == 17 { return "16".to_string(); } // 1.17
            return "8".to_string(); // <= 1.16.5
        }
        "8".to_string()
    }
}
