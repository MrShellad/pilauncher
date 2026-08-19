use crate::domain::mod_manifest::ModMetadata;
use serde_json::Value;
use std::fs::{self, File};
use std::io::Read;
use std::path::Path;

pub struct JarParser;

impl JarParser {
    pub fn extract_version_from_filename(filename: &str) -> Option<String> {
        let name = filename
            .trim_end_matches(".disabled")
            .trim_end_matches(".jar");

        if let Ok(re) = regex::Regex::new(r#"(?i)[-_+v\s](\d+(?:\.\d+)+(?:[-_+.][a-zA-Z0-9.]+)*)"#) {
            let mut matches = Vec::new();
            for cap in re.captures_iter(name) {
                if let Some(m) = cap.get(1) {
                    matches.push(m.as_str().to_string());
                }
            }
            if !matches.is_empty() {
                let non_mc: Vec<&String> = matches
                    .iter()
                    .filter(|s| {
                        if let Ok(mc_re) = regex::Regex::new(r#"^1\.\d{1,2}(?:\.\d{1,2})?$"#) {
                            !mc_re.is_match(s)
                        } else {
                            true
                        }
                    })
                    .collect();

                if let Some(chosen) = non_mc.last() {
                    return Some((*chosen).clone());
                }
                return Some(matches.last().unwrap().clone());
            }
        }
        None
    }

    /// Parse JAR metadata without extracting icons.
    pub fn parse_jar_meta(jar_path: &Path) -> ModMetadata {
        let file_name = jar_path.file_name().unwrap().to_string_lossy().to_string();
        let file_size = fs::metadata(jar_path).map(|m| m.len()).unwrap_or(0);
        let modified_at = fs::metadata(jar_path)
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
            .duration_since(std::time::SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();

        let mut meta = ModMetadata {
            file_name: file_name.clone(),
            mod_id: None,
            name: None,
            version: None,
            description: None,
            icon_absolute_path: None,
            offline_jar_icon_absolute_path: None,
            network_icon_url: None,
            curseforge_fingerprint: None,
            file_size,
            is_enabled: true,
            modified_at,
            manifest_entry: None,
            cache_key: None,
            dependencies: None,
            aliases: None,
            dependents_count: None,
        };

        if let Ok(file) = File::open(jar_path) {
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                let mut parsed = false;

                // 1. Fabric 解析
                if let Ok(mut mod_json) = archive.by_name("fabric.mod.json") {
                    let mut contents = String::new();
                    if mod_json.read_to_string(&mut contents).is_ok() {
                        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                            meta.mod_id = json["id"].as_str().map(|s| s.to_string());
                            if let Some(n) = json["name"].as_str() {
                                meta.name = Some(n.to_string());
                            }
                            meta.version = json["version"].as_str().map(|s| s.to_string());
                            meta.description = json["description"].as_str().map(|s| s.to_string());
                            parsed = true;
                        }
                    }
                }

                // 1.5. Quilt 解析
                if !parsed {
                    if let Ok(mut quilt_json) = archive.by_name("quilt.mod.json") {
                        let mut contents = String::new();
                        if quilt_json.read_to_string(&mut contents).is_ok() {
                            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                                if let Some(quilt_loader) = json.get("quilt_loader") {
                                    meta.mod_id =
                                        quilt_loader["id"].as_str().map(|s| s.to_string());
                                    meta.version =
                                        quilt_loader["version"].as_str().map(|s| s.to_string());
                                    if let Some(metadata) = quilt_loader.get("metadata") {
                                        if let Some(n) = metadata["name"].as_str() {
                                            meta.name = Some(n.to_string());
                                        }
                                        meta.description =
                                            metadata["description"].as_str().map(|s| s.to_string());
                                    }
                                    parsed = true;
                                }
                            }
                        }
                    }
                }

                // 2. Forge / NeoForge 解析
                if !parsed {
                    for toml_path in ["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
                        if let Ok(mut mod_toml) = archive.by_name(toml_path) {
                            let mut contents = String::new();
                            if mod_toml.read_to_string(&mut contents).is_ok() {
                                if let Ok(id_re) =
                                    regex::Regex::new(r#"modId\s*=\s*(?:"|')([^"']+)(?:"|')"#)
                                {
                                    if let Some(caps) = id_re.captures(&contents) {
                                        meta.mod_id = Some(caps[1].to_string());
                                    }
                                }
                                if let Ok(version_re) =
                                    regex::Regex::new(r#"version\s*=\s*(?:"|')([^"']+)(?:"|')"#)
                                {
                                    if let Some(caps) = version_re.captures(&contents) {
                                        let v = caps[1].to_string();
                                        if v != "${file.jarVersion}"
                                            && !v.starts_with("${")
                                            && v != "@VERSION@"
                                        {
                                            meta.version = Some(v);
                                        }
                                    }
                                }
                                if let Ok(desc_re1) =
                                    regex::Regex::new(r#"(?s)description\s*=\s*'''(.*?)'''"#)
                                {
                                    if let Some(caps) = desc_re1.captures(&contents) {
                                        meta.description = Some(caps[1].trim().to_string());
                                    } else if let Ok(desc_re2) =
                                        regex::Regex::new(r#"description\s*=\s*"([^"]+)""#)
                                    {
                                        if let Some(caps) = desc_re2.captures(&contents) {
                                            meta.description = Some(caps[1].to_string());
                                        }
                                    }
                                }
                                parsed = true;
                                break;
                            }
                        }
                    }
                }

                // 3. 1.12.2 及以下旧版 mcmod.info 解析
                if !parsed {
                    if let Ok(mut mcmod_info) = archive.by_name("mcmod.info") {
                        let mut contents = String::new();
                        if mcmod_info.read_to_string(&mut contents).is_ok() {
                            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                                let mods = if json.is_array() {
                                    json.as_array()
                                } else {
                                    json["modList"].as_array()
                                };
                                if let Some(mods_arr) = mods {
                                    if let Some(first_mod) = mods_arr.first() {
                                        meta.mod_id =
                                            first_mod["modid"].as_str().map(|s| s.to_string());
                                        meta.version =
                                            first_mod["version"].as_str().map(|s| s.to_string());
                                        meta.description = first_mod["description"]
                                            .as_str()
                                            .map(|s| s.to_string());

                                        let mut deps = Vec::new();
                                        if let Some(reqs) = first_mod["requiredMods"].as_array() {
                                            for r in reqs {
                                                if let Some(s) = r.as_str() {
                                                    if s != "minecraft" && s != "forge" {
                                                        deps.push(s.to_string());
                                                    }
                                                }
                                            }
                                        }
                                        if let Some(reqs) = first_mod["dependencies"].as_array() {
                                            for r in reqs {
                                                if let Some(s) = r.as_str() {
                                                    if s != "minecraft"
                                                        && s != "forge"
                                                        && !deps.contains(&s.to_string())
                                                    {
                                                        deps.push(s.to_string());
                                                    }
                                                }
                                            }
                                        }
                                        if !deps.is_empty() {
                                            meta.dependencies = Some(deps);
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Try reading META-INF/MANIFEST.MF for version if we don't have one yet
                if meta.version.is_none() {
                    if let Ok(mut manifest) = archive.by_name("META-INF/MANIFEST.MF") {
                        let mut contents = String::new();
                        if manifest.read_to_string(&mut contents).is_ok() {
                            let mut impl_version = None;
                            let mut spec_version = None;
                            let mut bundle_version = None;
                            for line in contents.lines() {
                                let parts: Vec<&str> = line.splitn(2, ':').collect();
                                if parts.len() == 2 {
                                    let key = parts[0].trim().to_ascii_lowercase();
                                    let val = parts[1].trim().to_string();
                                    if key == "implementation-version" {
                                        impl_version = Some(val);
                                    } else if key == "specification-version" {
                                        spec_version = Some(val);
                                    } else if key == "bundle-version" {
                                        bundle_version = Some(val);
                                    }
                                }
                            }
                            let v = impl_version.or(spec_version).or(bundle_version);
                            if let Some(v_str) = v {
                                if !v_str.starts_with("${") && v_str != "@VERSION@" {
                                    meta.version = Some(v_str);
                                }
                            }
                        }
                    }
                }
            }
        }

        if meta.version.is_none() {
            meta.version = Self::extract_version_from_filename(&file_name);
        }

        meta
    }

    pub fn extract_icon_to_path(jar_path: &Path, target_path: &Path) -> bool {
        if let Ok(file) = File::open(jar_path) {
            if let Ok(mut archive) = zip::ZipArchive::new(file) {
                let mut icon_path_in_jar = None;

                // 1. Fabric 解析
                if let Ok(mut mod_json) = archive.by_name("fabric.mod.json") {
                    let mut contents = String::new();
                    if mod_json.read_to_string(&mut contents).is_ok() {
                        if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                            if let Some(icon) = json["icon"].as_str() {
                                icon_path_in_jar = Some(icon.to_string());
                            }
                        }
                    }
                }

                // 1.5. Quilt 解析
                if icon_path_in_jar.is_none() {
                    if let Ok(mut quilt_json) = archive.by_name("quilt.mod.json") {
                        let mut contents = String::new();
                        if quilt_json.read_to_string(&mut contents).is_ok() {
                            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                                if let Some(quilt_loader) = json.get("quilt_loader") {
                                    if let Some(metadata) = quilt_loader.get("metadata") {
                                        if let Some(icon) = metadata["icon"].as_str() {
                                            icon_path_in_jar = Some(icon.to_string());
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 2. Forge / NeoForge 解析
                if icon_path_in_jar.is_none() {
                    for toml_path in ["META-INF/mods.toml", "META-INF/neoforge.mods.toml"] {
                        if let Ok(mut mod_toml) = archive.by_name(toml_path) {
                            let mut contents = String::new();
                            if mod_toml.read_to_string(&mut contents).is_ok() {
                                if let Ok(logo_re) =
                                    regex::Regex::new(r#"logoFile\s*=\s*(?:"|')([^"']+)(?:"|')"#)
                                {
                                    if let Some(caps) = logo_re.captures(&contents) {
                                        icon_path_in_jar = Some(caps[1].to_string());
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. mcmod.info 解析
                if icon_path_in_jar.is_none() {
                    if let Ok(mut mcmod_info) = archive.by_name("mcmod.info") {
                        let mut contents = String::new();
                        if mcmod_info.read_to_string(&mut contents).is_ok() {
                            if let Ok(json) = serde_json::from_str::<Value>(&contents) {
                                let mods = if json.is_array() {
                                    json.as_array()
                                } else {
                                    json["modList"].as_array()
                                };
                                if let Some(mods_arr) = mods {
                                    if let Some(first_mod) = mods_arr.first() {
                                        if let Some(logo) = first_mod["logoFile"].as_str() {
                                            if !logo.is_empty() {
                                                icon_path_in_jar = Some(logo.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Default Fallbacks
                if icon_path_in_jar.is_none() {
                    let fallbacks = ["pack.png", "logo.png", "icon.png", "assets/icon.png"];
                    for f in fallbacks {
                        if archive.by_name(f).is_ok() {
                            icon_path_in_jar = Some(f.to_string());
                            break;
                        }
                    }
                }

                if let Some(icon_path) = icon_path_in_jar {
                    let clean_path = icon_path.trim_start_matches('/');
                    if let Ok(mut icon_file) = archive.by_name(clean_path) {
                        if let Some(parent) = target_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        if let Ok(mut out_file) = File::create(target_path) {
                            if std::io::copy(&mut icon_file, &mut out_file).is_ok() {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        false
    }
}
