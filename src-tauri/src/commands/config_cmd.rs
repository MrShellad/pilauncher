// src-tauri/src/commands/config_cmd.rs
use crate::services::config_service::ConfigService;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::{self, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, Runtime};
use walkdir::WalkDir;

const MIGRATION_JOURNAL_FILE: &str = "base-directory-migration.json";
const MIN_FREE_SPACE_RESERVE_BYTES: u64 = 64 * 1024 * 1024;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BaseDirectoryMigrationStatus {
    Prepared,
    Copying,
    Verifying,
    Committed,
    Failed,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BaseDirectoryMigrationOperation {
    Merge,
    Rename,
}

fn default_migration_operation() -> BaseDirectoryMigrationOperation {
    BaseDirectoryMigrationOperation::Merge
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BaseDirectoryMigrationJournal {
    version: u32,
    #[serde(default = "default_migration_operation")]
    operation: BaseDirectoryMigrationOperation,
    old_path: String,
    new_path: String,
    move_data: bool,
    status: BaseDirectoryMigrationStatus,
    total_files: u64,
    total_bytes: u64,
    files_to_copy: u64,
    bytes_to_copy: u64,
    copied_files: u64,
    copied_bytes: u64,
    conflicts_preserved: u64,
    started_at_ms: u64,
    updated_at_ms: u64,
    error: Option<String>,
}

#[derive(Debug, Default)]
struct MigrationInspection {
    total_files: u64,
    total_bytes: u64,
    files_to_copy: u64,
    bytes_to_copy: u64,
    conflicts: u64,
}

#[derive(Debug, Default)]
struct MigrationCopyResult {
    copied_files: u64,
    copied_bytes: u64,
    conflicts: u64,
}

fn unix_time_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
        .try_into()
        .unwrap_or(u64::MAX)
}

fn migration_journal_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|path| path.join(MIGRATION_JOURNAL_FILE))
        .map_err(|error| format!("无法获取迁移状态目录: {error}"))
}

fn write_migration_journal(
    path: &Path,
    journal: &BaseDirectoryMigrationJournal,
) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "无法解析迁移状态目录".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("创建迁移状态目录失败: {error}"))?;

    let temp_path = path.with_extension("json.tmp");
    if temp_path.exists() {
        fs::remove_file(&temp_path).map_err(|error| format!("清理迁移临时状态失败: {error}"))?;
    }
    let data = serde_json::to_vec_pretty(journal)
        .map_err(|error| format!("序列化迁移状态失败: {error}"))?;
    fs::write(&temp_path, data).map_err(|error| format!("写入迁移状态失败: {error}"))?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temp_path)
        .and_then(|file| file.sync_all())
        .map_err(|error| format!("同步迁移状态失败: {error}"))?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("更新迁移状态失败: {error}"))?;
    }
    fs::rename(&temp_path, path).map_err(|error| format!("提交迁移状态失败: {error}"))
}

fn read_migration_journal(path: &Path) -> Result<Option<BaseDirectoryMigrationJournal>, String> {
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path).map_err(|error| format!("读取迁移状态失败: {error}"))?;
    serde_json::from_str(&content)
        .map(Some)
        .map_err(|error| format!("解析迁移状态失败: {error}"))
}

fn sha256_file(path: &Path) -> Result<Vec<u8>, String> {
    let mut file = fs::File::open(path)
        .map_err(|error| format!("打开校验文件失败 {}: {error}", path.display()))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 128 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("读取校验文件失败 {}: {error}", path.display()))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(hasher.finalize().to_vec())
}

fn inspect_migration(source: &Path, target: &Path) -> Result<MigrationInspection, String> {
    let mut inspection = MigrationInspection::default();
    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|error| format!("读取源目录失败: {error}"))?;
        if entry.file_type().is_symlink() {
            return Err(format!(
                "数据目录包含符号链接，无法安全自动迁移: {}",
                entry.path().display()
            ));
        }
        if !entry.file_type().is_file() {
            continue;
        }

        let relative_path = entry
            .path()
            .strip_prefix(source)
            .map_err(|error| format!("计算迁移相对路径失败: {error}"))?;
        let size = entry
            .metadata()
            .map_err(|error| format!("读取文件大小失败: {error}"))?
            .len();
        inspection.total_files = inspection.total_files.saturating_add(1);
        inspection.total_bytes = inspection.total_bytes.saturating_add(size);
        if target.join(relative_path).exists() {
            inspection.conflicts = inspection.conflicts.saturating_add(1);
        } else {
            inspection.files_to_copy = inspection.files_to_copy.saturating_add(1);
            inspection.bytes_to_copy = inspection.bytes_to_copy.saturating_add(size);
        }
    }
    Ok(inspection)
}

fn ensure_target_is_writable(target: &Path) -> Result<(), String> {
    fs::create_dir_all(target).map_err(|error| format!("创建目标目录失败: {error}"))?;
    let probe_path = target.join(format!(".pilauncher-write-probe-{}", uuid::Uuid::new_v4()));
    let mut probe = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&probe_path)
        .map_err(|error| format!("目标目录不可写: {error}"))?;
    let result = probe
        .write_all(b"PiLauncher migration write test")
        .and_then(|_| probe.sync_all())
        .map_err(|error| format!("目标目录写入测试失败: {error}"));
    drop(probe);
    let cleanup_result = fs::remove_file(&probe_path)
        .map_err(|error| format!("清理目标目录写入测试文件失败: {error}"));
    result.and(cleanup_result)
}

fn available_space_for(path: &Path) -> Option<u64> {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let disks = sysinfo::Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .filter(|disk| resolved.starts_with(disk.mount_point()))
        .max_by_key(|disk| disk.mount_point().components().count())
        .map(|disk| disk.available_space())
}

fn ensure_sufficient_space(target: &Path, bytes_to_copy: u64) -> Result<(), String> {
    let required = bytes_to_copy.saturating_add(MIN_FREE_SPACE_RESERVE_BYTES);
    if let Some(available) = available_space_for(target) {
        if available < required {
            return Err(format!(
                "目标磁盘空间不足：需要至少 {} 字节，当前可用 {} 字节",
                required, available
            ));
        }
    }
    Ok(())
}

fn copy_file_atomically(source: &Path, target: &Path) -> Result<Option<u64>, String> {
    if target.exists() {
        return Ok(None);
    }
    let parent = target
        .parent()
        .ok_or_else(|| format!("无法解析目标文件目录: {}", target.display()))?;
    fs::create_dir_all(parent).map_err(|error| format!("创建目标文件目录失败: {error}"))?;

    let file_name = target
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("data");
    let temp_path = parent.join(format!(
        ".{file_name}.pilauncher-migration-{}.tmp",
        uuid::Uuid::new_v4()
    ));
    let copied_bytes = fs::copy(source, &temp_path)
        .map_err(|error| format!("复制数据文件失败 {}: {error}", source.display()))?;
    OpenOptions::new()
        .read(true)
        .write(true)
        .open(&temp_path)
        .and_then(|file| file.sync_all())
        .map_err(|error| format!("同步迁移文件失败 {}: {error}", temp_path.display()))?;

    let source_size = fs::metadata(source)
        .map_err(|error| format!("读取源文件信息失败: {error}"))?
        .len();
    let temp_size = fs::metadata(&temp_path)
        .map_err(|error| format!("读取目标文件信息失败: {error}"))?
        .len();
    if copied_bytes != source_size
        || temp_size != source_size
        || sha256_file(source)? != sha256_file(&temp_path)?
    {
        let _ = fs::remove_file(&temp_path);
        return Err(format!("迁移文件校验失败: {}", source.display()));
    }

    if target.exists() {
        fs::remove_file(&temp_path).map_err(|error| format!("清理迁移临时文件失败: {error}"))?;
        return Ok(None);
    }
    fs::rename(&temp_path, target)
        .map_err(|error| format!("提交迁移文件失败 {}: {error}", target.display()))?;
    Ok(Some(copied_bytes))
}

/// Copies source-only files into the target tree without replacing or deleting
/// anything already present in the target. This is deliberately conservative:
/// a directory migration must never make an existing data directory less safe.
fn merge_directory_preserving_target(
    source: &Path,
    target: &Path,
) -> Result<MigrationCopyResult, String> {
    fs::create_dir_all(target).map_err(|error| format!("创建目标目录失败: {error}"))?;
    let mut result = MigrationCopyResult::default();

    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|error| format!("读取源目录失败: {error}"))?;
        if entry.file_type().is_symlink() {
            return Err(format!(
                "数据目录包含符号链接，无法安全自动迁移: {}",
                entry.path().display()
            ));
        }
        let relative_path = entry
            .path()
            .strip_prefix(source)
            .map_err(|error| format!("计算迁移相对路径失败: {error}"))?;
        let target_path = target.join(relative_path);

        if entry.file_type().is_dir() {
            fs::create_dir_all(&target_path)
                .map_err(|error| format!("创建目标子目录失败: {error}"))?;
        } else if entry.file_type().is_file() {
            match copy_file_atomically(entry.path(), &target_path)? {
                Some(bytes) => {
                    result.copied_files = result.copied_files.saturating_add(1);
                    result.copied_bytes = result.copied_bytes.saturating_add(bytes);
                }
                None => {
                    result.conflicts = result.conflicts.saturating_add(1);
                }
            }
        }
    }

    Ok(result)
}

fn verify_migration_tree(source: &Path, target: &Path) -> Result<(), String> {
    for entry in WalkDir::new(source).min_depth(1) {
        let entry = entry.map_err(|error| format!("迁移后读取源目录失败: {error}"))?;
        let relative_path = entry
            .path()
            .strip_prefix(source)
            .map_err(|error| format!("迁移后计算相对路径失败: {error}"))?;
        let target_path = target.join(relative_path);
        if entry.file_type().is_dir() && !target_path.is_dir() {
            return Err(format!("迁移后缺少目标目录: {}", target_path.display()));
        }
        if entry.file_type().is_file() && !target_path.is_file() {
            return Err(format!("迁移后缺少目标文件: {}", target_path.display()));
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
    let trimmed_name = new_name.trim();
    let requested_name = Path::new(trimmed_name);
    if trimmed_name.is_empty()
        || requested_name.components().count() != 1
        || requested_name.file_name().and_then(|name| name.to_str()) != Some(trimmed_name)
        || matches!(trimmed_name, "." | "..")
    {
        return Err("新目录名称不能包含路径分隔符或父目录引用".to_string());
    }

    let old_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "无法获取当前数据目录".to_string())?;
    let old_path = PathBuf::from(&old_path_str);
    let parent = old_path
        .parent()
        .ok_or_else(|| "当前数据目录没有可用的父目录".to_string())?;
    let new_path = parent.join(trimmed_name);
    if new_path.exists() {
        return Err("目标文件夹名已存在".to_string());
    }
    ensure_target_is_writable(parent)?;

    let journal_path = migration_journal_path(&app)?;
    let now = unix_time_ms();
    let mut journal = BaseDirectoryMigrationJournal {
        version: 1,
        operation: BaseDirectoryMigrationOperation::Rename,
        old_path: old_path.to_string_lossy().to_string(),
        new_path: new_path.to_string_lossy().to_string(),
        move_data: true,
        status: BaseDirectoryMigrationStatus::Prepared,
        total_files: 0,
        total_bytes: 0,
        files_to_copy: 0,
        bytes_to_copy: 0,
        copied_files: 0,
        copied_bytes: 0,
        conflicts_preserved: 0,
        started_at_ms: now,
        updated_at_ms: now,
        error: None,
    };
    write_migration_journal(&journal_path, &journal)?;

    fs::rename(&old_path, &new_path).map_err(|error| format!("重命名失败: {error}"))?;
    journal.status = BaseDirectoryMigrationStatus::Verifying;
    journal.updated_at_ms = unix_time_ms();

    let commit_result = write_migration_journal(&journal_path, &journal)
        .and_then(|_| ConfigService::set_base_path(&app, &journal.new_path));
    if let Err(error) = commit_result {
        let rollback_result = if !old_path.exists() && new_path.exists() {
            fs::rename(&new_path, &old_path).map_err(|rollback_error| rollback_error.to_string())
        } else {
            Ok(())
        };
        let combined_error = match rollback_result {
            Ok(()) => format!("重命名配置提交失败，已恢复原目录: {error}"),
            Err(rollback_error) => {
                format!("重命名配置提交失败且无法恢复原目录: {error}; 回滚错误: {rollback_error}")
            }
        };
        journal.status = BaseDirectoryMigrationStatus::Failed;
        journal.updated_at_ms = unix_time_ms();
        journal.error = Some(combined_error.clone());
        let _ = write_migration_journal(&journal_path, &journal);
        return Err(combined_error);
    }

    journal.status = BaseDirectoryMigrationStatus::Committed;
    journal.updated_at_ms = unix_time_ms();
    write_migration_journal(&journal_path, &journal)
}

#[tauri::command]
pub fn migrate_base_directory<R: Runtime>(
    app: AppHandle<R>,
    new_path: String,
    move_data: bool,
) -> Result<(), String> {
    let old_path_str = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "当前数据目录尚未配置".to_string())?;
    let old_path = PathBuf::from(&old_path_str);
    let new_path_obj = PathBuf::from(new_path.trim());

    if !new_path_obj.is_absolute() {
        return Err("新数据目录必须是绝对路径".to_string());
    }
    if paths_refer_to_same_or_nested_directory(&old_path, &new_path_obj) {
        return Err("新数据目录不能与当前目录相同，也不能互为父子目录".to_string());
    }
    if !old_path.is_dir() {
        return Err(format!(
            "当前数据目录不存在或不可读取: {}",
            old_path.display()
        ));
    }

    ensure_target_is_writable(&new_path_obj)?;
    let inspection = if move_data {
        inspect_migration(&old_path, &new_path_obj)?
    } else {
        MigrationInspection::default()
    };
    ensure_sufficient_space(&new_path_obj, inspection.bytes_to_copy)?;

    let journal_path = migration_journal_path(&app)?;
    let now = unix_time_ms();
    let mut journal = BaseDirectoryMigrationJournal {
        version: 1,
        operation: BaseDirectoryMigrationOperation::Merge,
        old_path: old_path.to_string_lossy().to_string(),
        new_path: new_path_obj.to_string_lossy().to_string(),
        move_data,
        status: BaseDirectoryMigrationStatus::Prepared,
        total_files: inspection.total_files,
        total_bytes: inspection.total_bytes,
        files_to_copy: inspection.files_to_copy,
        bytes_to_copy: inspection.bytes_to_copy,
        copied_files: 0,
        copied_bytes: 0,
        conflicts_preserved: inspection.conflicts,
        started_at_ms: now,
        updated_at_ms: now,
        error: None,
    };
    write_migration_journal(&journal_path, &journal)?;

    let migration_result = (|| -> Result<(), String> {
        journal.status = BaseDirectoryMigrationStatus::Copying;
        journal.updated_at_ms = unix_time_ms();
        write_migration_journal(&journal_path, &journal)?;

        if move_data {
            let copied = merge_directory_preserving_target(&old_path, &new_path_obj)?;
            journal.copied_files = copied.copied_files;
            journal.copied_bytes = copied.copied_bytes;
            journal.conflicts_preserved = copied.conflicts;
        } else {
            let old_settings = old_path.join("config").join("settings.json");
            let new_settings = new_path_obj.join("config").join("settings.json");
            if old_settings.is_file() {
                if let Some(bytes) = copy_file_atomically(&old_settings, &new_settings)? {
                    journal.copied_files = 1;
                    journal.copied_bytes = bytes;
                } else {
                    journal.conflicts_preserved = 1;
                }
            }
        }

        journal.status = BaseDirectoryMigrationStatus::Verifying;
        journal.updated_at_ms = unix_time_ms();
        write_migration_journal(&journal_path, &journal)?;
        if move_data {
            verify_migration_tree(&old_path, &new_path_obj)?;
        }

        // The active pointer is committed only after every source path has a
        // valid counterpart in the target. The source remains untouched.
        ConfigService::set_base_path(&app, &journal.new_path)?;
        Ok(())
    })();

    match migration_result {
        Ok(()) => {
            journal.status = BaseDirectoryMigrationStatus::Committed;
            journal.updated_at_ms = unix_time_ms();
            journal.error = None;
            write_migration_journal(&journal_path, &journal)
        }
        Err(error) => {
            journal.status = BaseDirectoryMigrationStatus::Failed;
            journal.updated_at_ms = unix_time_ms();
            journal.error = Some(error.clone());
            if let Err(journal_error) = write_migration_journal(&journal_path, &journal) {
                log::error!("failed to persist base directory migration failure: {journal_error}");
            }
            Err(error)
        }
    }
}

#[tauri::command]
pub fn get_base_directory_migration_status<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<BaseDirectoryMigrationJournal>, String> {
    read_migration_journal(&migration_journal_path(&app)?)
}

fn mark_journal_interrupted(journal: &mut BaseDirectoryMigrationJournal) -> bool {
    if !matches!(
        journal.status,
        BaseDirectoryMigrationStatus::Prepared
            | BaseDirectoryMigrationStatus::Copying
            | BaseDirectoryMigrationStatus::Verifying
    ) {
        return false;
    }

    journal.status = BaseDirectoryMigrationStatus::Failed;
    journal.updated_at_ms = unix_time_ms();
    journal.error =
        Some("上次数据目录迁移被应用退出中断；当前仍使用原目录，可安全重试迁移。".to_string());
    true
}

/// Marks an unfinished copy as interrupted during startup. The active base
/// directory was not switched yet, and copied target files are intentionally
/// retained so retrying the migration is idempotent and recoverable.
pub fn recover_interrupted_base_directory_migration<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<(), String> {
    let journal_path = migration_journal_path(app)?;
    let Some(mut journal) = read_migration_journal(&journal_path)? else {
        return Ok(());
    };
    if journal.operation == BaseDirectoryMigrationOperation::Rename
        && matches!(
            journal.status,
            BaseDirectoryMigrationStatus::Prepared
                | BaseDirectoryMigrationStatus::Copying
                | BaseDirectoryMigrationStatus::Verifying
        )
    {
        let old_path = Path::new(&journal.old_path);
        let new_path = Path::new(&journal.new_path);
        let active_path = ConfigService::get_base_path(app)
            .map_err(|error| error.to_string())?
            .map(PathBuf::from);

        if new_path.is_dir() && (active_path.as_deref() == Some(new_path) || !old_path.exists()) {
            ConfigService::set_base_path(app, &journal.new_path)?;
            journal.status = BaseDirectoryMigrationStatus::Committed;
            journal.updated_at_ms = unix_time_ms();
            journal.error = None;
            write_migration_journal(&journal_path, &journal)?;
            log::warn!(
                "completed interrupted base directory rename: {} -> {}",
                journal.old_path,
                journal.new_path
            );
            return Ok(());
        }
    }

    if mark_journal_interrupted(&mut journal) {
        write_migration_journal(&journal_path, &journal)?;
        log::warn!(
            "interrupted base directory migration recovered: {} -> {}",
            journal.old_path,
            journal.new_path
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        copy_file_atomically, inspect_migration, mark_journal_interrupted,
        merge_directory_preserving_target, paths_refer_to_same_or_nested_directory,
        verify_migration_tree, BaseDirectoryMigrationJournal, BaseDirectoryMigrationOperation,
        BaseDirectoryMigrationStatus,
    };
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_test_root(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("pilauncher-{label}-{unique}"))
    }

    #[test]
    fn merge_preserves_existing_target_data_and_keeps_source_recoverable() {
        let root = unique_test_root("migration");
        let source = root.join("source");
        let target = root.join("target");

        fs::create_dir_all(source.join("instances")).unwrap();
        fs::create_dir_all(target.join("instances")).unwrap();
        fs::write(source.join("instances").join("existing.txt"), "source").unwrap();
        fs::write(source.join("instances").join("source-only.txt"), "copied").unwrap();
        fs::write(target.join("instances").join("existing.txt"), "target").unwrap();

        let result = merge_directory_preserving_target(&source, &target).unwrap();

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
        assert_eq!(result.copied_files, 1);
        assert_eq!(result.conflicts, 1);
        verify_migration_tree(&source, &target).unwrap();

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn atomic_copy_never_replaces_an_existing_target() {
        let root = unique_test_root("atomic-copy");
        fs::create_dir_all(&root).unwrap();
        let source = root.join("source.txt");
        let target = root.join("target.txt");
        fs::write(&source, "source-data").unwrap();
        fs::write(&target, "target-data").unwrap();

        assert_eq!(copy_file_atomically(&source, &target).unwrap(), None);
        assert_eq!(fs::read_to_string(&target).unwrap(), "target-data");
        assert_eq!(fs::read_to_string(&source).unwrap(), "source-data");

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn inspection_counts_only_missing_files_as_required_space() {
        let root = unique_test_root("inspection");
        let source = root.join("source");
        let target = root.join("target");
        fs::create_dir_all(&source).unwrap();
        fs::create_dir_all(&target).unwrap();
        fs::write(source.join("existing.bin"), [1_u8, 2, 3]).unwrap();
        fs::write(source.join("missing.bin"), [4_u8, 5]).unwrap();
        fs::write(target.join("existing.bin"), [9_u8]).unwrap();

        let inspection = inspect_migration(&source, &target).unwrap();
        assert_eq!(inspection.total_files, 2);
        assert_eq!(inspection.total_bytes, 5);
        assert_eq!(inspection.files_to_copy, 1);
        assert_eq!(inspection.bytes_to_copy, 2);
        assert_eq!(inspection.conflicts, 1);

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_same_or_nested_migration_paths() {
        let root = unique_test_root("nested-paths");
        let child = root.join("child");
        assert!(paths_refer_to_same_or_nested_directory(&root, &root));
        assert!(paths_refer_to_same_or_nested_directory(&root, &child));
        assert!(paths_refer_to_same_or_nested_directory(&child, &root));
    }

    #[test]
    fn interrupted_copy_is_failed_without_committing_the_new_path() {
        let mut journal = BaseDirectoryMigrationJournal {
            version: 1,
            operation: BaseDirectoryMigrationOperation::Merge,
            old_path: "old".to_string(),
            new_path: "new".to_string(),
            move_data: true,
            status: BaseDirectoryMigrationStatus::Copying,
            total_files: 10,
            total_bytes: 100,
            files_to_copy: 8,
            bytes_to_copy: 80,
            copied_files: 2,
            copied_bytes: 20,
            conflicts_preserved: 2,
            started_at_ms: 1,
            updated_at_ms: 1,
            error: None,
        };

        assert!(mark_journal_interrupted(&mut journal));
        assert_eq!(journal.status, BaseDirectoryMigrationStatus::Failed);
        assert!(journal.error.as_deref().unwrap().contains("仍使用原目录"));
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
