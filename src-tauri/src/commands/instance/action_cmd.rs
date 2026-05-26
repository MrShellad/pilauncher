use crate::domain::instance::{
    CustomButtonConfig, InstanceBindingState, ServerBinding, UpdateInstanceEnvironmentPayload,
    InstanceConfig, LoaderConfig, JavaConfig, MemoryConfig, ResolutionConfig,
};
use sqlx::Row;
use crate::services::db_service::AppDatabase;
use crate::services::instance::action::InstanceActionService;
use crate::services::instance::binding::InstanceBindingService;
use crate::services::instance::environment::InstanceEnvironmentService;
use crate::services::instance::tag::InstanceTagService;
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn rename_instance<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    new_name: String,
) -> Result<(), String> {
    InstanceActionService::rename(&app, &id, &new_name)
}

#[tauri::command]
pub async fn change_instance_cover<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    image_path: String,
) -> Result<String, String> {
    InstanceActionService::change_cover(&app, &id, &image_path)
}

#[tauri::command]
pub async fn change_instance_herologo<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    image_path: String,
) -> Result<String, String> {
    InstanceActionService::change_herologo(&app, &id, &image_path)
}

#[tauri::command]
pub async fn delete_instance<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<(), String> {
    InstanceActionService::delete(&app, &id)?;
    InstanceBindingService::delete_instance_records(&db.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_imported_instances<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    dir_path: String,
) -> Result<usize, String> {
    InstanceActionService::remove_imported_by_dir(&app, &db.pool, &dir_path).await
}

#[tauri::command]
pub async fn clean_logs<R: Runtime>(app: AppHandle<R>) -> Result<usize, String> {
    use crate::services::config_service::ConfigService;
    use std::fs;
    use std::path::PathBuf;

    let base_path = ConfigService::get_base_path(&app)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "尚未配置基础数据目录".to_string())?;

    let logs_dir = PathBuf::from(base_path).join("logs");
    if !logs_dir.exists() {
        return Ok(0);
    }

    let mut removed = 0usize;
    if let Ok(entries) = fs::read_dir(&logs_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                if fs::remove_file(&path).is_ok() {
                    removed += 1;
                }
            } else if path.is_dir() {
                if fs::remove_dir_all(&path).is_ok() {
                    removed += 1;
                }
            }
        }
    }
    Ok(removed)
}

#[tauri::command]
pub async fn get_instance_detail<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
) -> Result<serde_json::Value, String> {
    // 如果 instance.json 不存在，尝试从 SQLite 数据库重建它
    if let Ok(config_path) = InstanceBindingService::instance_config_path(&app, &id) {
        if !config_path.exists() {
            if let Ok(Some(row)) = sqlx::query(
                "SELECT 
                    name, mc_version, loader_type, loader_version, java_path, 
                    min_memory, max_memory, icon_path, playtime_secs, 
                    last_played_at, created_at, jvm_args, window_width, 
                    window_height, is_favorite 
                 FROM instances 
                 WHERE id = ?"
            )
            .bind(&id)
            .fetch_optional(&db.pool)
            .await
            {
                let name: String = row.get("name");
                let mc_version: String = row.get("mc_version");
                let loader_type: String = row.get::<Option<String>, _>("loader_type").unwrap_or_else(|| "vanilla".to_string());
                let loader_version: String = row.get::<Option<String>, _>("loader_version").unwrap_or_default();
                let java_path: String = row.get::<Option<String>, _>("java_path").unwrap_or_else(|| "auto".to_string());
                let min_memory: i64 = row.get::<Option<i64>, _>("min_memory").unwrap_or(1024);
                let max_memory: i64 = row.get::<Option<i64>, _>("max_memory").unwrap_or(4096);
                let icon_path: Option<String> = row.get("icon_path");
                let playtime_secs: i64 = row.get::<Option<i64>, _>("playtime_secs").unwrap_or(0);
                let last_played_at: Option<String> = row.get("last_played_at");
                let created_at: String = row.get::<Option<String>, _>("created_at").unwrap_or_default();
                let jvm_args: Option<String> = row.get("jvm_args");
                let window_width: Option<i64> = row.get("window_width");
                let window_height: Option<i64> = row.get("window_height");
                let is_favorite: i64 = row.get::<Option<i64>, _>("is_favorite").unwrap_or(0);

                let config = InstanceConfig {
                    id: id.clone(),
                    name,
                    mc_version,
                    loader: LoaderConfig {
                        r#type: loader_type,
                        version: loader_version,
                    },
                    java: JavaConfig {
                        path: java_path,
                        version: "auto".to_string(),
                    },
                    memory: MemoryConfig {
                        min: min_memory as u32,
                        max: max_memory as u32,
                    },
                    resolution: ResolutionConfig {
                        width: 1280,
                        height: 720,
                    },
                    play_time: playtime_secs as f64 / 3600.0,
                    last_played: last_played_at.unwrap_or_else(|| "Never played".to_string()),
                    created_at,
                    cover_image: icon_path,
                    hero_logo: None,
                    gamepad: None,
                    custom_buttons: None,
                    third_party_path: None,
                    server_binding: None,
                    auto_join_server: None,
                    tags: None,
                    jvm_args,
                    window_width: window_width.map(|w| w as u32),
                    window_height: window_height.map(|h| h as u32),
                    is_favorite: Some(is_favorite != 0),
                    global_metadata_settings: None,
                };

                if let Err(e) = InstanceBindingService::write_instance_config(&app, &id, &config) {
                    eprintln!("[AutoRebuild] Failed to write reconstructed instance config: {}", e);
                } else {
                    println!("[AutoRebuild] Successfully reconstructed instance.json for {}", id);
                }
            }
        }
    }

    let mut detail = InstanceActionService::get_detail(&app, &id)?;
    let binding_state = InstanceBindingService::get_instance_binding_state(&app, &db.pool, &id)
        .await
        .map_err(|e| e.to_string())?;

    detail["server_binding"] =
        serde_json::to_value(binding_state.server_binding).map_err(|e| e.to_string())?;
    detail["auto_join_server"] = serde_json::Value::Bool(binding_state.auto_join_server);
    let tags = InstanceTagService::get_instance_tags(&db.pool, &id)
        .await
        .map_err(|e| e.to_string())?;
    detail["tags"] = serde_json::to_value(tags).map_err(|e| e.to_string())?;

    Ok(detail)
}

#[tauri::command]
pub async fn update_instance_custom_buttons<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    custom_buttons: Vec<CustomButtonConfig>,
) -> Result<(), String> {
    InstanceActionService::update_custom_buttons(&app, &id, custom_buttons)
}

#[tauri::command]
pub async fn update_instance_tags<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
    tags: Vec<String>,
) -> Result<(), String> {
    let normalized_tags = InstanceTagService::normalize_tags(&tags);

    InstanceActionService::update_tags(&app, &id, normalized_tags)?;
    let config = InstanceBindingService::load_instance_config(&app, &id)?;
    InstanceBindingService::upsert_instance(&db.pool, &config)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_instance_environment<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    payload: UpdateInstanceEnvironmentPayload,
) -> Result<(), String> {
    InstanceEnvironmentService::update(&app, &db, payload)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn check_instance_gamepad<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<bool, String> {
    crate::services::instance::mod_manager::ModManagerService::check_and_update_gamepad(&app, &id)
}

#[tauri::command]
pub async fn check_gamepad_mod_status<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    mc_version: String,
    loader_type: String,
) -> Result<crate::services::instance::mod_manager::GamepadModStatus, String> {
    crate::services::instance::mod_manager::ModManagerService::check_gamepad_mod_status(
        &app,
        &instance_id,
        &mc_version,
        &loader_type,
    )
    .await
}

#[tauri::command]
pub async fn install_remote_mod<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    download_url: String,
    file_name: String,
    mc_version: String,
    loader_type: String,
) -> Result<(), String> {
    crate::services::instance::mod_manager::ModManagerService::install_remote_mod(
        &app,
        &instance_id,
        &download_url,
        &file_name,
        &mc_version,
        &loader_type,
    )
    .await
}

#[tauri::command]
pub async fn update_instance_server_binding<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
    server_binding: Option<ServerBinding>,
) -> Result<InstanceBindingState, String> {
    let mut config = InstanceBindingService::load_instance_config(&app, &id)?;
    let auto_join = config.auto_join_server.unwrap_or(true);

    match server_binding {
        Some(binding) => {
            InstanceBindingService::upsert_instance(&db.pool, &config)
                .await
                .map_err(|e| e.to_string())?;
            let canonical_binding = InstanceBindingService::replace_binding_for_instance(
                &db.pool, &id, &binding, auto_join,
            )
            .await
            .map_err(|e| e.to_string())?;
            config.server_binding = Some(canonical_binding);
            config.auto_join_server = Some(auto_join);
        }
        None => {
            InstanceBindingService::clear_bindings_for_instance(&db.pool, &id)
                .await
                .map_err(|e| e.to_string())?;
            config.server_binding = None;
            config.auto_join_server = None;
        }
    }

    InstanceBindingService::write_instance_config(&app, &id, &config)?;
    InstanceBindingService::get_instance_binding_state(&app, &db.pool, &id)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_instance_auto_join_server<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
    auto_join: bool,
) -> Result<InstanceBindingState, String> {
    InstanceBindingService::set_instance_auto_join(&db.pool, &id, auto_join)
        .await
        .map_err(|e| e.to_string())?;

    let mut config = InstanceBindingService::load_instance_config(&app, &id)?;
    config.auto_join_server = Some(auto_join);
    InstanceBindingService::write_instance_config(&app, &id, &config)?;
    InstanceBindingService::get_instance_binding_state(&app, &db.pool, &id)
        .await
        .map_err(|e| e.to_string())
}
