extern crate serde_json;
use serde_json::Value;

fn parse_third_party_json(dir_name: &str, json: &serde_json::Value) -> (String, String, String) {
    let mut mc_version = dir_name.to_string();
    let mut loader_type = "vanilla".to_string();
    let mut loader_version = "".to_string();

    // 1. 如果存在 inheritsFrom（常规的剥离式 JSON），这是最直接的 mc_version 来源。
    if let Some(inherits) = json.get("inheritsFrom").and_then(|v| v.as_str()) {
        mc_version = inherits.to_string();
    }

    // 2. 尝试从 arguments.game 中提取准确的版本信息（Forge/NeoForge 适用）
    if let Some(args) = json.get("arguments").and_then(|a| a.get("game")).and_then(|g| g.as_array()) {
        let mut iter = args.iter();
        while let Some(arg) = iter.next() {
            if let Some(arg_str) = arg.as_str() {
                if arg_str == "--fml.mcVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        mc_version = val.to_string();
                    }
                } else if arg_str == "--fml.forgeVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        loader_type = "forge".to_string();
                        loader_version = val.to_string();
                    }
                } else if arg_str == "--fml.neoForgeVersion" {
                    if let Some(val) = iter.next().and_then(|v| v.as_str()) {
                        loader_type = "neoforge".to_string();
                        loader_version = val.to_string();
                    }
                }
            }
        }
    }

    // 3. 尝试从 libraries 数组中提取（Fabric/Quilt 适用，也兜底其他情况）
    if loader_type == "vanilla" || loader_version.is_empty() || mc_version == dir_name {
        if let Some(libs) = json.get("libraries").and_then(|l| l.as_array()) {
            for lib in libs {
                if let Some(name) = lib.get("name").and_then(|n| n.as_str()) {
                    // net.fabricmc:fabric-loader:0.18.4
                    if name.starts_with("net.fabricmc:fabric-loader:") {
                        loader_type = "fabric".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("org.quiltmc:quilt-loader:") {
                        loader_type = "quilt".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("net.neoforged:neoforge:") {
                        loader_type = "neoforge".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            loader_version = ver.to_string();
                        }
                    } else if name.starts_with("net.minecraftforge:forge:") {
                        loader_type = "forge".to_string();
                        if let Some(ver) = name.split(':').nth(2) {
                            // forge 包格式一般是: {mc_version}-{forge_version}
                            let v_str = ver.to_string();
                            if v_str.contains('-') {
                                loader_version = v_str.split('-').nth(1).unwrap_or(&v_str).to_string();
                            } else {
                                loader_version = v_str;
                            }
                        }
                    }
                    
                    // 获取 Fabric/Quilt 的 mc_version（通过 intermediary 或 hashed）
                    if mc_version == dir_name || mc_version.is_empty() {
                        if name.starts_with("net.fabricmc:intermediary:") || name.starts_with("org.quiltmc:hashed:") {
                            if let Some(ver) = name.split(':').nth(2) {
                                mc_version = ver.to_string();
                            }
                        }
                    }
                }
            }
        }
    }

    // 4. 兜底方案：从文件夹名称启发式推断（如果依然没有任何特征）
    if loader_type == "vanilla" && loader_version.is_empty() {
        let id_lower = dir_name.to_lowercase();
        if id_lower.contains("neoforge") {
            loader_type = "neoforge".to_string();
            let parts: Vec<&str> = dir_name.split("neoforge-").collect();
            if parts.len() >= 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("forge") {
            loader_type = "forge".to_string();
            let parts: Vec<&str> = dir_name.split("-forge-").collect();
            if parts.len() == 2 {
                loader_version = parts[1].to_string();
            }
        } else if id_lower.contains("fabric") {
            loader_type = "fabric".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 && parts[0] == "fabric" && parts[1] == "loader" {
                loader_version = parts[2].to_string();
            } else if parts.len() >= 2 && parts[1].contains("Fabric ") {
                loader_version = parts[1].replace("Fabric ", "");
            }
        } else if id_lower.contains("quilt") {
            loader_type = "quilt".to_string();
            let parts: Vec<&str> = dir_name.split('-').collect();
            if parts.len() >= 3 {
                loader_version = parts[2].to_string();
            }
        }
    }

    (mc_version, loader_type, loader_version)
}

fn main() {
    let files = vec![
        "h:\\VSCodeWork\\pilauncher\\docs\\loader\\1.20.1-Fabric 0.18.4.json",
        "h:\\VSCodeWork\\pilauncher\\docs\\loader\\1.20.1-Forge_47.4.18.json",
        "h:\\VSCodeWork\\pilauncher\\docs\\loader\\Cobblemon Modpack [NeoForge].json",
    ];

    for file in files {
        let content = std::fs::read_to_string(file).unwrap();
        let json: Value = serde_json::from_str(&content).unwrap();
        
        // Extract dir name from path
        let dir_name = std::path::Path::new(file).file_stem().unwrap().to_str().unwrap();
        
        let (mc, loader, version) = parse_third_party_json(dir_name, &json);
        println!("File: {}", dir_name);
        println!("  MC Version: {}", mc);
        println!("  Loader: {}", loader);
        println!("  Version: {}\n", version);
    }
}
