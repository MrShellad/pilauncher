use super::{LaunchCommandBuilder, LaunchPreparationError, VersionManifest};
use serde_json::Value;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

const LAUNCHER_NAME: &str = env!("CARGO_PKG_NAME");
const LAUNCHER_VERSION: &str = env!("CARGO_PKG_VERSION");
const BOOTSTRAP_MAIN_CLASS: &str = "cpw.mods.bootstraplauncher.BootstrapLauncher";

struct RawLaunchArgs {
    jvm: Vec<String>,
    game: Vec<String>,
    main_class: String,
    asset_index: String,
    legacy_args: Option<String>,
    uses_module_path: bool,
}

struct ResolvedClasspath {
    entries: Vec<String>,
    missing: Vec<String>,
}

impl RawLaunchArgs {
    fn new(default_asset_index: String) -> Self {
        Self {
            jvm: Vec::new(),
            game: Vec::new(),
            main_class: String::new(),
            asset_index: default_asset_index,
            legacy_args: None,
            uses_module_path: false,
        }
    }

    fn uses_module_bootstrap(&self) -> bool {
        self.uses_module_path || self.main_class == BOOTSTRAP_MAIN_CLASS
    }
}

impl LaunchCommandBuilder {
    fn classpath_separator() -> &'static str {
        if cfg!(target_os = "windows") {
            ";"
        } else {
            ":"
        }
    }

    fn normalize_path_key(path: &str) -> String {
        let normalized = if cfg!(target_os = "windows") {
            path.replace('/', "\\").to_lowercase()
        } else {
            path.replace('\\', "/")
        };
        normalized.trim().to_string()
    }

    fn split_path_entries(value: &str) -> Vec<String> {
        value
            .split(Self::classpath_separator())
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .map(|entry| entry.to_string())
            .collect()
    }

    fn is_path_option_flag(value: &str, short_flag: &str, long_flag: &str) -> bool {
        value == short_flag
            || value == long_flag
            || value.starts_with(&format!("{}=", short_flag))
            || value.starts_with(&format!("{}=", long_flag))
    }

    fn extract_inline_option_value<'a>(
        value: &'a str,
        short_flag: &str,
        long_flag: &str,
    ) -> Option<&'a str> {
        value
            .strip_prefix(&format!("{}=", short_flag))
            .or_else(|| value.strip_prefix(&format!("{}=", long_flag)))
    }

    fn collect_path_option_entries(
        args: &[String],
        short_flag: &str,
        long_flag: &str,
    ) -> Vec<String> {
        let mut entries = Vec::new();
        let mut index = 0;

        while index < args.len() {
            let arg = &args[index];
            if let Some(value) = Self::extract_inline_option_value(arg, short_flag, long_flag) {
                entries.extend(Self::split_path_entries(value));
            } else if arg == short_flag || arg == long_flag {
                if let Some(value) = args.get(index + 1) {
                    entries.extend(Self::split_path_entries(value));
                    index += 1;
                }
            }
            index += 1;
        }

        entries
    }

    fn resolve_placeholders(
        &self,
        arg: &str,
        version_name: &str,
        classpath: &str,
        natives_dir: &str,
        asset_index: &str,
    ) -> String {
        let arg = self.resolve_library_placeholder_arg(arg);
        arg.replace("${auth_player_name}", &self.auth.player_name)
            .replace("${version_name}", version_name)
            .replace(
                "${game_directory}",
                &self.game_dir.to_string_lossy().to_string(),
            )
            .replace(
                "${assets_root}",
                &self.get_assets_dir().to_string_lossy().to_string(),
            )
            .replace("${assets_index_name}", asset_index)
            .replace("${auth_uuid}", &self.auth.uuid)
            .replace("${auth_access_token}", &self.auth.access_token)
            .replace("${user_type}", &self.auth.user_type)
            .replace("${version_type}", "PiLauncher")
            .replace("${launcher_name}", LAUNCHER_NAME)
            .replace("${launcher_version}", LAUNCHER_VERSION)
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
                &self.get_libraries_dir().to_string_lossy().to_string(),
            )
            .replace("${classpath}", classpath)
            .replace("${natives_directory}", natives_dir)
            .replace("${classpath_separator}", Self::classpath_separator())
            .replace("${user_properties}", "{}")
            .replace("${auth_session}", "{}")
            .replace("${auth_xuid}", "0")
            .replace("${clientid}", "0")
    }

    fn resolve_library_placeholder_segment(&self, segment: &str) -> String {
        let libraries_dir = self.get_libraries_dir();
        let libraries_dir_str = libraries_dir.to_string_lossy().to_string();
        let trimmed = segment.trim();

        if trimmed == "${library_directory}" {
            return libraries_dir_str;
        }

        if let Some(relative_path) = trimmed
            .strip_prefix("${library_directory}/")
            .or_else(|| trimmed.strip_prefix("${library_directory}\\"))
        {
            let normalized_relative = relative_path.replace('\\', "/");
            return self
                .resolve_library_path(&normalized_relative)
                .unwrap_or_else(|| {
                    libraries_dir
                        .join(Path::new(relative_path))
                        .to_string_lossy()
                        .to_string()
                });
        }

        trimmed.replace("${library_directory}", &libraries_dir_str)
    }

    fn resolve_library_placeholder_value(&self, value: &str) -> String {
        if !value.contains("${library_directory}") {
            return value.to_string();
        }

        if !value.contains(Self::classpath_separator()) {
            return self.resolve_library_placeholder_segment(value);
        }

        Self::split_path_entries(value)
            .into_iter()
            .map(|segment| self.resolve_library_placeholder_segment(&segment))
            .collect::<Vec<_>>()
            .join(Self::classpath_separator())
    }

    fn resolve_library_placeholder_arg(&self, arg: &str) -> String {
        if !arg.contains("${library_directory}") {
            return arg.to_string();
        }

        if let Some((prefix, value)) = arg.split_once('=') {
            return format!(
                "{}={}",
                prefix,
                self.resolve_library_placeholder_value(value)
            );
        }

        self.resolve_library_placeholder_value(arg)
    }

    fn collect_argument_values(target: &mut Vec<String>, arg: &Value) {
        if let Some(s) = arg.as_str() {
            target.push(s.to_string());
            return;
        }

        let Some(obj) = arg.as_object() else {
            return;
        };

        if !Self::check_rules(obj.get("rules").and_then(|v| v.as_array())) {
            return;
        }

        let Some(values) = obj.get("value") else {
            return;
        };

        if let Some(s) = values.as_str() {
            target.push(s.to_string());
        } else if let Some(arr) = values.as_array() {
            for value in arr {
                if let Some(s) = value.as_str() {
                    target.push(s.to_string());
                }
            }
        }
    }

    fn collect_raw_arguments(&self, version_chain: &[VersionManifest]) -> RawLaunchArgs {
        let mut raw = RawLaunchArgs::new(self.mc_version.clone());

        for manifest in version_chain {
            let json = &manifest.json;

            if let Some(id) = json.pointer("/assetIndex/id").and_then(|v| v.as_str()) {
                raw.asset_index = id.to_string();
            }
            if let Some(main_class) = json["mainClass"].as_str() {
                raw.main_class = main_class.to_string();
            }
            if let Some(legacy_args) = json["minecraftArguments"].as_str() {
                raw.legacy_args = Some(legacy_args.to_string());
            }

            if let Some(args) = json.get("arguments").and_then(|v| v.as_object()) {
                if let Some(jvm) = args.get("jvm").and_then(|v| v.as_array()) {
                    for arg in jvm {
                        Self::collect_argument_values(&mut raw.jvm, arg);
                    }
                }
                if let Some(game) = args.get("game").and_then(|v| v.as_array()) {
                    for arg in game {
                        Self::collect_argument_values(&mut raw.game, arg);
                    }
                }
            }
        }

        if raw.jvm.is_empty() {
            raw.jvm = vec![
                "-Djava.library.path=${natives_directory}".to_string(),
                "-cp".to_string(),
                "${classpath}".to_string(),
            ];
        }

        if raw.game.is_empty() {
            if let Some(legacy_args) = raw.legacy_args.as_ref() {
                raw.game = legacy_args
                    .split_whitespace()
                    .map(|arg| arg.to_string())
                    .collect();
            }
        }

        raw.uses_module_path = raw
            .jvm
            .iter()
            .any(|arg| Self::is_path_option_flag(arg, "-p", "--module-path"));

        raw
    }

    fn legacy_library_download_path(lib: &Value, classifier: Option<&str>) -> Option<String> {
        let name = lib["name"].as_str()?;
        let parts: Vec<&str> = name.split(':').collect();
        if parts.len() < 3 {
            return None;
        }

        let group = parts[0].replace('.', "/");
        let artifact = parts[1];
        let version = parts[2];
        let classifier = classifier
            .map(|value| format!("-{}", value))
            .unwrap_or_default();

        Some(format!(
            "{}/{}/{}/{}-{}{}.jar",
            group, artifact, version, artifact, version, classifier
        ))
    }

    fn library_download_paths(lib: &Value, current_os: &str) -> Vec<String> {
        let mut paths_to_check = Vec::new();
        let has_natives = lib
            .get("natives")
            .and_then(|value| value.as_object())
            .is_some();

        if let Some(path) = lib
            .pointer("/downloads/artifact/path")
            .and_then(|path| path.as_str())
        {
            paths_to_check.push(path.to_string());
        }

        if !has_natives {
            if let Some(classifiers) = lib
                .pointer("/downloads/classifiers")
                .and_then(|classifiers| classifiers.as_object())
            {
                for (key, value) in classifiers {
                    if Self::classifier_matches_os(key, current_os) {
                        if let Some(path) = value.get("path").and_then(|path| path.as_str()) {
                            paths_to_check.push(path.to_string());
                        }
                    }
                }
            }
        }

        if paths_to_check.is_empty() && !has_natives {
            if let Some(path) = Self::legacy_library_download_path(lib, None) {
                paths_to_check.push(path);
            }
        }

        paths_to_check
    }

    pub(super) fn native_library_download_paths(lib: &Value, current_os: &str) -> Vec<String> {
        let Some(natives) = lib.get("natives").and_then(|value| value.as_object()) else {
            return Vec::new();
        };

        let classifier_value = natives
            .get(current_os)
            .or_else(|| {
                if current_os == "osx" {
                    natives.get("macos")
                } else {
                    None
                }
            })
            .and_then(|value| value.as_str());

        let Some(classifier_value) = classifier_value else {
            return Vec::new();
        };

        let classifier_key = classifier_value.replace("${arch}", Self::current_arch());
        let mut paths = Vec::new();

        if let Some(classifiers) = lib
            .pointer("/downloads/classifiers")
            .and_then(|classifiers| classifiers.as_object())
        {
            if let Some(path) = classifiers
                .get(&classifier_key)
                .and_then(|value| value.get("path"))
                .and_then(|value| value.as_str())
            {
                paths.push(path.to_string());
            }
        }

        if paths.is_empty() {
            if let Some(path) = Self::legacy_library_download_path(lib, Some(&classifier_key)) {
                paths.push(path);
            }
        }

        paths
    }

    fn push_unique_entry(entries: &mut Vec<String>, seen: &mut HashSet<String>, entry: String) {
        if seen.insert(Self::normalize_path_key(&entry)) {
            entries.push(entry);
        }
    }

    fn push_missing_entry(
        missing: &mut Vec<String>,
        seen: &mut HashSet<String>,
        label: &str,
        path: &Path,
    ) {
        let entry = format!("{}: {}", label, path.to_string_lossy());
        if seen.insert(entry.clone()) {
            missing.push(entry);
        }
    }

    pub(super) fn resolve_existing_path(candidates: &[PathBuf]) -> Option<PathBuf> {
        candidates.iter().find(|path| path.exists()).cloned()
    }

    pub(super) fn library_path_candidates(&self, dl_path: &str) -> Vec<PathBuf> {
        let primary = self.get_libraries_dir().join(dl_path);
        let fallback = self.runtime_dir.join("libraries").join(dl_path);

        if fallback == primary {
            vec![primary]
        } else {
            vec![primary, fallback]
        }
    }

    pub(super) fn resolve_library_path(&self, dl_path: &str) -> Option<String> {
        Self::resolve_existing_path(&self.library_path_candidates(dl_path))
            .map(|jar_path| jar_path.to_string_lossy().to_string())
    }

    fn version_jar_candidates(&self, version_id: &str) -> Vec<PathBuf> {
        let mut candidates = Vec::new();

        if let Some(tp_root) = &self.third_party_root {
            let tp_jar = tp_root.join(format!("{}.jar", version_id));
            candidates.push(tp_jar);
        }

        let primary = self
            .get_minecraft_root()
            .join("versions")
            .join(version_id)
            .join(format!("{}.jar", version_id));
        candidates.push(primary);

        let fallback = self
            .runtime_dir
            .join("versions")
            .join(version_id)
            .join(format!("{}.jar", version_id));

        if !candidates.iter().any(|candidate| candidate == &fallback) {
            candidates.push(fallback);
        }

        candidates
    }

    fn core_jar_candidates(
        &self,
        launch_jar_id: &str,
        allow_minecraft_fallback: bool,
    ) -> Vec<PathBuf> {
        let mut candidates = self.version_jar_candidates(launch_jar_id);

        if allow_minecraft_fallback {
            for candidate in self.version_jar_candidates(&self.mc_version) {
                if !candidates.iter().any(|existing| existing == &candidate) {
                    candidates.push(candidate);
                }
            }
        }

        candidates
    }

    fn resolve_core_jar(
        &self,
        launch_jar_id: &str,
        allow_minecraft_fallback: bool,
    ) -> Option<PathBuf> {
        Self::resolve_existing_path(&self.core_jar_candidates(
            launch_jar_id,
            allow_minecraft_fallback,
        ))
    }

    fn build_classpath(
        &self,
        libraries: &[Value],
        launch_jar_id: &str,
        allow_minecraft_fallback: bool,
    ) -> ResolvedClasspath {
        let mut cp = Vec::new();
        let mut seen = HashSet::new();
        let mut missing = Vec::new();
        let mut missing_seen = HashSet::new();
        let current_os = Self::current_os();

        for lib in libraries {
            if !Self::check_rules(lib.get("rules").and_then(|v| v.as_array())) {
                continue;
            }

            for dl_path in Self::library_download_paths(lib, current_os) {
                if let Some(path) = self.resolve_library_path(&dl_path) {
                    Self::push_unique_entry(&mut cp, &mut seen, path);
                } else if let Some(path) = self.library_path_candidates(&dl_path).first() {
                    Self::push_missing_entry(
                        &mut missing,
                        &mut missing_seen,
                        "缺失库文件",
                        path,
                    );
                }
            }
        }

        if let Some(core_jar) = self.resolve_core_jar(launch_jar_id, allow_minecraft_fallback) {
            Self::push_unique_entry(&mut cp, &mut seen, core_jar.to_string_lossy().to_string());
        } else if allow_minecraft_fallback {
            if let Some(path) = self
                .core_jar_candidates(launch_jar_id, allow_minecraft_fallback)
                .first()
            {
                Self::push_missing_entry(
                    &mut missing,
                    &mut missing_seen,
                    "缺失游戏主文件",
                    path,
                );
            }
        }

        ResolvedClasspath {
            entries: cp,
            missing,
        }
    }

    fn filter_module_path_entries(
        &self,
        classpath_entries: Vec<String>,
        resolved_jvm_args: &[String],
    ) -> Vec<String> {
        let module_path_entries =
            Self::collect_path_option_entries(resolved_jvm_args, "-p", "--module-path");
        if module_path_entries.is_empty() {
            return classpath_entries;
        }

        let module_keys: HashSet<String> = module_path_entries
            .iter()
            .map(|entry| Self::normalize_path_key(entry))
            .collect();

        classpath_entries
            .into_iter()
            .filter(|entry| !module_keys.contains(&Self::normalize_path_key(entry)))
            .collect()
    }

    fn resolve_jvm_args(
        &self,
        raw: &RawLaunchArgs,
        version_name: &str,
        classpath: &str,
        natives_dir: &str,
    ) -> Vec<String> {
        raw.jvm
            .iter()
            .map(|arg| {
                self.resolve_placeholders(
                    arg,
                    version_name,
                    classpath,
                    natives_dir,
                    &raw.asset_index,
                )
            })
            .collect()
    }

    fn resolve_game_args(
        &self,
        raw: &RawLaunchArgs,
        version_name: &str,
        classpath: &str,
        natives_dir: &str,
    ) -> Vec<String> {
        raw.game
            .iter()
            .map(|arg| {
                self.resolve_placeholders(
                    arg,
                    version_name,
                    classpath,
                    natives_dir,
                    &raw.asset_index,
                )
            })
            .collect()
    }

    pub fn build_args(&self) -> Result<Vec<String>, LaunchPreparationError> {
        let version_chain = self.get_version_chain().map_err(|err| {
            LaunchPreparationError::MissingDependencies(vec![format!("版本文件不完整: {}", err)])
        })?;

        let launch_version_id = Self::launch_version_id(&version_chain, &self.mc_version);
        let launch_jar_id = Self::launch_jar_id(&version_chain, &launch_version_id);
        let raw = self.collect_raw_arguments(&version_chain);
        if raw.main_class.trim().is_empty() {
            return Err(LaunchPreparationError::BuildFailed(format!(
                "构建启动参数失败，版本 {} 缺少 mainClass",
                launch_version_id
            )));
        }
        let all_libraries = Self::merge_libraries(&version_chain);
        let allow_minecraft_fallback = !raw.uses_module_bootstrap();
        let natives_dir = self.get_natives_dir().to_string_lossy().to_string();

        let preliminary_classpath =
            self.build_classpath(&all_libraries, &launch_jar_id, allow_minecraft_fallback);
        if !preliminary_classpath.missing.is_empty() {
            return Err(LaunchPreparationError::MissingDependencies(
                preliminary_classpath.missing,
            ));
        }
        let preliminary_classpath_entries = preliminary_classpath.entries;
        let preliminary_classpath_string =
            preliminary_classpath_entries.join(Self::classpath_separator());
        let preliminary_jvm_args = self.resolve_jvm_args(
            &raw,
            &launch_version_id,
            &preliminary_classpath_string,
            &natives_dir,
        );

        let final_classpath_entries = self
            .filter_module_path_entries(preliminary_classpath_entries, &preliminary_jvm_args);
        let classpath_string = final_classpath_entries.join(Self::classpath_separator());
        let resolved_jvm_args =
            self.resolve_jvm_args(&raw, &launch_version_id, &classpath_string, &natives_dir);
        let resolved_game_args =
            self.resolve_game_args(&raw, &launch_version_id, &classpath_string, &natives_dir);

        let mut final_args = Vec::new();
        final_args.push("-XX:+IgnoreUnrecognizedVMOptions".to_string());
        
        let version_parts: Vec<&str> = self.mc_version.split('.').collect();
        let minor_version: u32 = version_parts.get(1).and_then(|v| v.parse().ok()).unwrap_or(0);
        if minor_version >= 20 {
            final_args.push("--enable-native-access=ALL-UNNAMED".to_string());
        }
        
        final_args.push(format!("-Xms{}M", self.config.min_memory));
        final_args.push(format!("-Xmx{}M", self.config.max_memory));
        final_args.extend(self.config.custom_jvm_args.clone());
        final_args.extend(resolved_jvm_args);
        final_args.push(raw.main_class);
        final_args.extend(resolved_game_args);

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

        Ok(final_args)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::launcher::{AuthSession, ResolvedLaunchConfig};
    use std::fs;
    use std::path::{Path, PathBuf};

    fn dummy_builder() -> LaunchCommandBuilder {
        LaunchCommandBuilder::new(
            ResolvedLaunchConfig {
                java_path: "auto".to_string(),
                min_memory: 1024,
                max_memory: 2048,
                resolution_width: 1280,
                resolution_height: 720,
                fullscreen: false,
                custom_jvm_args: Vec::new(),
                server_binding: None,
            },
            AuthSession {
                player_name: "tester".to_string(),
                uuid: "uuid".to_string(),
                access_token: "token".to_string(),
                user_type: "msa".to_string(),
            },
            "1.21.1",
            "neoforge-21.1.224",
            PathBuf::from("C:/game"),
            PathBuf::from("C:/runtime"),
            None,
        )
    }

    fn unique_test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pilauncher-launcher-builder-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    fn write_version_manifest(runtime_root: &Path, version_id: &str, manifest: &Value) {
        let version_dir = runtime_root.join("versions").join(version_id);
        fs::create_dir_all(&version_dir).unwrap();
        fs::write(
            version_dir.join(format!("{}.json", version_id)),
            serde_json::to_string_pretty(manifest).unwrap(),
        )
        .unwrap();
        fs::write(version_dir.join(format!("{}.jar", version_id)), b"").unwrap();
    }

    fn legacy_version_manifest(version_id: &str) -> Value {
        serde_json::json!({
            "id": version_id,
            "mainClass": "net.minecraft.client.main.Main",
            "minecraftArguments": "--username ${auth_player_name}",
            "libraries": [
                {
                    "name": "org.lwjgl.lwjgl:lwjgl:2.9.4-nightly-20150209"
                }
            ]
        })
    }

    fn normalize_for_assert(value: &str) -> String {
        value.replace('\\', "/")
    }

    #[test]
    fn library_download_paths_excludes_native_classifiers_from_classpath() {
        let lib = serde_json::json!({
            "name": "org.lwjgl:lwjgl:3.3.3",
            "natives": {
                "windows": "natives-windows"
            },
            "downloads": {
                "artifact": {
                    "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar"
                },
                "classifiers": {
                    "natives-windows": {
                        "path": "org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3-natives-windows.jar"
                    }
                }
            }
        });

        assert_eq!(
            LaunchCommandBuilder::library_download_paths(&lib, "windows"),
            vec!["org/lwjgl/lwjgl/3.3.3/lwjgl-3.3.3.jar".to_string()]
        );
    }

    #[test]
    fn collect_path_option_entries_supports_inline_and_pair_syntax() {
        let args = vec![
            "-p".to_string(),
            "a.jar;b.jar".to_string(),
            "--module-path=c.jar;d.jar".to_string(),
        ];

        assert_eq!(
            LaunchCommandBuilder::collect_path_option_entries(&args, "-p", "--module-path"),
            vec![
                "a.jar".to_string(),
                "b.jar".to_string(),
                "c.jar".to_string(),
                "d.jar".to_string()
            ]
        );
    }

    #[test]
    fn filter_module_path_entries_removes_windows_normalized_duplicates() {
        let builder = dummy_builder();
        let classpath = vec![
            r"C:\runtime\libraries\cpw\mods\bootstraplauncher\2.0.2\bootstraplauncher-2.0.2.jar"
                .to_string(),
            r"C:\runtime\versions\1.21.1\1.21.1.jar".to_string(),
        ];
        let jvm_args = vec![
            "-p".to_string(),
            "C:/runtime/libraries/cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar"
                .to_string(),
        ];

        assert_eq!(
            builder.filter_module_path_entries(classpath, &jvm_args),
            vec![r"C:\runtime\versions\1.21.1\1.21.1.jar".to_string()]
        );
    }

    #[test]
    fn resolve_library_placeholder_arg_uses_existing_runtime_per_path_entry() {
        let unique = format!(
            "pilauncher-builder-args-test-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        );
        let root = std::env::temp_dir().join(unique);
        let external_root = root.join("external");
        let third_party_root = external_root.join("versions").join("custom-pack");
        let runtime_root = root.join("runtime");

        let external_bootstrap = external_root
            .join("libraries")
            .join("cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar");
        let runtime_jarjar = runtime_root
            .join("libraries")
            .join("net/neoforged/JarJarFileSystems/0.4.1/JarJarFileSystems-0.4.1.jar");

        fs::create_dir_all(external_bootstrap.parent().unwrap()).unwrap();
        fs::create_dir_all(runtime_jarjar.parent().unwrap()).unwrap();
        fs::create_dir_all(&third_party_root).unwrap();
        fs::write(&external_bootstrap, b"").unwrap();
        fs::write(&runtime_jarjar, b"").unwrap();

        let builder = LaunchCommandBuilder::new(
            ResolvedLaunchConfig {
                java_path: "auto".to_string(),
                min_memory: 1024,
                max_memory: 2048,
                resolution_width: 1280,
                resolution_height: 720,
                fullscreen: false,
                custom_jvm_args: Vec::new(),
                server_binding: None,
            },
            AuthSession {
                player_name: "tester".to_string(),
                uuid: "uuid".to_string(),
                access_token: "token".to_string(),
                user_type: "msa".to_string(),
            },
            "1.21.1",
            "neoforge-21.1.224",
            PathBuf::from("C:/game"),
            runtime_root.clone(),
            Some(third_party_root),
        );

        let separator = LaunchCommandBuilder::classpath_separator();
        let resolved = builder.resolve_library_placeholder_arg(&format!(
            "${{library_directory}}/cpw/mods/bootstraplauncher/2.0.2/bootstraplauncher-2.0.2.jar{}${{library_directory}}/net/neoforged/JarJarFileSystems/0.4.1/JarJarFileSystems-0.4.1.jar",
            separator
        ));

        assert_eq!(
            resolved,
            format!(
                "{}{}{}",
                external_bootstrap.to_string_lossy(),
                separator,
                runtime_jarjar.to_string_lossy()
            )
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn build_args_blocks_launch_when_legacy_library_is_missing() {
        let root = unique_test_root("missing-legacy-lib");
        let runtime_root = root.join("runtime");
        let game_dir = root.join("game");
        fs::create_dir_all(&game_dir).unwrap();
        write_version_manifest(&runtime_root, "1.12.2", &legacy_version_manifest("1.12.2"));

        let builder = LaunchCommandBuilder::new(
            ResolvedLaunchConfig {
                java_path: "auto".to_string(),
                min_memory: 1024,
                max_memory: 2048,
                resolution_width: 1280,
                resolution_height: 720,
                fullscreen: false,
                custom_jvm_args: Vec::new(),
                server_binding: None,
            },
            AuthSession {
                player_name: "tester".to_string(),
                uuid: "uuid".to_string(),
                access_token: "token".to_string(),
                user_type: "msa".to_string(),
            },
            "1.12.2",
            "1.12.2",
            game_dir,
            runtime_root,
            None,
        );

        match builder.build_args() {
            Err(LaunchPreparationError::MissingDependencies(details)) => {
                assert!(details.iter().map(|detail| normalize_for_assert(detail)).any(|detail| {
                    detail.contains(
                        "org/lwjgl/lwjgl/lwjgl/2.9.4-nightly-20150209/lwjgl-2.9.4-nightly-20150209.jar"
                    )
                }));
            }
            other => panic!("expected missing dependency error, got {:?}", other),
        }

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn build_args_includes_legacy_library_when_file_exists() {
        let root = unique_test_root("legacy-lib-present");
        let runtime_root = root.join("runtime");
        let game_dir = root.join("game");
        let library_path = runtime_root
            .join("libraries")
            .join("org/lwjgl/lwjgl/lwjgl/2.9.4-nightly-20150209/lwjgl-2.9.4-nightly-20150209.jar");

        fs::create_dir_all(&game_dir).unwrap();
        fs::create_dir_all(library_path.parent().unwrap()).unwrap();
        fs::write(&library_path, b"").unwrap();
        write_version_manifest(&runtime_root, "1.12.2", &legacy_version_manifest("1.12.2"));

        let builder = LaunchCommandBuilder::new(
            ResolvedLaunchConfig {
                java_path: "auto".to_string(),
                min_memory: 1024,
                max_memory: 2048,
                resolution_width: 1280,
                resolution_height: 720,
                fullscreen: false,
                custom_jvm_args: Vec::new(),
                server_binding: None,
            },
            AuthSession {
                player_name: "tester".to_string(),
                uuid: "uuid".to_string(),
                access_token: "token".to_string(),
                user_type: "msa".to_string(),
            },
            "1.12.2",
            "1.12.2",
            game_dir,
            runtime_root,
            None,
        );

        let args = builder.build_args().expect("legacy library should resolve");
        let classpath = args
            .windows(2)
            .find_map(|pair| (pair[0] == "-cp").then(|| pair[1].clone()))
            .expect("classpath should exist");

        assert!(normalize_for_assert(&classpath)
            .contains("org/lwjgl/lwjgl/lwjgl/2.9.4-nightly-20150209/lwjgl-2.9.4-nightly-20150209.jar"));

        let _ = fs::remove_dir_all(root);
    }
}
