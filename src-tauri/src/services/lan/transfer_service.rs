// src-tauri/src/services/lan/transfer_service.rs
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
// ✅ 核心修复：针对 zip v8.x 引入 SimpleFileOptions
use reqwest::Client;
use std::fs;
use walkdir::WalkDir;
use zip::write::SimpleFileOptions;

// 将指定目录打包为 ZIP
pub fn zip_dir(src_dir: &Path, dst_file: &Path) -> Result<(), String> {
    let file = File::create(dst_file).map_err(|e| format!("创建Zip失败: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    // ✅ 核心修复：使用 SimpleFileOptions，避免泛型推导错误
    let options = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let prefix_path = src_dir.parent().unwrap_or(src_dir);
    for entry in WalkDir::new(src_dir).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.strip_prefix(prefix_path).unwrap();

        if path.is_file() {
            zip.start_file(name.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
            let mut f = File::open(path).unwrap();
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).unwrap();
            zip.write_all(&*buffer).map_err(|e| e.to_string())?;
        } else if !name.as_os_str().is_empty() {
            zip.add_directory(name.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

// 解压 ZIP 到指定目录
pub fn unzip_file(src_file: &Path, dst_dir: &Path) -> Result<(), String> {
    let file = File::open(src_file).map_err(|e| format!("打开Zip失败: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

    for i in 0..archive.len() {
        let mut file = archive.by_index(i).unwrap();
        let outpath = match file.enclosed_name() {
            Some(path) => dst_dir.join(path),
            None => continue,
        };

        if (*file.name()).ends_with('/') {
            fs::create_dir_all(&outpath).unwrap();
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(&p).unwrap();
                }
            }
            let mut outfile = File::create(&outpath).unwrap();
            std::io::copy(&mut file, &mut outfile).unwrap();
        }
    }
    Ok(())
}

// 发送打包好的文件到对方的 HTTP 接口
pub async fn send_zip_to_device(
    target_ip: &str,
    target_port: u16,
    zip_path: &Path,
    transfer_type: &str,
    item_name: &str,
    my_device_name: &str,
) -> Result<(), String> {
    let client = Client::new();
    let url = format!("http://{}:{}/api/transfer/receive", target_ip, target_port);

    // 读取文件准备发送
    let file_data = fs::read(zip_path).map_err(|e| format!("读取临时ZIP失败: {}", e))?;

    let res = client
        .post(&url)
        .header("X-Transfer-Type", transfer_type)
        .header("X-Transfer-Name", item_name)
        .header("X-Device-Name", my_device_name)
        .body(file_data)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status().is_success() {
        Ok(())
    } else {
        Err(format!("对方拒绝或接收失败: {}", res.status()))
    }
}
