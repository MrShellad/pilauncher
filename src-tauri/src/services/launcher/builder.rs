use crate::domain::launcher::{AuthSession, LoaderType, ResolvedLaunchConfig};

/// Loader 策略特征：不同的 Loader 提供不同的核心参数
pub trait LoaderStrategy {
    fn get_main_class(&self) -> String;
    fn get_game_args(&self) -> Vec<String>;
    fn get_jvm_args(&self) -> Vec<String>;
}

// === 策略 1：原版 Vanilla ===
pub struct VanillaStrategy {
    pub version: String,
}
impl LoaderStrategy for VanillaStrategy {
    fn get_main_class(&self) -> String {
        "net.minecraft.client.main.Main".to_string()
    }
    fn get_game_args(&self) -> Vec<String> {
        vec!["--version".to_string(), self.version.clone()]
    }
    fn get_jvm_args(&self) -> Vec<String> {
        vec![]
    }
}

// === 策略 2：Fabric ===
pub struct FabricStrategy;
impl LoaderStrategy for FabricStrategy {
    fn get_main_class(&self) -> String {
        "net.fabricmc.loader.impl.launch.knot.KnotClient".to_string()
    }
    fn get_game_args(&self) -> Vec<String> {
        vec![]
    }
    fn get_jvm_args(&self) -> Vec<String> {
        vec![]
    }
}

/// 终极命令行组装器
pub struct LaunchCommandBuilder {
    config: ResolvedLaunchConfig,
    auth: AuthSession,
    loader_strategy: Box<dyn LoaderStrategy>,
    game_dir: String,
}

impl LaunchCommandBuilder {
    pub fn new(
        config: ResolvedLaunchConfig,
        auth: AuthSession,
        loader_type: LoaderType,
        version: &str,
        game_dir: String,
    ) -> Self {
        let strategy: Box<dyn LoaderStrategy> = match loader_type {
            LoaderType::Vanilla => Box::new(VanillaStrategy {
                version: version.to_string(),
            }),
            LoaderType::Fabric => Box::new(FabricStrategy),
            _ => Box::new(VanillaStrategy {
                version: version.to_string(),
            }), // TODO: 补充 Forge 等
        };

        Self {
            config,
            auth,
            loader_strategy: strategy,
            game_dir,
        }
    }

    /// 生成最终传给 std::process::Command 的参数数组
    pub fn build_args(&self) -> Vec<String> {
        let mut args = Vec::new();

        // 1. 内存分配
        args.push(format!("-Xms{}M", self.config.min_memory));
        args.push(format!("-Xmx{}M", self.config.max_memory));

        // 2. 自定义 JVM 参数
        args.extend(self.config.custom_jvm_args.clone());

        // 3. Loader 特定 JVM 参数 (如 Fabric/Forge 特有系统属性)
        args.extend(self.loader_strategy.get_jvm_args());

        // 4. (预留) Native 库路径和 Classpath
        args.push(format!("-Djava.library.path={}/natives", self.game_dir));
        args.push("-cp".to_string());
        args.push("dummy_classpath.jar".to_string()); // TODO: 解析 version.json 拼接实际 classpath

        // 5. Main Class
        args.push(self.loader_strategy.get_main_class());

        // 6. 游戏认证与基础参数
        args.push("--username".to_string());
        args.push(self.auth.player_name.clone());
        args.push("--version".to_string());
        args.push("TestVersion".to_string());
        args.push("--gameDir".to_string());
        args.push(self.game_dir.clone());
        args.push("--assetsDir".to_string());
        args.push(format!("{}/assets", self.game_dir));
        args.push("--assetIndex".to_string());
        args.push("1.20".to_string()); // TODO: 从 json 获取
        args.push("--uuid".to_string());
        args.push(self.auth.uuid.clone());
        args.push("--accessToken".to_string());
        args.push(self.auth.access_token.clone());
        args.push("--userType".to_string());
        args.push(self.auth.user_type.clone());

        // 7. 窗口大小
        args.push("--width".to_string());
        args.push(self.config.resolution_width.to_string());
        args.push("--height".to_string());
        args.push(self.config.resolution_height.to_string());
        if self.config.fullscreen {
            args.push("--fullscreen".to_string());
        }

        // 8. Loader 特定游戏参数
        args.extend(self.loader_strategy.get_game_args());

        args
    }
}
