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
            sha1: None,
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

                            if let Some(depends) = json.get("depends").and_then(|d| d.as_object()) {
                                let mut deps = Vec::new();
                                for (k, _) in depends {
                                    if k != "minecraft" && k != "java" && k != "fabricloader" {
                                        deps.push(k.clone());
                                    }
                                }
                                if !deps.is_empty() {
                                    meta.dependencies = Some(deps);
                                }
                            }
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

                                    if let Some(depends) = quilt_loader.get("depends").and_then(|d| d.as_array()) {
                                        let mut deps = Vec::new();
                                        for item in depends {
                                            if let Some(id) = item.as_str() {
                                                if id != "minecraft" && id != "quilt_loader" && id != "java" {
                                                    deps.push(id.to_string());
                                                }
                                            } else if let Some(id) = item.get("id").and_then(|i| i.as_str()) {
                                                if id != "minecraft" && id != "quilt_loader" && id != "java" {
                                                    deps.push(id.to_string());
                                                }
                                            }
                                        }
                                        if !deps.is_empty() {
                                            meta.dependencies = Some(deps);
                                        }
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
                                if let Ok(name_re) =
                                    regex::Regex::new(r#"displayName\s*=\s*(?:"|')([^"']+)(?:"|')"#)
                                {
                                    if let Some(caps) = name_re.captures(&contents) {
                                        meta.name = Some(caps[1].to_string());
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

                                // 提取 dependencies
                                let mut deps = Vec::new();
                                if let Ok(dep_re) = regex::Regex::new(r#"(?m)^\s*modId\s*=\s*(?:"|')([^"']+)(?:"|')"#) {
                                    for caps in dep_re.captures_iter(&contents) {
                                        let d_id = caps[1].to_string();
                                        if meta.mod_id.as_deref() != Some(&d_id)
                                            && d_id != "minecraft"
                                            && d_id != "forge"
                                            && d_id != "neoforge"
                                            && !deps.contains(&d_id)
                                        {
                                            deps.push(d_id);
                                        }
                                    }
                                }
                                if !deps.is_empty() {
                                    meta.dependencies = Some(deps);
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
        if jar_path.is_dir() {
            let fallbacks = [
                "pack.png",
                "logo.png",
                "icon.png",
                "assets/icon.png",
                "shaders/pack.png",
                "shaders/icon.png",
                "shaders/logo.png",
                "pack.jpg",
                "icon.jpg",
                "logo.jpg",
            ];
            for f in fallbacks {
                let candidate = jar_path.join(f);
                if candidate.is_file() {
                    if let Some(parent) = target_path.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    if std::fs::copy(&candidate, target_path).is_ok() {
                        return true;
                    }
                }
            }

            // 递归浅层检索一级子目录中的 pack.png / icon.png 等
            if let Ok(entries) = fs::read_dir(jar_path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let sub = entry.path();
                    if sub.is_dir() {
                        for name in &["pack.png", "icon.png", "logo.png", "pack.jpg", "icon.jpg"] {
                            let candidate = sub.join(name);
                            if candidate.is_file() {
                                if let Some(parent) = target_path.parent() {
                                    let _ = std::fs::create_dir_all(parent);
                                }
                                if std::fs::copy(&candidate, target_path).is_ok() {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            return false;
        }

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

                // 4. Default Fallbacks (包含资源包与光影包常用路径)
                if icon_path_in_jar.is_none() {
                    let fallbacks = [
                        "pack.png",
                        "logo.png",
                        "icon.png",
                        "assets/icon.png",
                        "shaders/pack.png",
                        "shaders/icon.png",
                        "shaders/logo.png",
                        "pack.jpg",
                        "icon.jpg",
                        "logo.jpg",
                    ];
                    for f in fallbacks {
                        if archive.by_name(f).is_ok() {
                            icon_path_in_jar = Some(f.to_string());
                            break;
                        }
                    }
                }

                // 5. 递归匹配 ZIP 中任意嵌套层级的 pack.png / icon.png / logo.png 等
                if icon_path_in_jar.is_none() {
                    for i in 0..archive.len() {
                        if let Ok(entry) = archive.by_index(i) {
                            let entry_name = entry.name().to_string();
                            let lower = entry_name.to_ascii_lowercase();
                            if !lower.contains("__macosx") {
                                let is_image = lower.ends_with(".png")
                                    || lower.ends_with(".jpg")
                                    || lower.ends_with(".jpeg")
                                    || lower.ends_with(".webp");
                                if is_image {
                                    let filename = lower.split('/').last().unwrap_or("");
                                    let stem = filename.split('.').next().unwrap_or("");
                                    if stem == "pack"
                                        || stem == "icon"
                                        || stem == "logo"
                                        || stem == "preview"
                                        || stem == "banner"
                                    {
                                        icon_path_in_jar = Some(entry_name);
                                        break;
                                    }
                                }
                            }
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
