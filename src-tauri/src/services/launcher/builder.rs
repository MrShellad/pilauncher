// src-tauri/src/services/launcher/builder.rs
use crate::domain::launcher::{AuthSession, ResolvedLaunchConfig};
use serde_json::Value;
use std::collections::HashMap;
use std::env;
use std::fs;
use std::path::PathBuf;

pub struct LaunchCommandBuilder {
    config: ResolvedLaunchConfig,
    auth: AuthSession,
    game_dir: PathBuf,
    runtime_dir: PathBuf,
    mc_version: String,
    target_version_id: String,
    third_party_root: Option<PathBuf>,
}

impl LaunchCommandBuilder {
    pub fn new(
        config: ResolvedLaunchConfig,
        auth: AuthSession,
        mc_version: &str,
        target_version_id: &str,
        game_dir: PathBuf,
        runtime_dir: PathBuf,
        third_party_root: Option<PathBuf>,
    ) -> Self {
        Self {
            config,
            auth,
            mc_version: mc_version.to_string(),
            target_version_id: target_version_id.to_string(),
            game_dir,
            runtime_dir,
            third_party_root,
        }
    }

    // ✅ 核心修复：采用严格的特性白名单机制与运行时的系统判定
    fn check_rules(rules: Option<&Vec<Value>>) -> bool {
        if let Some(rules_arr) = rules {
            let mut result = false;
            for rule in rules_arr {
                let action = rule["action"].as_str().unwrap_or("");

                // 1. 运行时判定操作系统
                let mut os_match = true;
                if let Some(os) = rule.get("os") {
                    let current_os = match env::consts::OS {
                        "windows" => "windows",
                        "macos" => "osx",
                        "linux" => "linux",
                        _ => env::consts::OS,
                    };
                    if os.get("name").and_then(|n| n.as_str()) != Some(current_os) {
                        os_match = false;
                    }
                }

                // 2. 判定特殊特性 (Features)
                let mut features_match = true;
                if let Some(features) = rule.get("features").and_then(|f| f.as_object()) {
                    for (feat_name, feat_val) in features {
                        let required_val = feat_val.as_bool().unwrap_or(false);

                        // ⚡️ 定义我们 PiLauncher 当前激活的特性状态
                        let our_val = match feat_name.as_str() {
                            "has_custom_resolution" => true,       // 我们确实手动注入了分辨率
                            "is_demo_user" => false,               // 绝对不开启试玩模式
                            "has_quick_plays_log" => false,        // 不启用快捷游玩日志
                            "is_quick_play_singleplayer" => false, // 不启用单人快捷游玩
                            "is_quick_play_multiplayer" => false,  // 不启用多人快捷游玩
                            "is_quick_play_realms" => false,       // 不启用领域快捷游玩
                            _ => false, // 兜底：任何未知的官方新特性，统统设为 false 拒绝注入！
                        };

                        if required_val != our_val {
                            features_match = false;
                            break; // 只要有一个特性不匹配，这条规则就直接作废
                        }
                    }
                }

                // 3. 综合评估
                if os_match && features_match {
                    if action == "allow" {
                        result = true;
                    } else if action == "disallow" {
                        result = false;
                    }
                }
            }
            result
        } else {
            true
        }
    }

    fn get_minecraft_root(&self) -> PathBuf {
        if let Some(tp_root) = &self.third_party_root {
            if let Some(versions_dir) = tp_root.parent() {
                if versions_dir.file_name().and_then(|n| n.to_str()) == Some("versions") {
                    if let Some(mc_root) = versions_dir.parent() {
                        return mc_root.to_path_buf();
                    }
                }
            }
        }
        self.runtime_dir.clone()
    }

    fn get_libraries_dir(&self) -> PathBuf {
        let tp_libs = self.get_minecraft_root().join("libraries");
        if tp_libs.exists() {
            return tp_libs;
        }
        self.runtime_dir.join("libraries")
    }

    fn get_version_data(&self, version_id: &str) -> Option<Value> {
        if let Some(tp_root) = &self.third_party_root {
            let tp_json = tp_root.join(format!("{}.json", version_id));
            if tp_json.exists() {
                if let Ok(content) = std::fs::read_to_string(&tp_json) {
                    if let Ok(json) = serde_json::from_str(&content) {
                        return Some(json);
                    }
                }
            }
        }
        
        let json_path = self
            .get_minecraft_root()
            .join("versions")
            .join(version_id)
            .join(format!("{}.json", version_id));

        if json_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&json_path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return Some(json);
                }
            }
        }

        // 终极回退机制，保障PiLauncher资源仍被搜索
        let fallback_json = self
            .runtime_dir
            .join("versions")
            .join(version_id)
            .join(format!("{}.json", version_id));
            
        if fallback_json.exists() && fallback_json != json_path {
            if let Ok(content) = std::fs::read_to_string(&fallback_json) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return Some(json);
                }
            }
        }
        None
    }

    // ✅ 新增：跨平台 Natives 原生库解压逻辑
    pub fn extract_natives(&self) -> Result<(), String> {
        let natives_dir = self
            .runtime_dir
            .join("versions")
            .join(&self.mc_version)
            .join("natives");

        if !natives_dir.exists() {
            fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;
        }

        let current_os = match env::consts::OS {
            "windows" => "windows",
            "macos" => "osx",
            "linux" => "linux",
            _ => env::consts::OS,
        };

        let json = self
            .get_version_data(&self.mc_version)
            .ok_or("找不到核心版本 JSON")?;

        if let Some(libs) = json["libraries"].as_array() {
            for lib in libs {
                if !Self::check_rules(lib.get("rules").and_then(|v| v.as_array())) {
                    continue;
                }

                if let Some(classifiers) = lib
                    .pointer("/downloads/classifiers")
                    .and_then(|c| c.as_object())
                {
                    for (key, val) in classifiers {
                        let match_os = key.contains(current_os)
                            || (current_os == "osx" && key.contains("macos"));
                        if match_os {
                            if let Some(path_str) = val.get("path").and_then(|p| p.as_str()) {
                                let mut jar_path = self.get_libraries_dir().join(path_str);
                                if !jar_path.exists() {
                                    jar_path = self.runtime_dir.join("libraries").join(path_str);
                                }
                                if jar_path.exists() {
                                    if let Ok(file) = fs::File::open(&jar_path) {
                                        // 依赖 zip crate，需要在 Cargo.toml 中添加 `zip = "0.6"`
                                        if let Ok(mut archive) = zip::ZipArchive::new(file) {
                                            for i in 0..archive.len() {
                                                if let Ok(mut file) = archive.by_index(i) {
                                                    let file_name = file.name().to_string();
                                                    // 排除 META-INF 目录和文件夹本身
                                                    if file_name.contains("META-INF")
                                                        || file_name.ends_with('/')
                                                    {
                                                        continue;
                                                    }
                                                    let outpath = natives_dir.join(&file_name);
                                                    if let Some(p) = outpath.parent() {
                                                        let _ = fs::create_dir_all(p);
                                                    }
                                                    if let Ok(mut outfile) =
                                                        fs::File::create(&outpath)
                                                    {
                                                        let _ =
                                                            std::io::copy(&mut file, &mut outfile);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }

    fn resolve_placeholders(
        &self,
        arg: &str,
        classpath: &str,
        natives_dir: &str,
        asset_index: &str,
    ) -> String {
        arg.replace("${auth_player_name}", &self.auth.player_name)
            .replace("${version_name}", &self.mc_version)
            .replace(
                "${game_directory}",
                &self.game_dir.to_string_lossy().to_string(),
            )
            .replace(
                "${assets_root}",
                &self
                    .get_minecraft_root()
                    .join("assets")
                    .to_string_lossy()
                    .to_string(),
            )
            .replace("${assets_index_name}", asset_index)
            .replace("${auth_uuid}", &self.auth.uuid)
            .replace("${auth_access_token}", &self.auth.access_token)
            .replace("${user_type}", &self.auth.user_type)
            .replace("${version_type}", "PiLauncher")
            .replace(
                "${resolution_width}",
                &self.config.resolution_width.to_string(),
            )
            .replace(
                "${resolution_height}",
                &self.config.resolution_height.to_string(),
            )
            .replace(
                "${library_directory}",
                &self
                    .get_libraries_dir()
                    .to_string_lossy()
                    .to_string(),
            )
            .replace("${classpath}", classpath)
            .replace("${natives_directory}", natives_dir)
            .replace(
                "${classpath_separator}",
                if cfg!(target_os = "windows") {
                    ";"
                } else {
                    ":"
                },
            )
            .replace("${user_properties}", "{}")
            .replace("${auth_session}", "{}")
            .replace("${auth_xuid}", "0")
            .replace("${clientid}", "0")
    }

    pub fn build_args(&self) -> Vec<String> {
        let mut jvm_args_raw = Vec::new();
        let mut game_args_raw = Vec::new();
        let mut main_class = String::new();
        let mut asset_index = self.mc_version.clone();
        let mut legacy_args = None;

        let mut lib_indices: HashMap<String, usize> = HashMap::new();
        let mut all_libraries: Vec<Value> = Vec::new();

        let parent_json = self.get_version_data(&self.mc_version);
        let target_json = if self.mc_version != self.target_version_id {
            self.get_version_data(&self.target_version_id)
        } else {
            None
        };

        let jsons = vec![parent_json, target_json];
        for json_opt in jsons {
            if let Some(json) = json_opt {
                if let Some(id) = json.pointer("/assetIndex/id").and_then(|v| v.as_str()) {
                    asset_index = id.to_string();
                }
                if let Some(mc) = json["mainClass"].as_str() {
                    main_class = mc.to_string();
                }
                if let Some(la) = json["minecraftArguments"].as_str() {
                    legacy_args = Some(la.to_string());
                }

                if let Some(libs) = json["libraries"].as_array() {
                    for lib in libs {
                        if let Some(name) = lib["name"].as_str() {
                            let parts: Vec<&str> = name.split(':').collect();
                            let group = parts.get(0).unwrap_or(&"");
                            let artifact = parts.get(1).unwrap_or(&"");
                            let classifier = if parts.len() >= 4 { parts[3] } else { "" };
                            let key = format!("{}:{}:{}", group, artifact, classifier);

                            if let Some(&idx) = lib_indices.get(&key) {
                                all_libraries[idx] = lib.clone();
                            } else {
                                lib_indices.insert(key, all_libraries.len());
                                all_libraries.push(lib.clone());
                            }
                        }
                    }
                }

                if let Some(args) = json.get("arguments").and_then(|v| v.as_object()) {
                    if let Some(jvm) = args.get("jvm").and_then(|v| v.as_array()) {
                        for arg in jvm {
                            if let Some(s) = arg.as_str() {
                                jvm_args_raw.push(s.to_string());
                            } else if let Some(obj) = arg.as_object() {
                                if Self::check_rules(obj.get("rules").and_then(|v| v.as_array())) {
                                    if let Some(values) = obj.get("value") {
                                        if let Some(s) = values.as_str() {
                                            jvm_args_raw.push(s.to_string());
                                        } else if let Some(arr) = values.as_array() {
                                            for v in arr {
                                                if let Some(s) = v.as_str() {
                                                    jvm_args_raw.push(s.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if let Some(game) = args.get("game").and_then(|v| v.as_array()) {
                        for arg in game {
                            if let Some(s) = arg.as_str() {
                                game_args_raw.push(s.to_string());
                            } else if let Some(obj) = arg.as_object() {
                                if Self::check_rules(obj.get("rules").and_then(|v| v.as_array())) {
                                    if let Some(values) = obj.get("value") {
                                        if let Some(s) = values.as_str() {
                                            game_args_raw.push(s.to_string());
                                        } else if let Some(arr) = values.as_array() {
                                            for v in arr {
                                                if let Some(s) = v.as_str() {
                                                    game_args_raw.push(s.to_string());
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if jvm_args_raw.is_empty() {
            jvm_args_raw = vec![
                "-Djava.library.path=${natives_directory}".to_string(),
                "-cp".to_string(),
                "${classpath}".to_string(),
            ];
        }
        if game_args_raw.is_empty() && legacy_args.is_some() {
            for part in legacy_args.unwrap().split_whitespace() {
                game_args_raw.push(part.to_string());
            }
        }

        let mut cp = Vec::new();
        let current_os = match env::consts::OS {
            "windows" => "windows",
            "macos" => "osx",
            "linux" => "linux",
            _ => env::consts::OS,
        };

        for lib in all_libraries {
            if !Self::check_rules(lib.get("rules").and_then(|v| v.as_array())) {
                continue;
            }
            let mut paths_to_check = Vec::new();

            if let Some(path) = lib
                .pointer("/downloads/artifact/path")
                .and_then(|p| p.as_str())
            {
                paths_to_check.push(path.to_string());
            }

            // 运行时判定收集当前系统的 jar 包路径
            if let Some(classifiers) = lib
                .pointer("/downloads/classifiers")
                .and_then(|c| c.as_object())
            {
                for (key, val) in classifiers {
                    let match_os =
                        key.contains(current_os) || (current_os == "osx" && key.contains("macos"));
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
                        let classifier = if parts.len() >= 4 {
                            format!("-{}", parts[3])
                        } else {
                            "".to_string()
                        };
                        paths_to_check.push(format!(
                            "{}/{}/{}/{}-{}{}.jar",
                            group, artifact, version, artifact, version, classifier
                        ));
                    }
                }
            }

            for dl_path in paths_to_check {
                let mut jar_path = self.get_libraries_dir().join(&dl_path);
                if !jar_path.exists() {
                    jar_path = self.runtime_dir.join("libraries").join(&dl_path);
                }
                if jar_path.exists() {
                    let path_str = jar_path.to_string_lossy().to_string();
                    if !cp.contains(&path_str) {
                        cp.push(path_str);
                    }
                }
            }
        }

        let mut core_jar = self.get_minecraft_root().join("versions").join(&self.mc_version).join(format!("{}.jar", self.mc_version));
        if !core_jar.exists() {
            core_jar = self.runtime_dir.join("versions").join(&self.mc_version).join(format!("{}.jar", self.mc_version));
        }
        if core_jar.exists() {
            cp.push(core_jar.to_string_lossy().to_string());
        }

        let cp_separator = if cfg!(target_os = "windows") {
            ";"
        } else {
            ":"
        };
        let classpath_string = cp.join(cp_separator);
        let natives_dir = self
            .runtime_dir
            .join("versions")
            .join(&self.mc_version)
            .join("natives")
            .to_string_lossy()
            .to_string();

        let mut final_args = Vec::new();

        final_args.push("-XX:+IgnoreUnrecognizedVMOptions".to_string());
        final_args.push("--enable-native-access=ALL-UNNAMED".to_string());
        final_args.push(format!("-Xms{}M", self.config.min_memory));
        final_args.push(format!("-Xmx{}M", self.config.max_memory));
        final_args.extend(self.config.custom_jvm_args.clone());

        for arg in jvm_args_raw {
            final_args.push(self.resolve_placeholders(
                &arg,
                &classpath_string,
                &natives_dir,
                &asset_index,
            ));
        }

        final_args.push(main_class);

        for arg in game_args_raw {
            final_args.push(self.resolve_placeholders(
                &arg,
                &classpath_string,
                &natives_dir,
                &asset_index,
            ));
        }

        if !final_args.contains(&"--width".to_string()) {
            final_args.push("--width".to_string());
            final_args.push(self.config.resolution_width.to_string());
        }

        if !final_args.contains(&"--height".to_string()) {
            final_args.push("--height".to_string());
            final_args.push(self.config.resolution_height.to_string());
        }

        if self.config.fullscreen && !final_args.contains(&"--fullscreen".to_string()) {
            final_args.push("--fullscreen".to_string());
        }

        if let Some(binding) = &self.config.server_binding {
            if !final_args.contains(&"--server".to_string()) {
                final_args.push("--server".to_string());
                final_args.push(binding.ip.clone());
            }
            if !final_args.contains(&"--port".to_string()) {
                final_args.push("--port".to_string());
                final_args.push(binding.port.to_string());
            }
            if !final_args.contains(&"--quickPlayMultiplayer".to_string()) {
                final_args.push("--quickPlayMultiplayer".to_string());
                if binding.port != 25565 {
                    final_args.push(format!("{}:{}", binding.ip, binding.port));
                } else {
                    final_args.push(binding.ip.clone());
                }
            }
        }

        final_args
    }
}
