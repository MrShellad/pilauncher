use crate::services::db_service::DbService;
use futures::stream::{FuturesUnordered, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Manager, Runtime};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ModUpdateInfo {
    pub file_name: String,
    pub has_update: bool,
    pub update_version_name: Option<String>,
    pub update_platform: Option<String>,
    pub update_project_id: Option<String>,
    pub update_file_id: Option<String>,
    pub update_file_name: Option<String>,
    pub update_download_url: Option<String>,
}

pub struct ModUpdateEngine;

impl ModUpdateEngine {
    pub async fn check_instance_mods_updates<R: Runtime>(
        app: &AppHandle<R>,
        instance_id: &str,
        game_version: &str,
        loader: &str,
        _force: bool,
        curseforge_key: Option<String>,
    ) -> Result<Vec<ModUpdateInfo>, String> {
        let db = app.state::<crate::services::db_service::AppDatabase>();
        let pool = db.pool.clone();
        let client = Arc::new(
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(12))
                .build()
                .map_err(|e| e.to_string())?,
        );

        let rows = DbService::query_instance_mods(&pool, instance_id)
            .await
            .map_err(|e| e.to_string())?;

        let cf_api_key = curseforge_key
            .or_else(|| std::env::var("VITE_CURSEFORGE_API_KEY").ok())
            .or_else(|| std::env::var("CURSEFORGE_API_KEY").ok())
            .or_else(|| option_env!("CURSEFORGE_API_KEY").map(|s| s.to_string()))
            .or_else(|| option_env!("VITE_CURSEFORGE_API_KEY").map(|s| s.to_string()));

        let cf_api_key_arc = Arc::new(cf_api_key);
        let gv_arc = Arc::new(game_version.trim().to_string());
        let loader_arc = Arc::new(loader.trim().to_lowercase());

        let tasks = FuturesUnordered::new();

        for r in rows {
            let platform = r.source_platform.clone().unwrap_or_default().to_lowercase();
            let project_id = r.source_project_id.clone().unwrap_or_default();
            let current_file_id = r.source_file_id.clone().unwrap_or_default();
            let file_name = r.file_name.clone();

            if project_id.is_empty() || (platform != "modrinth" && platform != "curseforge") {
                continue;
            }

            let client = client.clone();
            let cf_key = cf_api_key_arc.clone();
            let gv = gv_arc.clone();
            let ldr = loader_arc.clone();

            tasks.push(async move {
                let mut info = ModUpdateInfo {
                    file_name: file_name.clone(),
                    has_update: false,
                    update_version_name: None,
                    update_platform: None,
                    update_project_id: None,
                    update_file_id: None,
                    update_file_name: None,
                    update_download_url: None,
                };

                if platform == "modrinth" {
                    let mut url = format!(
                        "https://api.modrinth.com/v2/project/{}/version",
                        project_id
                    );
                    let mut query_params = Vec::new();
                    if !gv.is_empty() {
                        let gv_json = serde_json::to_string(&vec![gv.as_str()]).unwrap_or_default();
                        query_params.push(format!("game_versions={}", urlencoding::encode(&gv_json)));
                    }
                    if !ldr.is_empty() {
                        let ldr_json = serde_json::to_string(&vec![ldr.as_str()]).unwrap_or_default();
                        query_params.push(format!("loaders={}", urlencoding::encode(&ldr_json)));
                    }
                    if !query_params.is_empty() {
                        url = format!("{}?{}", url, query_params.join("&"));
                    }

                    if let Ok(resp) = client.get(&url).send().await {
                        if resp.status().is_success() {
                            if let Ok(versions) = resp.json::<Vec<serde_json::Value>>().await {
                                if let Some(latest) = versions.first() {
                                    let latest_id = latest["id"].as_str().unwrap_or_default();
                                    if !latest_id.is_empty() && latest_id != current_file_id {
                                        let version_number = latest["version_number"].as_str().or_else(|| latest["name"].as_str());
                                        let files = latest["files"].as_array();
                                        let primary_file = files
                                            .and_then(|arr| arr.iter().find(|f| f["primary"].as_bool().unwrap_or(false)))
                                            .or_else(|| files.and_then(|arr| arr.first()));

                                        let dl_url = primary_file.and_then(|f| f["url"].as_str());
                                        let dl_filename = primary_file.and_then(|f| f["filename"].as_str());

                                        info.has_update = true;
                                        info.update_version_name = version_number.map(|s| s.to_string());
                                        info.update_platform = Some("modrinth".to_string());
                                        info.update_project_id = Some(project_id.clone());
                                        info.update_file_id = Some(latest_id.to_string());
                                        info.update_file_name = dl_filename.map(|s| s.to_string());
                                        info.update_download_url = dl_url.map(|s| s.to_string());
                                    }
                                }
                            }
                        }
                    }
                } else if platform == "curseforge" {
                    if let Some(ref key) = *cf_key {
                        let mut url = format!(
                            "https://api.curseforge.com/v1/mods/{}/files?pageSize=10",
                            project_id
                        );
                        if !gv.is_empty() {
                            url.push_str(&format!("&gameVersion={}", urlencoding::encode(&gv)));
                        }
                        let loader_type = match ldr.as_str() {
                            "forge" => Some(1),
                            "fabric" => Some(4),
                            "quilt" => Some(5),
                            "neoforge" => Some(6),
                            _ => None,
                        };
                        if let Some(lt) = loader_type {
                            url.push_str(&format!("&modLoaderType={}", lt));
                        }

                        if let Ok(resp) = client.get(&url).header("x-api-key", key).send().await {
                            if resp.status().is_success() {
                                if let Ok(json) = resp.json::<serde_json::Value>().await {
                                    if let Some(files) = json["data"].as_array() {
                                        if let Some(latest) = files.first() {
                                            let latest_id_num = latest["id"].as_i64().unwrap_or(0);
                                            let latest_id_str = latest_id_num.to_string();

                                            if latest_id_num > 0 && latest_id_str != current_file_id {
                                                let display_name = latest["displayName"].as_str();
                                                let dl_url = latest["downloadUrl"].as_str();
                                                let dl_filename = latest["fileName"].as_str();

                                                info.has_update = true;
                                                info.update_version_name = display_name.map(|s| s.to_string());
                                                info.update_platform = Some("curseforge".to_string());
                                                info.update_project_id = Some(project_id.clone());
                                                info.update_file_id = Some(latest_id_str);
                                                info.update_file_name = dl_filename.map(|s| s.to_string());
                                                info.update_download_url = dl_url.map(|s| s.to_string());
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                info
            });
        }

        let mut results = Vec::new();
        let mut stream = tasks;
        while let Some(info) = stream.next().await {
            results.push(info);
        }

        Ok(results)
    }
}
