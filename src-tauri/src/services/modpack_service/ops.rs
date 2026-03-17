use crate::domain::instance::InstanceConfig;
use crate::domain::modpack::ModpackMetadata;
use crate::services::config_service::ConfigService;
use std::fs::{self, File};
use std::io::{Read, Seek};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use zip::ZipArchive;

use super::logic::{
    parse_curseforge_metadata, parse_modrinth_metadata, ModpackSourceHint,
};

pub fn resolve_base_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let base_path_str = ConfigService::get_base_path(app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Base path is not configured".to_string())?;
    Ok(PathBuf::from(base_path_str))
}

pub fn open_modpack_archive(path: &str) -> Result<ZipArchive<File>, String> {
    let file = File::open(path).map_err(|e| format!("Failed to open file: {}", e))?;
    ZipArchive::new(file).map_err(|e| format!("Failed to read zip: {}", e))
}

pub fn read_zip_entry_to_string<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
    name: &str,
) -> Result<String, String> {
    let mut file = archive
        .by_name(name)
        .map_err(|e| format!("Entry not found {}: {}", name, e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .map_err(|e| e.to_string())?;
    Ok(contents)
}

pub fn detect_modpack_source<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<ModpackSourceHint, String> {
    if archive.by_name("modrinth.index.json").is_ok() {
        return Ok(ModpackSourceHint::Modrinth);
    }
    if archive.by_name("manifest.json").is_ok() {
        return Ok(ModpackSourceHint::CurseForge);
    }
    Err("Unsupported modpack: missing modrinth.index.json and manifest.json".to_string())
}

pub fn parse_modpack(path: &str) -> Result<ModpackMetadata, String> {
    let mut archive = open_modpack_archive(path)?;
    match detect_modpack_source(&mut archive)? {
        ModpackSourceHint::Modrinth => {
            let contents = read_zip_entry_to_string(&mut archive, "modrinth.index.json")?;
            parse_modrinth_metadata(&contents)
        }
        ModpackSourceHint::CurseForge => {
            let contents = read_zip_entry_to_string(&mut archive, "manifest.json")?;
            parse_curseforge_metadata(&contents)
        }
    }
}

pub fn create_instance_layout(instance_root: &Path) -> Result<(), String> {
    let sub_dirs = [
        "mods",
        "config",
        "saves",
        "resourcepacks",
        "screenshots",
        "piconfig",
    ];
    for dir in sub_dirs {
        fs::create_dir_all(instance_root.join(dir)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn write_instance_config(instance_root: &Path, config: &InstanceConfig) -> Result<(), String> {
    fs::write(
        instance_root.join("instance.json"),
        serde_json::to_string_pretty(config).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())
}

pub fn extract_overrides(zip_path: &str, target_dir: &Path) -> Result<(), String> {
    let file = File::open(zip_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(file).map_err(|e| e.to_string())?;

    let override_prefixes = resolve_override_prefixes(&mut archive)?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let Some(relative_path) = override_prefixes
            .iter()
            .find_map(|prefix| outpath.strip_prefix(prefix).ok())
        else {
            continue;
        };

        if relative_path.as_os_str().is_empty() {
            continue;
        }

        let final_path = target_dir.join(relative_path);

        if file.is_dir() {
            fs::create_dir_all(&final_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = final_path.parent() {
                fs::create_dir_all(p).map_err(|e| e.to_string())?;
            }
            let mut outfile = File::create(&final_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn resolve_override_prefixes<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<PathBuf>, String> {
    if let Ok(mut manifest_file) = archive.by_name("manifest.json") {
        let mut contents = String::new();
        manifest_file
            .read_to_string(&mut contents)
            .map_err(|e| e.to_string())?;

        let json: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;
        let declared = json["overrides"].as_str().unwrap_or("overrides");
        return Ok(vec![normalize_override_prefix(declared)]);
    }

    if archive.by_name("modrinth.index.json").is_ok() {
        return Ok(vec![
            normalize_override_prefix("overrides"),
            normalize_override_prefix("client-overrides"),
        ]);
    }

    Ok(vec![normalize_override_prefix("overrides")])
}

fn normalize_override_prefix(prefix: &str) -> PathBuf {
    let trimmed = prefix.trim_matches('/').trim_matches('\\');
    if trimmed.is_empty() {
        PathBuf::new()
    } else {
        PathBuf::from(trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::extract_overrides;
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::Path;
    use uuid::Uuid;
    use zip::write::SimpleFileOptions;
    use zip::{CompressionMethod, ZipWriter};

    #[test]
    fn extracts_declared_curseforge_override_directory() {
        let temp_root = create_temp_dir("cf_overrides");
        let zip_path = temp_root.join("pack.zip");
        let instance_dir = temp_root.join("instance");

        write_zip(
            &zip_path,
            &[
                (
                    "manifest.json",
                    r#"{"name":"Pack","minecraft":{"version":"1.20.1","modLoaders":[]},"overrides":"my-overrides"}"#,
                ),
                ("my-overrides/config/settings.txt", "ok"),
            ],
        );

        fs::create_dir_all(&instance_dir).unwrap();
        extract_overrides(zip_path.to_str().unwrap(), &instance_dir).unwrap();

        assert_eq!(
            fs::read_to_string(instance_dir.join("config/settings.txt")).unwrap(),
            "ok"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    #[test]
    fn extracts_modrinth_client_and_standard_overrides() {
        let temp_root = create_temp_dir("mrpack_overrides");
        let zip_path = temp_root.join("pack.mrpack");
        let instance_dir = temp_root.join("instance");

        write_zip(
            &zip_path,
            &[
                (
                    "modrinth.index.json",
                    r#"{"files":[],"dependencies":{"minecraft":"1.20.1"}}"#,
                ),
                ("client-overrides/options.txt", "graphics=fancy"),
                ("overrides/resourcepacks/demo.txt", "enabled"),
            ],
        );

        fs::create_dir_all(&instance_dir).unwrap();
        extract_overrides(zip_path.to_str().unwrap(), &instance_dir).unwrap();

        assert_eq!(
            fs::read_to_string(instance_dir.join("options.txt")).unwrap(),
            "graphics=fancy"
        );
        assert_eq!(
            fs::read_to_string(instance_dir.join("resourcepacks/demo.txt")).unwrap(),
            "enabled"
        );

        let _ = fs::remove_dir_all(temp_root);
    }

    fn create_temp_dir(prefix: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("{}_{}", prefix, Uuid::new_v4()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_zip(zip_path: &Path, entries: &[(&str, &str)]) {
        let file = File::create(zip_path).unwrap();
        let mut zip = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

        for (name, contents) in entries {
            zip.start_file(name, options).unwrap();
            zip.write_all(contents.as_bytes()).unwrap();
        }

        zip.finish().unwrap();
    }
}
