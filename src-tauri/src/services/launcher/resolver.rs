use crate::domain::instance::InstanceConfig;
use crate::domain::launcher::ResolvedLaunchConfig;
// 假设你有一个全局配置模型 GlobalConfig，这里做个演示
// use crate::domain::config::GlobalConfig;

pub struct ConfigResolver;

impl ConfigResolver {
    pub fn resolve(
        instance_cfg: &InstanceConfig, /* global_cfg: &GlobalConfig */
    ) -> ResolvedLaunchConfig {
        // TODO: 这里应接入真实的 GlobalConfig，目前用硬编码作为“全局默认值”兜底
        let global_java = "java".to_string();
        let global_min_mem = 1024;
        let global_max_mem = 4096;

        ResolvedLaunchConfig {
            // 实例没填就用全局
            java_path: if instance_cfg.java.path.is_empty() {
                global_java
            } else {
                instance_cfg.java.path.clone()
            },
            min_memory: if instance_cfg.memory.min == 0 {
                global_min_mem
            } else {
                instance_cfg.memory.min
            },
            max_memory: if instance_cfg.memory.max == 0 {
                global_max_mem
            } else {
                instance_cfg.memory.max
            },

            resolution_width: if instance_cfg.resolution.width == 0 {
                854
            } else {
                instance_cfg.resolution.width
            },
            resolution_height: if instance_cfg.resolution.height == 0 {
                480
            } else {
                instance_cfg.resolution.height
            },
            fullscreen: false, // 可根据后续扩展添加到 instance.json

            // 实例附加参数 + 全局附加参数 (可后续扩展)
            custom_jvm_args: vec![
                "-XX:+UseG1GC".to_string(), // 示例默认优化参数
            ],
        }
    }
}
