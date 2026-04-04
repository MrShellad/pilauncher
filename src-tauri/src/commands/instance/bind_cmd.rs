// src-tauri/src/commands/instance/bind_cmd.rs
use crate::error::AppResult;
use crate::domain::instance::{InstanceConfig, ServerBinding};
use crate::services::config_service::ConfigService;
use tauri::{AppHandle, Runtime};
use std::path::PathBuf;
use std::fs;

#[tauri::command]
pub async fn bind_server_to_instance<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
    server_binding: ServerBinding,
) -> AppResult<()> {
    let base_path_str = ConfigService::get_base_path(&app)?
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未配置数据目录"))?;
    
    let base_dir = PathBuf::from(&base_path_str);
    let instances_dir = base_dir.join("instances");
    let instance_dir = instances_dir.join(&instance_id);
    let config_path = instance_dir.join("instance.json");

    if !config_path.exists() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            format!("找不到实例配置文件: {}", config_path.display())
        ).into());
    }

    // 1. Update instance.json
    let content = fs::read_to_string(&config_path)?;
    let mut config: InstanceConfig = serde_json::from_str(&content)?;
    
    config.server_binding = Some(server_binding.clone());
    
    let new_content = serde_json::to_string_pretty(&config)?;
    fs::write(&config_path, new_content)?;

    // 2. Update server_bindings.json index
    let bindings_index_path = instances_dir.join("server_bindings.json");
    
    let mut all_bindings: serde_json::Value = if bindings_index_path.exists() {
        let idx_content = fs::read_to_string(&bindings_index_path).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&idx_content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    if let Some(obj) = all_bindings.as_object_mut() {
        let binding_val = serde_json::to_value(&server_binding)?;
        obj.insert(instance_id, binding_val);
    }

    let updated_index = serde_json::to_string_pretty(&all_bindings)?;
    fs::write(&bindings_index_path, updated_index)?;

    Ok(())
}

#[tauri::command]
pub async fn get_server_bindings<R: Runtime>(
    app: AppHandle<R>,
) -> AppResult<std::collections::HashMap<String, ServerBinding>> {
    let base_path_str = ConfigService::get_base_path(&app)?
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::NotFound, "未配置数据目录"))?;
    
    let bindings_index_path = PathBuf::from(base_path_str)
        .join("instances")
        .join("server_bindings.json");

    if !bindings_index_path.exists() {
        return Ok(std::collections::HashMap::new());
    }

    let idx_content = fs::read_to_string(&bindings_index_path)?;
    let all_bindings: std::collections::HashMap<String, ServerBinding> = serde_json::from_str(&idx_content)?;
    
    Ok(all_bindings)
}
