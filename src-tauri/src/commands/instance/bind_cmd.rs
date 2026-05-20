use crate::domain::instance::{InstanceBindingState, ServerBinding};
use crate::error::{AppError, AppResult};
use crate::services::db_service::AppDatabase;
use crate::services::instance::binding::InstanceBindingService;
use tauri::{AppHandle, Runtime, State};

#[tauri::command]
pub async fn bind_server_to_instance<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    instance_id: String,
    server_binding: ServerBinding,
) -> AppResult<InstanceBindingState> {
    let mut config =
        InstanceBindingService::upsert_instance_from_disk(&app, &db.pool, &instance_id).await?;

    let canonical_binding = InstanceBindingService::replace_binding_for_instance(
        &db.pool,
        &instance_id,
        &server_binding,
        true,
    )
    .await?;

    config.server_binding = Some(canonical_binding);
    config.auto_join_server = Some(true);
    InstanceBindingService::write_instance_config(&app, &instance_id, &config)
        .map_err(AppError::Generic)?;

    InstanceBindingService::get_instance_binding_state(&app, &db.pool, &instance_id).await
}

#[tauri::command]
pub async fn get_server_bindings<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
) -> AppResult<std::collections::HashMap<String, ServerBinding>> {
    InstanceBindingService::get_server_bindings(&app, &db.pool).await
}

#[tauri::command]
pub async fn get_instance_server_binding<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    id: String,
) -> AppResult<InstanceBindingState> {
    InstanceBindingService::get_instance_binding_state(&app, &db.pool, &id).await
}

#[tauri::command]
pub async fn find_bound_instance_for_server<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    server_binding: ServerBinding,
) -> AppResult<Option<String>> {
    InstanceBindingService::find_bound_instance_for_server(&app, &db.pool, &server_binding).await
}
