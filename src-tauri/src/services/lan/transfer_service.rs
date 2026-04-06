use std::fs;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

pub fn zip_dir(src_dir: &Path, dst_file: &Path) -> Result<(), String> {
    zip_dir_with_progress(src_dir, dst_file, |_current, _total, _message| {})
}

pub fn zip_dir_with_progress<F>(
    src_dir: &Path,
    dst_file: &Path,
    mut on_progress: F,
) -> Result<(), String>
where
    F: FnMut(u64, u64, String),
{
    let file = File::create(dst_file).map_err(|e| format!("Create zip failed: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let prefix_path = src_dir.parent().unwrap_or(src_dir);
    let entries: Vec<_> = WalkDir::new(src_dir)
        .into_iter()
        .filter_map(|entry| entry.ok())
        .collect();
    let total = entries.len() as u64;

    for (index, entry) in entries.iter().enumerate() {
        let path = entry.path();
        let name = path.strip_prefix(prefix_path).unwrap_or(path);
        let current = index as u64 + 1;
        let display_name = name.to_string_lossy().to_string();

        if path.is_file() {
            zip.start_file(display_name.clone(), options)
                .map_err(|e| e.to_string())?;
            let mut source_file =
                File::open(path).map_err(|e| format!("Open source file failed: {}", e))?;
            let mut buffer = Vec::new();
            source_file
                .read_to_end(&mut buffer)
                .map_err(|e| format!("Read source file failed: {}", e))?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
            on_progress(current, total, format!("Packing {}", display_name));
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(display_name.clone(), options)
                .map_err(|e| e.to_string())?;
            on_progress(current, total, format!("Indexing {}", display_name));
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

pub fn unzip_file(src_file: &Path, dst_dir: &Path) -> Result<(), String> {
    let file = File::open(src_file).map_err(|e| format!("Open zip failed: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => dst_dir.join(path),
            None => continue,
        };

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                if !parent.exists() {
                    fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
            }
            let mut outfile =
                File::create(&outpath).map_err(|e| format!("Create output failed: {}", e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}
