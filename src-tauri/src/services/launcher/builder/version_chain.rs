use super::{LaunchCommandBuilder, VersionManifest};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;

impl LaunchCommandBuilder {
    pub(super) fn get_minecraft_root(&self) -> PathBuf {
        if let Some(tp_root) = &self.third_party_root {
            if tp_root.join("versions").exists()
                || tp_root.join("libraries").exists()
                || tp_root.join("assets").exists()
            {
                return tp_root.to_path_buf();
            }

            if tp_root.file_name().and_then(|name| name.to_str()) == Some("versions") {
                if let Some(mc_root) = tp_root.parent() {
                    return mc_root.to_path_buf();
                }
            }

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

    fn runtime_roots(&self) -> Vec<PathBuf> {
        let mut roots = Vec::new();

        if self.third_party_root.is_some() {
            let minecraft_root = self.get_minecraft_root();
            if !roots.iter().any(|root| root == &minecraft_root) {
                roots.push(minecraft_root);
            }
        }

        if !roots.iter().any(|root| root == &self.runtime_dir) {
            roots.push(self.runtime_dir.clone());
        }

        roots
    }

    fn first_existing_runtime_subdir(&self, subdir: &str) -> Option<PathBuf> {
        self.runtime_roots()
            .into_iter()
            .map(|root| root.join(subdir))
            .find(|path| path.exists())
    }

    pub(super) fn get_libraries_dir(&self) -> PathBuf {
        self.first_existing_runtime_subdir("libraries")
            .unwrap_or_else(|| self.runtime_dir.join("libraries"))
    }

    pub(super) fn get_assets_dir(&self) -> PathBuf {
        self.first_existing_runtime_subdir("assets")
            .unwrap_or_else(|| self.runtime_dir.join("assets"))
    }

    pub(super) fn get_natives_dir(&self) -> PathBuf {
        if let Some(tp_root) = &self.third_party_root {
            tp_root.join("natives")
        } else {
            self.runtime_dir
                .join("versions")
                .join(&self.mc_version)
                .join("natives")
        }
    }

    pub(super) fn get_version_data(&self, version_id: &str) -> Option<Value> {
        if let Some(tp_root) = &self.third_party_root {
            let tp_json = tp_root.join(format!("{}.json", version_id));
            if tp_json.exists() {
                if let Ok(content) = fs::read_to_string(&tp_json) {
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
            if let Ok(content) = fs::read_to_string(&json_path) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return Some(json);
                }
            }
        }

        let fallback_json = self
            .runtime_dir
            .join("versions")
            .join(version_id)
            .join(format!("{}.json", version_id));

        if fallback_json.exists() && fallback_json != json_path {
            if let Ok(content) = fs::read_to_string(&fallback_json) {
                if let Ok(json) = serde_json::from_str(&content) {
                    return Some(json);
                }
            }
        }

        None
    }

    pub(super) fn get_launch_version_candidates(&self) -> Vec<String> {
        let mut candidates = Vec::new();

        if let Some(third_party_id) = self
            .third_party_root
            .as_ref()
            .and_then(|path| path.file_name())
            .and_then(|name| name.to_str())
            .map(|id| id.to_string())
        {
            candidates.push(third_party_id);
        }

        for version_id in [&self.target_version_id, &self.mc_version] {
            if !version_id.is_empty() && !candidates.iter().any(|id| id == version_id) {
                candidates.push(version_id.clone());
            }
        }

        candidates
    }

    pub(super) fn get_version_chain(&self) -> Result<Vec<VersionManifest>, String> {
        let candidates = self.get_launch_version_candidates();
        let mut current_id = candidates
            .iter()
            .find(|candidate| self.get_version_data(candidate.as_str()).is_some())
            .cloned()
            .ok_or_else(|| format!("找不到版本 JSON，候选项: {}", candidates.join(", ")))?;

        let mut chain = Vec::new();
        let mut visited = HashSet::new();

        loop {
            if !visited.insert(current_id.clone()) {
                return Err(format!("检测到循环继承链: {}", current_id));
            }

            let json = self
                .get_version_data(&current_id)
                .ok_or_else(|| format!("找不到版本 JSON: {}", current_id))?;

            let parent_id = json
                .get("inheritsFrom")
                .and_then(|value| value.as_str())
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(|value| value.to_string());

            chain.push(VersionManifest {
                id: current_id,
                json,
            });

            if let Some(parent_id) = parent_id {
                current_id = parent_id;
            } else {
                break;
            }
        }

        chain.reverse();
        Ok(chain)
    }

    pub(super) fn launch_version_id(version_chain: &[VersionManifest], fallback: &str) -> String {
        version_chain
            .last()
            .map(|manifest| manifest.id.clone())
            .unwrap_or_else(|| fallback.to_string())
    }

    pub(super) fn launch_jar_id(version_chain: &[VersionManifest], fallback: &str) -> String {
        version_chain
            .last()
            .and_then(|manifest| {
                manifest
                    .json
                    .get("jar")
                    .and_then(|value| value.as_str())
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(|value| value.to_string())
            })
            .unwrap_or_else(|| fallback.to_string())
    }

    pub(super) fn library_key(lib: &Value) -> Option<String> {
        let name = lib.get("name").and_then(|value| value.as_str())?;
        let parts: Vec<&str> = name.split(':').collect();
        let group = parts.first().copied().unwrap_or("");
        let artifact = parts.get(1).copied().unwrap_or("");
        let classifier = if parts.len() >= 4 { parts[3] } else { "" };
        Some(format!("{}:{}:{}", group, artifact, classifier))
    }

    pub(super) fn merge_libraries(version_chain: &[VersionManifest]) -> Vec<Value> {
        let mut lib_indices: HashMap<String, usize> = HashMap::new();
        let mut all_libraries = Vec::new();

        for manifest in version_chain {
            if let Some(libs) = manifest.json["libraries"].as_array() {
                for lib in libs {
                    if !Self::check_rules(lib.get("rules").and_then(|v| v.as_array())) {
                        continue;
                    }
                    if let Some(key) = Self::library_key(lib) {
                        if let Some(&idx) = lib_indices.get(&key) {
                            all_libraries[idx] = lib.clone();
                        } else {
                            lib_indices.insert(key, all_libraries.len());
                            all_libraries.push(lib.clone());
                        }
                    } else {
                        all_libraries.push(lib.clone());
                    }
                }
            }
        }

        all_libraries
    }
}
