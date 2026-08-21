// src-tauri/src/commands/config_cmd.rs
use crate::services::config_service::ConfigService;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Runtime};
use walkdir::WalkDir;

/// Copies source-only files into the target tree without replacing or deleting
/// anything already present in the target. This is deliberately conservative:
/// a directory migration must never make an existing data directory less safe.
fn merge_directory_preserving_target(source: &Path, target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| format!("创建目标目录失败: {error}"))?;

    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|error| format!("读取源目录失败: {error}"))?;
        let relative_path = entry
            .path()
            .strip_prefix(source)
            .map_err(|error| format!("计算迁移相对路径失败: {error}"))?;
        let target_path = target.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path)
                .map_err(|error| format!("创建目标子目录失败: {error}"))?;
        } else if entry.file_type().is_file() && !target_path.exists() {
            if let Some(parent) = target_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|error| format!("创建目标文件目录失败: {error}"))?;
            }
            fs::copy(entry.path(), &target_path)
                .map_err(|error| format!("复制数据文件失败: {error}"))?;
        }
    }

    Ok(())
}

fn paths_refer_to_same_or_nested_directory(source: &Path, target: &Path) -> bool {
    if source == target || target.starts_with(source) || source.starts_with(target) {
        return true;
    }

    match (source.canonicalize(), target.canonicalize()) {
        (Ok(source), Ok(target)) => {
            source == target || target.starts_with(&source) || source.starts_with(&target)
        }
        _ => false,
    }
}

#[tauri::command]
pub fn get_base_directory<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    ConfigService::get_base_path(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_base_directory<R: Runtime>(app: AppHandle<R>, path: String) -> Result<(), String> {
    ConfigService::set_base_path(&app, &path)
}

#[tauri::command]
pub fn rename_base_directory<R: Runtime>(
    app: AppHandle<R>,
    new_name: String,
) -> Result<(), String> {
    let old_path_opt = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?;

    if let Some(old_path_str) = old_path_opt {
        let old_path = Path::new(&old_path_str);
        if let Some(parent) = old_path.parent() {
            let new_path = parent.join(&new_name);

            if new_path.exists() {
                return Err("目标文件夹名已存在".to_string());
            }

            fs::rename(&old_path, &new_path).map_err(|e| format!("重命名失败: {}", e))?;

            let new_path_str = new_path.to_string_lossy().to_string();
            ConfigService::set_base_path(&app, &new_path_str)?;

            return Ok(());
        }
    }

    Err("无法获取当前数据目录".to_string())
}

#[tauri::command]
pub fn migrate_base_directory<R: Runtime>(
    app: AppHandle<R>,
    new_path: String,
    move_data: bool,
) -> Result<(), String> {
    let old_path_opt = ConfigService::get_base_path(&app).map_err(|e| e.to_string())?;

    if let Some(old_path_str) = old_path_opt {
        if old_path_str == new_path {
            return Ok(());
        }

        let old_path = Path::new(&old_path_str);
        let new_path_obj = Path::new(&new_path);

        if paths_refer_to_same_or_nested_directory(old_path, new_path_obj) {
            return Err("新数据目录不能与当前目录相同，也不能互为父子目录".to_string());
        }

        let old_settings = old_path.join("config").join("settings.json");
        let new_settings = new_path_obj.join("config").join("settings.json");

        if move_data {
            // Merge every managed data folder (instances, runtime, config,
            // backups, etc.). Existing target files always win; source files
            // remain untouched so a failed or conflicting migration is recoverable.
            merge_directory_preserving_target(old_path, new_path_obj)?;
        }

        if old_settings.exists() && !new_settings.exists() {
            if let Some(parent) = new_settings.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            fs::copy(&old_settings, &new_settings)
                .map_err(|error| format!("复制基础设置失败: {error}"))?;
        }
    }

    // Change the active directory only after the non-destructive merge succeeds.
    ConfigService::set_base_path(&app, &new_path)
}

#[cfg(test)]
mod tests {
    use super::merge_directory_preserving_target;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn merge_preserves_existing_target_data_and_keeps_source_recoverable() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("pilauncher-migration-{unique}"));
        let source = root.join("source");
        let target = root.join("target");

        fs::create_dir_all(source.join("instances")).unwrap();
        fs::create_dir_all(target.join("instances")).unwrap();
        fs::write(source.join("instances").join("existing.txt"), "source").unwrap();
        fs::write(source.join("instances").join("source-only.txt"), "copied").unwrap();
        fs::write(target.join("instances").join("existing.txt"), "target").unwrap();

        merge_directory_preserving_target(&source, &target).unwrap();

        assert_eq!(
            fs::read_to_string(target.join("instances").join("existing.txt")).unwrap(),
            "target"
        );
        assert_eq!(
            fs::read_to_string(target.join("instances").join("source-only.txt")).unwrap(),
            "copied"
        );
        assert_eq!(
            fs::read_to_string(source.join("instances").join("existing.txt")).unwrap(),
            "source"
        );

        fs::remove_dir_all(root).unwrap();
    }
}

/// 将当前选中的实例 ID 持久化到 base_path/config/selected_instance.json
#[tauri::command]
pub fn save_selected_instance<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<(), String> {
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(p)) => p,
        _ => return Ok(()), // 未配置基础路径时静默忽略
    };
    let config_dir = PathBuf::from(base_path_str).join("config");
    if !config_dir.exists() {
        fs::create_dir_all(&config_dir).map_err(|e| e.to_string())?;
    }
    let file_path = config_dir.join("selected_instance.json");
    let content =
        serde_json::to_string_pretty(&serde_json::json!({ "selectedInstanceId": instance_id }))
            .map_err(|e| e.to_string())?;
    fs::write(file_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

/// 从 base_path/config/selected_instance.json 读取上次选中的实例 ID
#[tauri::command]
pub fn load_selected_instance<R: Runtime>(app: AppHandle<R>) -> Result<Option<String>, String> {
    let base_path_str = match ConfigService::get_base_path(&app) {
        Ok(Some(p)) => p,
        _ => return Ok(None),
    };
    let file_path = PathBuf::from(base_path_str)
        .join("config")
        .join("selected_instance.json");
    if !file_path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&file_path).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).unwrap_or(serde_json::json!({}));
    Ok(json["selectedInstanceId"].as_str().map(|s| s.to_string()))
}
