use crate::domain::instance::ServerBinding;
use crate::domain::modpack::{
    ImportResult, MissingRuntime, ModpackMetadata, ThirdPartyImportResult,
    ThirdPartyImportSource, VerifyInstanceRuntimeResult,
};
use crate::services::import_service::{local_instance_service, third_party_service};
use crate::services::instance::verify_service;
use crate::services::modpack_service;
use crate::services::modpack_service::export::ExportConfig;
use tauri::{AppHandle, Runtime};

#[tauri::command]
pub async fn import_local_instances_folders<R: Runtime>(
    app: AppHandle<R>,
    paths: Vec<String>,
) -> Result<ImportResult, String> {
    local_instance_service::import_local_instances_folders(&app, paths).await
}

#[tauri::command]
pub async fn import_third_party_instance<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<Option<MissingRuntime>, String> {
    third_party_service::import_single_instance(&app, path).await
}

#[tauri::command]
pub async fn verify_instance_runtime<R: Runtime>(
    app: AppHandle<R>,
    instance_id: String,
) -> Result<VerifyInstanceRuntimeResult, String> {
    verify_service::verify_instance_runtime(&app, &instance_id).await
}

#[tauri::command]
pub async fn download_missing_runtimes<R: Runtime>(
    app: AppHandle<R>,
    missing_list: Vec<MissingRuntime>,
) -> Result<(), String> {
    verify_service::download_missing_runtimes(&app, missing_list).await
}

#[tauri::command]
pub async fn parse_modpack_metadata(path: String) -> Result<ModpackMetadata, String> {
    modpack_service::parse_modpack(&path)
}

#[tauri::command]
pub async fn import_modpack<R: Runtime>(
    app: AppHandle<R>,
    zip_path: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) -> Result<(), String> {
    modpack_service::start_import(app, zip_path, instance_name, server_binding);
    Ok(())
}

#[tauri::command]
pub async fn download_and_import_modpack<R: Runtime>(
    app: AppHandle<R>,
    url: String,
    instance_name: String,
    server_binding: Option<ServerBinding>,
) -> Result<(), String> {
    modpack_service::download_and_import_modpack(app, url, instance_name, server_binding);
    Ok(())
}

#[tauri::command]
pub async fn scan_instances_in_dir<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<ImportResult, String> {
    local_instance_service::scan_instances_in_dir(&app, path).await
}

#[tauri::command]
pub async fn export_modpack<R: Runtime>(
    app: AppHandle<R>,
    config: ExportConfig,
) -> Result<(), String> {
    modpack_service::export::execute_export(&app, config).await
}

#[tauri::command]
pub async fn detect_third_party_launcher_sources<R: Runtime>(
    app: AppHandle<R>,
    path: Option<String>,
) -> Result<Vec<ThirdPartyImportSource>, String> {
    third_party_service::detect_launcher_sources(&app, path).await
}

#[tauri::command]
pub async fn import_third_party_launcher_source<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<ThirdPartyImportResult, String> {
    third_party_service::import_launcher_source(&app, path).await
}
