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
        // 1. 获取全局的基础设置 (来源: settings.json)
        let global_java = ConfigService::get_java_settings(app);
        let global_game = ConfigService::get_game_settings(app);

        // 2. 获取该实例特定的 Runtime 配置 (来源: instances/<id>/instance.json 中的 runtime 节点)
        let base_path = ConfigService::get_base_path(app).ok().flatten().unwrap_or_default();
        let instance_dir = PathBuf::from(base_path).join("instances").join(&instance_cfg.id);
        
        // ✅ 修复 1：使用 unwrap_or_else 手动提供安全兜底，解决未实现 Default 的问题
        let instance_runtime = runtime_service::get_instance_runtime(&instance_dir).unwrap_or_else(|_| {
            crate::domain::runtime::RuntimeConfig {
                use_global_java: true,
                use_global_memory: true,
                java_path: "".to_string(),
                max_memory: 4096,
                min_memory: 1024,
                jvm_args: "".to_string(),
            }
        });

        // 3. 融合判定: Java 路径
        let mut java_path = if instance_runtime.use_global_java || instance_runtime.java_path.is_empty() {
            global_java.java_path.clone()
        } else {
            instance_runtime.java_path.clone()
        };
        // 兜底保证
        if java_path == "auto" || java_path.is_empty() { java_path = "java".to_string(); }

        // 4. 融合判定: 内存分配
        // ✅ 修复 2：使用 as u32 安全地将 u64 转换为 u32
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

        // 5. 融合判定: 分辨率 (从全局中拆分 854x480，或如果实例配置过则用实例的)
        let (global_w, global_h) = {
            let parts: Vec<&str> = global_game.resolution.split('x').collect();
            let w = parts.get(0).and_then(|s| s.parse().ok()).unwrap_or(854);
            let h = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(480);
            (w, h)
        };
        
        let resolution_width = if instance_cfg.resolution.width == 0 { global_w } else { instance_cfg.resolution.width };
        let resolution_height = if instance_cfg.resolution.height == 0 { global_h } else { instance_cfg.resolution.height };

        // 6. 融合判定: JVM 参数合并 (默认加载全局参数，如果你还为实例配置了专有参数，则追加上去)
        let mut custom_jvm_args: Vec<String> = global_java.jvm_args
            .split_whitespace()
            .map(|s| s.to_string())
            .collect();

        if !instance_runtime.use_global_java && !instance_runtime.jvm_args.is_empty() {
            let extra_args: Vec<String> = instance_runtime.jvm_args
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