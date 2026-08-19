use crate::domain::mod_manifest::{
    build_manifest_entry, build_manifest_source, compute_curseforge_fingerprint, ModFileHash,
    ModFileState, ModManifestEntry, ModMetadata, ModSourceKind,
};
use std::path::Path;

pub struct RemoteFetcher;

impl RemoteFetcher {
    pub fn has_complete_curseforge_source(entry: Option<&ModManifestEntry>) -> bool {
        let Some(entry) = entry else {
            return false;
        };

        entry
            .source
            .platform
            .as_deref()
            .is_some_and(|value| value == "curseforge")
            && entry
                .source
                .project_id
                .as_deref()
                .is_some_and(|value| !value.is_empty())
            && entry
                .source
                .file_id
                .as_deref()
                .is_some_and(|value| !value.is_empty())
    }

    pub fn resolve_curseforge_fingerprint(
        entry: Option<&ModManifestEntry>,
        path: &Path,
    ) -> Option<u32> {
        if let Some(fingerprint) = entry.and_then(|value| value.curseforge_fingerprint) {
            return Some(fingerprint);
        }

        if Self::has_complete_curseforge_source(entry) {
            return None;
        }

        compute_curseforge_fingerprint(path).ok()
    }

    pub async fn try_fetch_modrinth_metadata(
        client: &reqwest::Client,
        mod_id: &str,
        cache_key: &str,
        bucket_dir: &Path,
        shared_mods_dir: &Path,
        meta: &mut ModMetadata,
        extracted_icon_rel_path: &mut Option<String>,
    ) -> bool {
        let modrinth_url = format!("https://api.modrinth.com/v2/project/{}", mod_id);
        if let Ok(resp) = client.get(&modrinth_url).send().await {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if meta.name.is_none() {
                        meta.name = json["title"].as_str().map(|s| s.to_string());
                    }
                    if meta.description.is_none() {
                        meta.description = json["description"].as_str().map(|s| s.to_string());
                    }
                    if meta.icon_absolute_path.is_none() {
                        if let Some(icon_url) = json["icon_url"].as_str() {
                            let target_path = bucket_dir.join(format!("{}.png", mod_id.trim()));
                            if super::icon_storage::IconStorage::download_icon_to_path(client, icon_url, &target_path).await {
                                let abs_path_str = target_path.to_string_lossy().to_string();
                                meta.icon_absolute_path = Some(abs_path_str);
                                if let Ok(rel) = target_path.strip_prefix(shared_mods_dir) {
                                    *extracted_icon_rel_path =
                                        Some(rel.to_string_lossy().replace('\\', "/"));
                                }
                            } else {
                                if let Some(path) = super::icon_storage::IconStorage::download_icon_to_bucket(
                                    client, icon_url, bucket_dir, cache_key,
                                )
                                .await
                                {
                                    meta.icon_absolute_path = Some(path.clone());
                                    if let Ok(rel) = Path::new(&path).strip_prefix(shared_mods_dir)
                                    {
                                        *extracted_icon_rel_path =
                                            Some(rel.to_string_lossy().replace('\\', "/"));
                                    }
                                }
                            }
                        }
                    }

                    // Capture genuine project_id to heal dependency checking
                    if let Some(project_id) = json["id"].as_str() {
                        let mut entry = meta.manifest_entry.clone().unwrap_or_else(|| {
                            build_manifest_entry(
                                build_manifest_source(
                                    ModSourceKind::ExternalImport,
                                    None,
                                    None,
                                    None,
                                ),
                                ModFileHash {
                                    algorithm: "none".into(),
                                    value: "none".into(),
                                },
                                ModFileState::default(),
                            )
                        });
                        entry.source.platform = Some("modrinth".to_string());
                        entry.source.project_id = Some(project_id.to_string());
                        meta.manifest_entry = Some(entry);
                    }
                    return true;
                }
            }
        }
        false
    }

    pub async fn try_fetch_curseforge_metadata(
        client: &reqwest::Client,
        mod_id: &str,
        cache_key: &str,
        bucket_dir: &Path,
        shared_mods_dir: &Path,
        meta: &mut ModMetadata,
        extracted_icon_rel_path: &mut Option<String>,
    ) -> bool {
        let cf_key = std::env::var("VITE_CURSEFORGE_API_KEY")
            .ok()
            .or_else(|| std::env::var("CURSEFORGE_API_KEY").ok())
            .or_else(|| option_env!("CURSEFORGE_API_KEY").map(|s| s.to_string()))
            .or_else(|| option_env!("VITE_CURSEFORGE_API_KEY").map(|s| s.to_string()));

        if let Some(key) = cf_key {
            let cf_url = format!(
                "https://api.curseforge.com/v1/mods/search?gameId=432&slug={}",
                mod_id
            );
            if let Ok(resp) = client.get(&cf_url).header("x-api-key", &key).send().await {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(data) = json["data"].as_array() {
                            if let Some(first) = data.first() {
                                if meta.name.is_none() {
                                    meta.name = first["name"].as_str().map(|s| s.to_string());
                                }
                                if meta.description.is_none() {
                                    meta.description =
                                        first["summary"].as_str().map(|s| s.to_string());
                                }
                                if meta.icon_absolute_path.is_none() {
                                    if let Some(icon_url) = first["logo"]["thumbnailUrl"]
                                        .as_str()
                                        .or_else(|| first["logo"]["url"].as_str())
                                    {
                                        let target_path =
                                            bucket_dir.join(format!("{}.png", mod_id.trim()));
                                        if super::icon_storage::IconStorage::download_icon_to_path(
                                            client,
                                            icon_url,
                                            &target_path,
                                        )
                                        .await
                                        {
                                            let abs_path_str =
                                                target_path.to_string_lossy().to_string();
                                            meta.icon_absolute_path = Some(abs_path_str);
                                            if let Ok(rel) =
                                                target_path.strip_prefix(shared_mods_dir)
                                            {
                                                *extracted_icon_rel_path =
                                                    Some(rel.to_string_lossy().replace('\\', "/"));
                                            }
                                        } else {
                                            if let Some(path) = super::icon_storage::IconStorage::download_icon_to_bucket(
                                                client, icon_url, bucket_dir, cache_key,
                                            )
                                            .await
                                            {
                                                meta.icon_absolute_path = Some(path.clone());
                                                if let Ok(rel) =
                                                    Path::new(&path).strip_prefix(shared_mods_dir)
                                                {
                                                    *extracted_icon_rel_path = Some(
                                                        rel.to_string_lossy().replace('\\', "/"),
                                                    );
                                                }
                                            }
                                        }
                                    }
                                }

                                // Capture genuine project_id from CurseForge fallback too!
                                if let Some(cf_id_num) = first["id"].as_i64() {
                                    let mut entry = meta.manifest_entry.clone().unwrap_or_else(|| {
                                        build_manifest_entry(
                                            build_manifest_source(ModSourceKind::ExternalImport, None, None, None),
                                            ModFileHash { algorithm: "none".into(), value: "none".into() },
                                            ModFileState::default(),
                                        )
                                    });
                                    entry.source.platform = Some("curseforge".to_string());
                                    entry.source.project_id = Some(cf_id_num.to_string());
                                    meta.manifest_entry = Some(entry);
                                }
                                return true;
                            }
                        }
                    }
                }
            }
        }
        false
    }

    pub async fn fallback_api_metadata(
        client: &reqwest::Client,
        mod_id: &str,
        cache_key: &str,
        bucket_dir: &Path,
        shared_mods_dir: &Path,
        meta: &mut ModMetadata,
        extracted_icon_rel_path: &mut Option<String>,
    ) {
        let preferred_platform = meta
            .manifest_entry
            .as_ref()
            .and_then(|entry| entry.metadata_settings.as_ref())
            .and_then(|settings| settings.metadata_platform.as_deref())
            .unwrap_or("auto");

        if preferred_platform == "curseforge" {
            let hit = Self::try_fetch_curseforge_metadata(
                client,
                mod_id,
                cache_key,
                bucket_dir,
                shared_mods_dir,
                meta,
                extracted_icon_rel_path,
            )
            .await;
            if !hit {
                let _ = Self::try_fetch_modrinth_metadata(
                    client,
                    mod_id,
                    cache_key,
                    bucket_dir,
                    shared_mods_dir,
                    meta,
                    extracted_icon_rel_path,
                )
                .await;
            }
        } else {
            let hit = Self::try_fetch_modrinth_metadata(
                client,
                mod_id,
                cache_key,
                bucket_dir,
                shared_mods_dir,
                meta,
                extracted_icon_rel_path,
            )
            .await;
            if !hit {
                let _ = Self::try_fetch_curseforge_metadata(
                    client,
                    mod_id,
                    cache_key,
                    bucket_dir,
                    shared_mods_dir,
                    meta,
                    extracted_icon_rel_path,
                )
                .await;
            }
        }
    }
}
