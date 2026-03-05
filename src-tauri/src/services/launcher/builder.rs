// src-tauri/src/services/launcher/builder.rs
use crate::domain::launcher::{AuthSession, LoaderType, ResolvedLaunchConfig};
use std::path::{Path, PathBuf};
use std::fs;

pub trait LoaderStrategy: Send + Sync {
    fn get_main_class(&self) -> String;
    fn get_game_args(&self) -> Vec<String>;
    fn get_jvm_args(&self) -> Vec<String>;
}

pub struct VanillaStrategy { pub version: String }
impl LoaderStrategy for VanillaStrategy {
    fn get_main_class(&self) -> String { "net.minecraft.client.main.Main".to_string() }
    fn get_game_args(&self) -> Vec<String> { vec!["--version".to_string(), self.version.clone()] }
    fn get_jvm_args(&self) -> Vec<String> { vec![] }
}

pub struct FabricStrategy { pub version: String }
impl LoaderStrategy for FabricStrategy {
    fn get_main_class(&self) -> String { "net.fabricmc.loader.impl.launch.knot.KnotClient".to_string() }
    fn get_game_args(&self) -> Vec<String> { vec![] }
    fn get_jvm_args(&self) -> Vec<String> { vec![] }
}

pub struct LaunchCommandBuilder {
    config: ResolvedLaunchConfig,
    auth: AuthSession,
    loader_strategy: Box<dyn LoaderStrategy + Send + Sync>,
    game_dir: PathBuf,
    runtime_dir: PathBuf,
    version: String,
}

impl LaunchCommandBuilder {
    pub fn new(
        config: ResolvedLaunchConfig,
        auth: AuthSession,
        loader_type: LoaderType,
        version: &str,
        game_dir: PathBuf,
        runtime_dir: PathBuf,
    ) -> Self {
        let strategy: Box<dyn LoaderStrategy + Send + Sync> = match loader_type {
            LoaderType::Fabric => Box::new(FabricStrategy { version: version.to_string() }),
            _ => Box::new(VanillaStrategy { version: version.to_string() }), 
        };

        Self {
            config, auth, loader_strategy: strategy,
            game_dir, runtime_dir, version: version.to_string(),
        }
    }

    fn build_classpath(&self) -> String {
        let mut cp = Vec::new();
        let libs_dir = self.runtime_dir.join("libraries");
        let version_json_path = self.runtime_dir.join("versions").join(&self.version).join(format!("{}.json", self.version));

        let mut missing_count = 0;
        let mut parsed_libs_count = 0;

        if version_json_path.exists() {
            if let Ok(content) = fs::read_to_string(&version_json_path) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(libraries) = json["libraries"].as_array() {
                        for lib in libraries {
                            if let Some(rules) = lib["rules"].as_array() {
                                let mut allow = false;
                                let mut disallow = false;
                                for rule in rules {
                                    let action = rule["action"].as_str().unwrap_or("");
                                    let has_os = rule.get("os").is_some();
                                    
                                    #[cfg(target_os = "windows")] let is_match = rule.pointer("/os/name").and_then(|n| n.as_str()) == Some("windows");
                                    #[cfg(target_os = "macos")] let is_match = rule.pointer("/os/name").and_then(|n| n.as_str()) == Some("osx");
                                    #[cfg(target_os = "linux")] let is_match = rule.pointer("/os/name").and_then(|n| n.as_str()) == Some("linux");

                                    if action == "allow" {
                                        if !has_os || is_match { allow = true; }
                                    } else if action == "disallow" {
                                        if has_os && is_match { disallow = true; }
                                    }
                                }
                                if !allow || disallow { continue; } 
                            }

                            parsed_libs_count += 1;
                            let mut paths_to_check = Vec::new();

                            if let Some(path) = lib.pointer("/downloads/artifact/path").and_then(|p| p.as_str()) {
                                paths_to_check.push(path.to_string());
                            }
                            
                            if let Some(classifiers) = lib.pointer("/downloads/classifiers").and_then(|c| c.as_object()) {
                                for (key, val) in classifiers {
                                    #[cfg(target_os = "windows")] let match_os = key.contains("windows");
                                    #[cfg(target_os = "macos")] let match_os = key.contains("osx") || key.contains("macos");
                                    #[cfg(target_os = "linux")] let match_os = key.contains("linux");
                                    
                                    if match_os {
                                        if let Some(p) = val.get("path").and_then(|p| p.as_str()) {
                                            paths_to_check.push(p.to_string());
                                        }
                                    }
                                }
                            }

                            if paths_to_check.is_empty() {
                                if let Some(name) = lib["name"].as_str() {
                                    let parts: Vec<&str> = name.split(':').collect();
                                    if parts.len() >= 3 {
                                        let group = parts[0].replace('.', "/");
                                        let artifact = parts[1];
                                        let version = parts[2];
                                        paths_to_check.push(format!("{}/{}/{}/{}-{}.jar", group, artifact, version, artifact, version));
                                    }
                                }
                            }

                            for dl_path in paths_to_check {
                                let jar_path = libs_dir.join(&dl_path);
                                if jar_path.exists() {
                                    cp.push(jar_path.to_string_lossy().to_string());
                                } else {
                                    println!("[Builder] ⚠️ 丢失依赖: {}", jar_path.display());
                                    missing_count += 1;
                                }
                            }
                        }
                    }
                }
            }
        }

        let extra_libs = ["net/fabricmc", "org/ow2", "org/spongepowered", "cpw/mods", "io/github"];
        fn scan_extra_jars(dir: &Path, jars: &mut Vec<String>) {
            if let Ok(entries) = fs::read_dir(dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        scan_extra_jars(&path, jars);
                    } else if path.extension().map_or(false, |ext| ext == "jar") {
                        jars.push(path.to_string_lossy().to_string());
                    }
                }
            }
        }
        let mut extra_jars = Vec::new();
        for ext in extra_libs { scan_extra_jars(&libs_dir.join(ext), &mut extra_jars); }
        extra_jars.sort_by(|a, b| b.cmp(a));
        cp.extend(extra_jars);

        let version_jar = self.runtime_dir.join("versions").join(&self.version).join(format!("{}.jar", self.version));
        if version_jar.exists() {
            cp.push(version_jar.to_string_lossy().to_string());
        }

        #[cfg(target_os = "windows")] let sep = ";";
        #[cfg(not(target_os = "windows"))] let sep = ":";
        
        cp.join(sep)
    }

    pub fn build_args(&self) -> Vec<String> {
        let mut args = Vec::new();
        let game_dir_str = self.game_dir.to_string_lossy().to_string();
        let runtime_dir_str = self.runtime_dir.to_string_lossy().to_string();

        // 屏蔽 Java 21 的烦人 Native Access 警告
        args.push("-XX:+IgnoreUnrecognizedVMOptions".to_string());
        args.push("--enable-native-access=ALL-UNNAMED".to_string());
        
        args.push(format!("-Xms{}M", self.config.min_memory));
        args.push(format!("-Xmx{}M", self.config.max_memory));
        args.extend(self.config.custom_jvm_args.clone());
        args.extend(self.loader_strategy.get_jvm_args());

        args.push(format!("-Djava.library.path={}/versions/{}/natives", runtime_dir_str, self.version));
        args.push("-cp".to_string());
        args.push(self.build_classpath());

        args.push(self.loader_strategy.get_main_class());

        args.push("--username".to_string()); args.push(self.auth.player_name.clone());
        args.push("--uuid".to_string()); args.push(self.auth.uuid.clone());
        args.push("--accessToken".to_string()); args.push(self.auth.access_token.clone());
        args.push("--userType".to_string()); args.push(self.auth.user_type.clone());

        args.push("--gameDir".to_string()); args.push(game_dir_str);
        args.push("--assetsDir".to_string()); args.push(format!("{}/assets", runtime_dir_str));

        // ✅ 核心修复：动态读取该版本的真实 assetIndex
        let mut actual_asset_index = self.version.clone();
        let version_json_path = self.runtime_dir.join("versions").join(&self.version).join(format!("{}.json", self.version));
        if let Ok(content) = fs::read_to_string(&version_json_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(id) = json.pointer("/assetIndex/id").and_then(|v| v.as_str()) {
                    actual_asset_index = id.to_string();
                }
            }
        }
        args.push("--assetIndex".to_string()); 
        args.push(actual_asset_index); 

        args.push("--width".to_string()); args.push(self.config.resolution_width.to_string());
        args.push("--height".to_string()); args.push(self.config.resolution_height.to_string());
        if self.config.fullscreen { args.push("--fullscreen".to_string()); }

        args.extend(self.loader_strategy.get_game_args());
        args
    }
}