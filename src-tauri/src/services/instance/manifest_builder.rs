// src-tauri/src/services/instance/manifest_builder.rs
use crate::domain::instance::CreateInstancePayload;
use crate::domain::manifest::*;
use crate::error::AppResult;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

pub fn build_and_save_manifest(
    payload: &CreateInstancePayload,
    global_mc_root: &PathBuf,
    instance_root: &PathBuf,
) -> AppResult<()> {
    let vanilla_path = global_mc_root
        .join("versions")
        .join(&payload.game_version)
        .join(format!("{}.json", payload.game_version));
        
    let vanilla_content = fs::read_to_string(&vanilla_path).unwrap_or_else(|_| "{}".to_string());
    let vanilla_json: Value = serde_json::from_str(&vanilla_content).unwrap_or(serde_json::json!({}));

    let mut loader_json: Option<Value> = None;
    let loader_type = payload.loader_type.to_lowercase();
    if loader_type != "vanilla" && !loader_type.is_empty() {
        let loader_version = payload.loader_version.clone().unwrap_or_default();
        let loader_version_dir_name = match loader_type.as_str() {
            "fabric" => Some(format!("fabric-loader-{}-{}", loader_version, payload.game_version)),
            "forge" => Some(format!("{}-forge-{}", payload.game_version, loader_version)),
            "neoforge" => Some(format!("neoforge-{}", loader_version)),
            _ => None,
        };
        if let Some(dir_name) = loader_version_dir_name {
            let loader_path = global_mc_root
                .join("versions")
                .join(&dir_name)
                .join(format!("{}.json", dir_name));
            if loader_path.exists() {
                let text = fs::read_to_string(&loader_path).unwrap_or_else(|_| "{}".to_string());
                loader_json = Some(serde_json::from_str(&text).unwrap_or(serde_json::json!({})));
            }
        }
    }

    let main_class = loader_json
        .as_ref()
        .and_then(|j| j.get("mainClass").and_then(|v| v.as_str()))
        .or_else(|| vanilla_json.get("mainClass").and_then(|v| v.as_str()))
        .unwrap_or("net.minecraft.client.main.Main")
        .to_string();

    let asset_index = vanilla_json.get("assetIndex").cloned().unwrap_or(serde_json::json!({}));
    
    let java_major = vanilla_json.get("javaVersion")
        .and_then(|j| j.get("majorVersion"))
        .and_then(|v| v.as_u64())
        .map(|v| v.to_string())
        .unwrap_or_else(|| "8".to_string());
        
    let java_component = vanilla_json.get("javaVersion")
        .and_then(|j| j.get("component"))
        .and_then(|v| v.as_str())
        .unwrap_or("jre-legacy")
        .to_string();

    let client_dl = vanilla_json.get("downloads")
        .and_then(|d| d.get("client"))
        .map(|obj| DownloadFile {
            url: obj.get("url").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            sha1: obj.get("sha1").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            size: obj.get("size").and_then(|v| v.as_u64()).unwrap_or(0),
        });

    let manifest = InstanceManifest {
        version_info: VersionInfo {
            id: payload.folder_name.clone(),
            r#type: "custom".to_string(),
            main_class,
        },
        launch_control: LaunchControl {
            game_args: vec![],
            jvm_args: vec![],
            window: WindowSettings {
                width: 1280,
                height: 720,
                fullscreen: false,
            },
            quick_play: None,
            demo: false,
        },
        conditions: vec![],
        downloads: DownloadSystem {
            client: client_dl,
            client_mappings: None,
            server: None,
            server_mappings: None,
        },
        libraries: vec![],
        resources: ResourceIndexRef {
            id: asset_index["id"].as_str().unwrap_or("").to_string(),
            sha1: asset_index["sha1"].as_str().unwrap_or("").to_string(),
            size: asset_index["size"].as_u64().unwrap_or(0),
            url: asset_index["url"].as_str().unwrap_or("").to_string(),
            total_size: asset_index["totalSize"].as_u64().unwrap_or(0),
        },
        java_env: JavaEnvironment {
            path: "auto".to_string(),
            version: java_major,
            component: Some(java_component),
        },
        mods: vec![],
    };

    let manifest_path = instance_root.join("instance_manifest.json");
    if let Err(e) = fs::write(&manifest_path, serde_json::to_string_pretty(&manifest).unwrap()) {
        eprintln!("[Manifest Builder] CRITICAL ERROR writing manifest to {:?}: {}", manifest_path, e);
        return Err(e.into());
    } else {
        println!("[Manifest Builder] Successfully wrote manifest to {:?}", manifest_path);
    }

    Ok(())
}
