use crate::domain::instance::{
    InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::domain::modpack::ModpackMetadata;
use chrono::Local;
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModpackSourceHint {
    Modrinth,
    CurseForge,
}

pub fn sanitize_instance_id(instance_name: &str) -> String {
    instance_name
        .replace(' ', "_")
        .replace('/', "")
        .replace('\\', "")
}

pub fn build_instance_config(
    instance_id: &str,
    instance_name: &str,
    metadata: &ModpackMetadata,
) -> InstanceConfig {
    InstanceConfig {
        id: instance_id.to_string(),
        name: instance_name.to_string(),
        mc_version: metadata.version.clone(),
        loader: LoaderConfig {
            r#type: metadata.loader.to_lowercase(),
            version: metadata.loader_version.clone(),
        },
        java: JavaConfig {
            path: "auto".to_string(),
            version: "auto".to_string(),
        },
        memory: MemoryConfig {
            min: 1024,
            max: 4096,
        },
        resolution: ResolutionConfig {
            width: 1280,
            height: 720,
        },
        play_time: 0.0,
        last_played: "never".to_string(),
        created_at: Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
        cover_image: None,
        gamepad: None,
    }
}

pub fn parse_curseforge_metadata(contents: &str) -> Result<ModpackMetadata, String> {
    let json: serde_json::Value =
        serde_json::from_str(contents).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let name = json["name"].as_str().unwrap_or("Unnamed Pack").to_string();
    let author = json["author"].as_str().unwrap_or("Unknown Author").to_string();
    let version = json["minecraft"]["version"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    let mut loader = String::from("Vanilla");
    let mut loader_version = String::new();

    if let Some(loaders) = json["minecraft"]["modLoaders"].as_array() {
        if let Some(primary_loader) = loaders
            .iter()
            .find(|l| l["primary"].as_bool().unwrap_or(false))
        {
            let id = primary_loader["id"].as_str().unwrap_or("");
            let parts: Vec<&str> = id.split('-').collect();
            if parts.len() == 2 {
                let mut c = parts[0].chars();
                loader = match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                };
                loader_version = parts[1].to_string();
            }
        }
    }

    Ok(ModpackMetadata {
        name,
        version,
        loader,
        loader_version,
        author,
        source: "CurseForge".to_string(),
    })
}

pub fn parse_modrinth_metadata(contents: &str) -> Result<ModpackMetadata, String> {
    let json: serde_json::Value =
        serde_json::from_str(contents).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let name = json["name"].as_str().unwrap_or("Unnamed Pack").to_string();
    let version = json["dependencies"]["minecraft"]
        .as_str()
        .unwrap_or("Unknown")
        .to_string();

    let mut loader = String::from("Vanilla");
    let mut loader_version = String::new();

    if let Some(fabric) = json["dependencies"]["fabric-loader"].as_str() {
        loader = "Fabric".to_string();
        loader_version = fabric.to_string();
    } else if let Some(forge) = json["dependencies"]["forge"].as_str() {
        loader = "Forge".to_string();
        loader_version = forge.to_string();
    } else if let Some(neoforge) = json["dependencies"]["neoforge"].as_str() {
        loader = "NeoForge".to_string();
        loader_version = neoforge.to_string();
    } else if let Some(quilt) = json["dependencies"]["quilt-loader"].as_str() {
        loader = "Quilt".to_string();
        loader_version = quilt.to_string();
    }

    Ok(ModpackMetadata {
        name,
        version,
        loader,
        loader_version,
        author: "Modrinth Creator".to_string(),
        source: "Modrinth".to_string(),
    })
}

pub fn safe_relative_path(path: &str) -> Option<PathBuf> {
    let candidate = Path::new(path);
    if candidate.as_os_str().is_empty() {
        return None;
    }
    for comp in candidate.components() {
        match comp {
            Component::Normal(_) => {}
            _ => return None,
        }
    }
    Some(candidate.to_path_buf())
}
