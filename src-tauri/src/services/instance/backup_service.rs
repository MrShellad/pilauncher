// src-tauri/src/services/instance/backup_service.rs
use std::fs::{self, File};
use std::io::{self};
use std::path::{Path};
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

pub fn backup_instance_data(
    instance_root: &Path,
    backup_zip_path: &Path,
) -> Result<(), String> {
    // Ensure parent directory of backup zip path exists
    if let Some(parent) = backup_zip_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create backup dir: {}", e))?;
    }

    let file = File::create(backup_zip_path)
        .map_err(|e| format!("Failed to create backup file: {}", e))?;
    let mut zip = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    // List of files and folders to back up inside the instance root
    // Format: (relative_path_in_instance, prefix_in_zip)
    let targets = vec![
        ("saves", "saves"),
        ("config", "config"),
        ("options.txt", "options.txt"),
        ("servers.dat", "servers.dat"),
        ("optionsof.txt", "optionsof.txt"),
    ];

    for (rel_path, zip_prefix) in targets {
        let full_path = instance_root.join(rel_path);
        if !full_path.exists() {
            continue;
        }

        if full_path.is_dir() {
            for entry in WalkDir::new(&full_path)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                let path = entry.path();
                let strip_rel = match path.strip_prefix(&full_path) {
                    Ok(p) => p,
                    Err(_) => continue,
                };

                let zip_path_str = if strip_rel.as_os_str().is_empty() {
                    zip_prefix.to_string()
                } else {
                    format!("{}/{}", zip_prefix, strip_rel.to_string_lossy().replace('\\', "/"))
                };

                if entry.file_type().is_dir() {
                    zip.add_directory(format!("{}/", zip_path_str.trim_end_matches('/')), options)
                        .map_err(|e| format!("Failed to add directory to zip: {}", e))?;
                } else if entry.file_type().is_file() {
                    zip.start_file(&zip_path_str, options)
                        .map_err(|e| format!("Failed to start file in zip: {}", e))?;
                    let mut src_file = File::open(path)
                        .map_err(|e| format!("Failed to open src file: {}", e))?;
                    io::copy(&mut src_file, &mut zip)
                        .map_err(|e| format!("Failed to copy file content to zip: {}", e))?;
                }
            }
        } else if full_path.is_file() {
            zip.start_file(zip_prefix, options)
                .map_err(|e| format!("Failed to start file in zip: {}", e))?;
            let mut src_file = File::open(&full_path)
                .map_err(|e| format!("Failed to open src file: {}", e))?;
            io::copy(&mut src_file, &mut zip)
                .map_err(|e| format!("Failed to copy file content to zip: {}", e))?;
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;
    Ok(())
}

pub fn restore_backup_data(
    instance_root: &Path,
    backup_zip_path: &Path,
) -> Result<(), String> {
    if !backup_zip_path.exists() {
        return Err("Backup file does not exist".to_string());
    }

    let file = File::open(backup_zip_path)
        .map_err(|e| format!("Failed to open backup zip: {}", e))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("Failed to read backup zip: {}", e))?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i)
            .map_err(|e| format!("Failed to read entry from backup zip: {}", e))?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => path.to_owned(),
            None => continue,
        };

        let final_path = instance_root.join(&outpath);

        if file.name().ends_with('/') {
            fs::create_dir_all(&final_path)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        } else {
            if let Some(p) = final_path.parent() {
                fs::create_dir_all(p)
                    .map_err(|e| format!("Failed to create parent directory: {}", e))?;
            }
            let mut outfile = fs::File::create(&final_path)
                .map_err(|e| format!("Failed to create file: {}", e))?;
            io::copy(&mut file, &mut outfile)
                .map_err(|e| format!("Failed to copy file: {}", e))?;
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_backup_and_restore() {
        let system_temp = std::env::temp_dir();
        let unique_id = uuid::Uuid::new_v4().to_string();
        let temp_dir = system_temp.join(format!("pilauncher-test-{}", unique_id));
        fs::create_dir_all(&temp_dir).unwrap();

        let instance_root = temp_dir.join("instance");
        let backup_zip = temp_dir.join("backup.zip");

        // 1. Create dummy instance structure
        fs::create_dir_all(instance_root.join("saves/world1")).unwrap();
        fs::create_dir_all(instance_root.join("config")).unwrap();
        fs::write(instance_root.join("saves/world1/level.dat"), "world-data").unwrap();
        fs::write(instance_root.join("config/general.cfg"), "config-data").unwrap();
        fs::write(instance_root.join("options.txt"), "options-data").unwrap();

        // 2. Perform backup
        backup_instance_data(&instance_root, &backup_zip).unwrap();
        assert!(backup_zip.exists());

        // 3. Clear some data to simulate upgrade changes
        fs::remove_file(instance_root.join("options.txt")).unwrap();
        fs::write(instance_root.join("config/general.cfg"), "new-config-data").unwrap();

        // 4. Perform restore
        restore_backup_data(&instance_root, &backup_zip).unwrap();

        // 5. Assertions
        assert_eq!(
            fs::read_to_string(instance_root.join("options.txt")).unwrap(),
            "options-data"
        );
        assert_eq!(
            fs::read_to_string(instance_root.join("config/general.cfg")).unwrap(),
            "config-data"
        );
        assert_eq!(
            fs::read_to_string(instance_root.join("saves/world1/level.dat")).unwrap(),
            "world-data"
        );

        // Clean up
        let _ = fs::remove_dir_all(temp_dir);
    }
}

