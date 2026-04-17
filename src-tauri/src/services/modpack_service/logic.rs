use crate::domain::instance::{
    InstanceConfig, JavaConfig, LoaderConfig, MemoryConfig, ResolutionConfig,
};
use crate::domain::modpack::{
    ModpackMetadata, PiPackManifest, PIPACK_FORMAT_VERSION, PIPACK_OVERRIDES_DIR,
};
use chrono::Local;
use std::path::{Component, Path, PathBuf};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ModpackSourceHint {
    Modrinth,
    CurseForge,
    PiPack,
}

pub const CURSEFORGE_CLASS_MOD: u64 = 6;
pub const CURSEFORGE_CLASS_RESOURCE_PACK: u64 = 12;
pub const CURSEFORGE_CLASS_WORLD: u64 = 17;
pub const CURSEFORGE_CLASS_CUSTOMIZATION: u64 = 4546;
pub const CURSEFORGE_CLASS_SHADER: u64 = 6552;
pub const CURSEFORGE_CLASS_DATA_PACK: u64 = 6945;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CurseForgeInstallTarget {
    Mod,
    ResourcePack,
    ShaderPack,
    DataPack,
    World,
}

impl CurseForgeInstallTarget {
    pub fn folder_name(self) -> &'static str {
        match self {
            Self::Mod => "mods",
            Self::ResourcePack => "resourcepacks",
            Self::ShaderPack => "shaderpacks",
            Self::DataPack => "datapacks",
            Self::World => "saves",
        }
    }
}

pub fn resolve_curseforge_install_target(class_id: Option<u64>) -> CurseForgeInstallTarget {
    match class_id {
        Some(CURSEFORGE_CLASS_MOD) => CurseForgeInstallTarget::Mod,
        Some(CURSEFORGE_CLASS_RESOURCE_PACK) => CurseForgeInstallTarget::ResourcePack,
        Some(CURSEFORGE_CLASS_SHADER) => CurseForgeInstallTarget::ShaderPack,
        // Older packs may still reference datapacks through the legacy customization class.
        Some(CURSEFORGE_CLASS_DATA_PACK) | Some(CURSEFORGE_CLASS_CUSTOMIZATION) => {
            CurseForgeInstallTarget::DataPack
        }
        Some(CURSEFORGE_CLASS_WORLD) => CurseForgeInstallTarget::World,
        _ => CurseForgeInstallTarget::Mod,
    }
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
        hero_logo: None,
        gamepad: None,
        custom_buttons: None,
        third_party_path: None,
        server_binding: None,
        auto_join_server: None,
        tags: None,
        jvm_args: None,
        window_width: None,
        window_height: None,
        is_favorite: None,
    }
}

pub fn parse_curseforge_metadata(contents: &str) -> Result<ModpackMetadata, String> {
    let json: serde_json::Value =
        serde_json::from_str(contents).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let name = json["name"].as_str().unwrap_or("Unnamed Pack").to_string();
    let author = json["author"]
        .as_str()
        .unwrap_or("Unknown Author")
        .to_string();
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
        pack_version: None,
        packaged_at: None,
        pack_uuid: None,
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
        pack_version: None,
        packaged_at: None,
        pack_uuid: None,
    })
}

pub fn parse_pipack_metadata(contents: &str) -> Result<ModpackMetadata, String> {
    let manifest: PiPackManifest = serde_json::from_str(contents)
        .map_err(|e| format!("Failed to parse PiPack manifest: {}", e))?;

    if manifest.format_version != PIPACK_FORMAT_VERSION {
        return Err(format!(
            "Unsupported PiPack format version: {}",
            manifest.format_version
        ));
    }

    Ok(ModpackMetadata {
        name: manifest.package.name,
        version: manifest.minecraft.version,
        loader: manifest.minecraft.loader,
        loader_version: manifest.minecraft.loader_version,
        author: manifest.package.author,
        source: "PiPack".to_string(),
        pack_version: Some(manifest.package.version),
        packaged_at: Some(manifest.package.packaged_at),
        pack_uuid: Some(manifest.package.uuid),
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

pub fn normalize_override_dir(value: Option<&str>) -> String {
    let trimmed = value
        .unwrap_or(PIPACK_OVERRIDES_DIR)
        .trim_matches('/')
        .trim_matches('\\');

    if trimmed.is_empty() {
        PIPACK_OVERRIDES_DIR.to_string()
    } else {
        trimmed.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::{
        normalize_override_dir, parse_pipack_metadata, resolve_curseforge_install_target,
        CurseForgeInstallTarget, CURSEFORGE_CLASS_CUSTOMIZATION, CURSEFORGE_CLASS_DATA_PACK,
        CURSEFORGE_CLASS_MOD, CURSEFORGE_CLASS_RESOURCE_PACK, CURSEFORGE_CLASS_SHADER,
        CURSEFORGE_CLASS_WORLD,
    };

    #[test]
    fn parses_pipack_metadata() {
        let metadata = parse_pipack_metadata(
            r#"{
                "formatVersion": 1,
                "package": {
                    "name": "Demo Pack",
                    "version": "2.3.4",
                    "author": "Pi",
                    "description": "Demo",
                    "uuid": "11111111-1111-1111-1111-111111111111",
                    "packagedAt": "2026-04-06T12:00:00Z"
                },
                "minecraft": {
                    "version": "1.20.1",
                    "loader": "Forge",
                    "loaderVersion": "47.4.18",
                    "instanceId": "demo_pack",
                    "instanceName": "Demo Pack"
                },
                "overrides": "overrides",
                "mods": []
            }"#,
        )
        .unwrap();

        assert_eq!(metadata.name, "Demo Pack");
        assert_eq!(metadata.version, "1.20.1");
        assert_eq!(metadata.loader, "Forge");
        assert_eq!(metadata.pack_version.as_deref(), Some("2.3.4"));
        assert_eq!(
            metadata.pack_uuid.as_deref(),
            Some("11111111-1111-1111-1111-111111111111")
        );
    }

    #[test]
    fn normalizes_empty_override_dir() {
        assert_eq!(normalize_override_dir(Some("")), "overrides");
        assert_eq!(normalize_override_dir(Some("/custom/")), "custom");
    }

    #[test]
    fn maps_curseforge_classes_to_expected_install_targets() {
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_RESOURCE_PACK)),
            CurseForgeInstallTarget::ResourcePack
        );
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_SHADER)),
            CurseForgeInstallTarget::ShaderPack
        );
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_DATA_PACK)),
            CurseForgeInstallTarget::DataPack
        );
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_CUSTOMIZATION)),
            CurseForgeInstallTarget::DataPack
        );
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_WORLD)),
            CurseForgeInstallTarget::World
        );
        assert_eq!(
            resolve_curseforge_install_target(Some(CURSEFORGE_CLASS_MOD)),
            CurseForgeInstallTarget::Mod
        );
        assert_eq!(
            resolve_curseforge_install_target(None),
            CurseForgeInstallTarget::Mod
        );
    }
}
