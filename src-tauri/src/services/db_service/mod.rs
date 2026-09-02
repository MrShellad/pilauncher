pub mod achievement_repo;
pub mod game_session_repo;
pub mod instance_mod_repo;
pub mod mod_alias_repo;
pub mod mod_relation_repo;
pub mod models;
pub mod pool;
pub mod seeds;
pub mod tag_repo;

pub use models::{EnrichedInstanceModRow, InstanceModDbRow, ModPlatformMatchBatchItem, ModRelationRecord};
pub use pool::AppDatabase;

use sqlx::SqlitePool;
use std::collections::HashMap;
use std::path::Path;

/// Unified database service facade providing backwards-compatible static access
pub struct DbService;

impl DbService {
    // -------------------------------------------------------------------------
    // Pool & Initialization
    // -------------------------------------------------------------------------
    pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, String> {
        pool::init_db(config_dir).await
    }

    // -------------------------------------------------------------------------
    // Mod Aliases
    // -------------------------------------------------------------------------
    pub async fn save_mod_aliases(
        pool: &SqlitePool,
        canonical_mod_id: &str,
        display_name: &str,
        aliases: &[String],
        source: &str,
    ) -> Result<(), sqlx::Error> {
        mod_alias_repo::save_mod_aliases(pool, canonical_mod_id, display_name, aliases, source).await
    }

    pub async fn query_mod_aliases(
        pool: &SqlitePool,
        aliases: &[String],
    ) -> Result<HashMap<String, (String, String)>, sqlx::Error> {
        mod_alias_repo::query_mod_aliases(pool, aliases).await
    }

    pub async fn query_aliases_for_mod_ids(
        pool: &SqlitePool,
        mod_ids: &[String],
    ) -> Result<HashMap<String, Vec<String>>, sqlx::Error> {
        mod_alias_repo::query_aliases_for_mod_ids(pool, mod_ids).await
    }

    pub async fn seed_essential_aliases(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        seeds::seed_essential_aliases(pool).await
    }

    // -------------------------------------------------------------------------
    // Mod Relations
    // -------------------------------------------------------------------------
    pub async fn save_mod_relations(
        pool: &SqlitePool,
        relations: &[ModRelationRecord],
    ) -> Result<(), sqlx::Error> {
        mod_relation_repo::save_mod_relations(pool, relations).await
    }

    pub async fn query_mod_dependencies(
        pool: &SqlitePool,
        identifiers: &[String],
    ) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
        mod_relation_repo::query_mod_dependencies(pool, identifiers).await
    }

    pub async fn query_mod_dependents(
        pool: &SqlitePool,
        identifiers: &[String],
    ) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
        mod_relation_repo::query_mod_dependents(pool, identifiers).await
    }

    // -------------------------------------------------------------------------
    // Instance Mods
    // -------------------------------------------------------------------------
    pub async fn query_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
    ) -> Result<Vec<EnrichedInstanceModRow>, sqlx::Error> {
        instance_mod_repo::query_instance_mods(pool, instance_id).await
    }

    pub async fn upsert_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
        mods: &[InstanceModDbRow],
    ) -> Result<(), sqlx::Error> {
        instance_mod_repo::upsert_instance_mods(pool, instance_id, mods).await
    }

    pub async fn update_mod_platform_matches_batch(
        pool: &SqlitePool,
        instance_id: &str,
        updates: &[ModPlatformMatchBatchItem],
    ) -> Result<(), sqlx::Error> {
        instance_mod_repo::update_mod_platform_matches_batch(pool, instance_id, updates).await
    }

    pub async fn delete_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
        file_names: &[String],
    ) -> Result<(), sqlx::Error> {
        instance_mod_repo::delete_instance_mods(pool, instance_id, file_names).await
    }

    pub async fn toggle_instance_mod(
        pool: &SqlitePool,
        instance_id: &str,
        old_file_name: &str,
        new_file_name: &str,
        is_enabled: bool,
    ) -> Result<(), sqlx::Error> {
        instance_mod_repo::toggle_instance_mod(pool, instance_id, old_file_name, new_file_name, is_enabled).await
    }

    pub async fn toggle_instance_mods_batch(
        pool: &SqlitePool,
        instance_id: &str,
        toggled: &[(String, String)],
        is_enabled: bool,
    ) -> Result<(), sqlx::Error> {
        instance_mod_repo::toggle_instance_mods_batch(pool, instance_id, toggled, is_enabled).await
    }

    // -------------------------------------------------------------------------
    // Tags
    // -------------------------------------------------------------------------
    pub async fn replace_instance_tag_rows(
        pool: &SqlitePool,
        instance_id: &str,
        tags: &[String],
    ) -> Result<(), sqlx::Error> {
        tag_repo::replace_instance_tag_rows(pool, instance_id, tags).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::SqlitePoolOptions;

    #[tokio::test]
    async fn test_mod_relations_uniqueness_and_queries() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .unwrap();

        let relations = vec![
            ModRelationRecord {
                source_identifier: "iris".into(),
                source_type: "mod_id".into(),
                target_identifier: "sodium".into(),
                target_type: "mod_id".into(),
                relation_type: "required".into(),
                version_requirement: Some(">=0.5.0".into()),
                target_name_hint: Some("Sodium".into()),
                source_provider: "jar_meta".into(),
            },
            ModRelationRecord {
                source_identifier: "sodium_extra".into(),
                source_type: "mod_id".into(),
                target_identifier: "sodium".into(),
                target_type: "mod_id".into(),
                relation_type: "required".into(),
                version_requirement: None,
                target_name_hint: Some("Sodium".into()),
                source_provider: "jar_meta".into(),
            },
            // Duplicate item with different version/provider (should UPSERT without duplicate creation)
            ModRelationRecord {
                source_identifier: "iris".into(),
                source_type: "mod_id".into(),
                target_identifier: "sodium".into(),
                target_type: "mod_id".into(),
                relation_type: "required".into(),
                version_requirement: Some(">=0.5.8".into()),
                target_name_hint: Some("Sodium (Updated)".into()),
                source_provider: "modrinth".into(),
            },
        ];

        DbService::save_mod_relations(&pool, &relations).await.unwrap();

        // Query Iris dependencies (Forward query)
        let iris_deps = DbService::query_mod_dependencies(&pool, &["iris".into()]).await.unwrap();
        assert_eq!(iris_deps.len(), 1, "Should have exactly 1 dependency for iris due to UPSERT uniqueness");
        assert_eq!(iris_deps[0].target_identifier, "sodium");
        assert_eq!(iris_deps[0].version_requirement, Some(">=0.5.8".into()));

        // Query Sodium dependents (Reverse query)
        let sodium_dependents = DbService::query_mod_dependents(&pool, &["sodium".into()]).await.unwrap();
        assert_eq!(sodium_dependents.len(), 2, "Sodium should have 2 dependents (iris and sodium_extra)");
        let dep_sources: Vec<_> = sodium_dependents.iter().map(|d| d.source_identifier.as_str()).collect();
        assert!(dep_sources.contains(&"iris"));
        assert!(dep_sources.contains(&"sodium_extra"));
    }

    #[tokio::test]
    async fn test_mod_aliases_seeding_and_queries() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .unwrap();

        DbService::seed_essential_aliases(&pool).await.unwrap();

        // 1. Verify seeds are loaded
        let query_result = DbService::query_mod_aliases(&pool, &["499980".into(), "9s6osm5g".into(), "cloth_config".into()])
            .await
            .unwrap();

        assert_eq!(query_result.len(), 3);
        assert_eq!(query_result.get("499980").unwrap().0, "cloth-config");
        assert_eq!(query_result.get("499980").unwrap().1, "Cloth Config");
        assert_eq!(query_result.get("9s6osm5g").unwrap().0, "cloth-config");

        let cloth_aliases = DbService::query_aliases_for_mod_ids(&pool, &["cloth-config".into()])
            .await
            .unwrap();
        let aliases_list = cloth_aliases.get("cloth-config").unwrap();
        assert!(aliases_list.contains(&"499980".to_string()));
        assert!(aliases_list.contains(&"cloth-config2".to_string()));

        // 2. Dynamic registration of new aliases
        DbService::save_mod_aliases(
            &pool,
            "custom-mod",
            "Custom Mod Name",
            &["custom_mod".into(), "123456".into()],
            "user_sync",
        )
        .await
        .unwrap();

        let custom_query = DbService::query_mod_aliases(&pool, &["123456".into()])
            .await
            .unwrap();
        assert_eq!(custom_query.get("123456").unwrap().0, "custom-mod");
        assert_eq!(custom_query.get("123456").unwrap().1, "Custom Mod Name");
    }
}
