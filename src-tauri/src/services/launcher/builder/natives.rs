use super::{LaunchCommandBuilder, LaunchPreparationError};
use std::collections::HashSet;
use std::fs;

impl LaunchCommandBuilder {
    pub fn extract_natives(&self) -> Result<(), LaunchPreparationError> {
        let natives_dir = self.get_natives_dir();
        if !natives_dir.exists() {
            fs::create_dir_all(&natives_dir).map_err(|e| {
                LaunchPreparationError::BuildFailed(format!(
                    "创建 natives 目录失败: {} ({})",
                    natives_dir.to_string_lossy(),
                    e
                ))
            })?;
        }

        let version_chain = self.get_version_chain().map_err(|err| {
            LaunchPreparationError::MissingDependencies(vec![format!("版本文件不完整: {}", err)])
        })?;
        let current_os = Self::current_os();
        let mut missing = Vec::new();
        let mut missing_seen = HashSet::new();

        for lib in Self::merge_libraries(&version_chain) {
            if !Self::check_rules(lib.get("rules").and_then(|v| v.as_array())) {
                continue;
            }

            let exclude_prefixes: Vec<String> = lib
                .pointer("/extract/exclude")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_str().map(|value| value.to_string()))
                .collect();

            for path_str in Self::native_library_download_paths(&lib, current_os) {
                let candidates = self.library_path_candidates(&path_str);
                let Some(jar_path) = Self::resolve_existing_path(&candidates) else {
                    if let Some(path) = candidates.first() {
                        let entry = format!("缺失本机库压缩包: {}", path.to_string_lossy());
                        if missing_seen.insert(entry.clone()) {
                            missing.push(entry);
                        }
                    }
                    continue;
                };

                let file = fs::File::open(&jar_path).map_err(|e| {
                    LaunchPreparationError::BuildFailed(format!(
                        "读取本机库失败: {} ({})",
                        jar_path.to_string_lossy(),
                        e
                    ))
                })?;

                let mut archive = zip::ZipArchive::new(file).map_err(|e| {
                    LaunchPreparationError::BuildFailed(format!(
                        "解压本机库失败: {} ({})",
                        jar_path.to_string_lossy(),
                        e
                    ))
                })?;

                for i in 0..archive.len() {
                    let mut file = archive.by_index(i).map_err(|e| {
                        LaunchPreparationError::BuildFailed(format!(
                            "读取 natives 条目失败: {} ({})",
                            jar_path.to_string_lossy(),
                            e
                        ))
                    })?;

                    let file_name = file.name().to_string();
                    if file_name.ends_with('/')
                        || exclude_prefixes
                            .iter()
                            .any(|prefix| file_name.starts_with(prefix))
                    {
                        continue;
                    }

                    let outpath = natives_dir.join(&file_name);
                    if let Some(parent) = outpath.parent() {
                        fs::create_dir_all(parent).map_err(|e| {
                            LaunchPreparationError::BuildFailed(format!(
                                "创建 natives 子目录失败: {} ({})",
                                parent.to_string_lossy(),
                                e
                            ))
                        })?;
                    }

                    let mut outfile = fs::File::create(&outpath).map_err(|e| {
                        LaunchPreparationError::BuildFailed(format!(
                            "写入 natives 文件失败: {} ({})",
                            outpath.to_string_lossy(),
                            e
                        ))
                    })?;
                    std::io::copy(&mut file, &mut outfile).map_err(|e| {
                        LaunchPreparationError::BuildFailed(format!(
                            "写入 natives 文件失败: {} ({})",
                            outpath.to_string_lossy(),
                            e
                        ))
                    })?;
                }
            }
        }

        if !missing.is_empty() {
            return Err(LaunchPreparationError::MissingDependencies(missing));
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::launcher::{AuthSession, ResolvedLaunchConfig};
    use serde_json::json;
    use std::fs;
    use std::path::PathBuf;

    fn unique_test_root(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "pilauncher-launcher-natives-{}-{}",
            label,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos()
        ))
    }

    fn write_version_manifest(runtime_root: &PathBuf, version_id: &str) {
        let version_dir = runtime_root.join("versions").join(version_id);
        fs::create_dir_all(&version_dir).unwrap();
        let native_classifier = format!("natives-{}", LaunchCommandBuilder::current_os());
        let native_key = if LaunchCommandBuilder::current_os() == "osx" {
            "osx"
        } else {
            LaunchCommandBuilder::current_os()
        };
        let manifest = json!({
            "id": version_id,
            "mainClass": "net.minecraft.client.main.Main",
            "libraries": [
                {
                    "name": "org.example:native-lib:1.0.0",
                    "natives": {
                        native_key: native_classifier
                    },
                    "extract": {
                        "exclude": ["META-INF/"]
                    }
                }
            ]
        });
        fs::write(
            version_dir.join(format!("{}.json", version_id)),
            serde_json::to_string_pretty(&manifest).unwrap(),
        )
        .unwrap();
    }

    fn builder(runtime_root: PathBuf, game_dir: PathBuf) -> LaunchCommandBuilder {
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
            "1.12.2",
            "1.12.2",
            game_dir,
            runtime_root,
            None,
        )
    }

    #[test]
    fn extract_natives_blocks_launch_when_native_archive_is_missing() {
        let root = unique_test_root("missing-native");
        let runtime_root = root.join("runtime");
        let game_dir = root.join("game");
        fs::create_dir_all(&game_dir).unwrap();
        write_version_manifest(&runtime_root, "1.12.2");

        match builder(runtime_root, game_dir).extract_natives() {
            Err(LaunchPreparationError::MissingDependencies(details)) => {
                assert!(details
                    .iter()
                    .any(|detail| detail.contains("native-lib-1.0.0")));
            }
            other => panic!("expected missing native dependency error, got {:?}", other),
        }

        let _ = fs::remove_dir_all(root);
    }
}
