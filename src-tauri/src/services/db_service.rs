use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Row, SqlitePool,
};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub struct AppDatabase {
    pub pool: SqlitePool,
}

pub struct DbService;

impl DbService {
    const CURRENT_SCHEMA_VERSION: i64 = 8;

    pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, String> {
        if !config_dir.exists() {
            fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
        }
        let db_path = config_dir.join("pilauncher_data.db");

        let connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true)
            .foreign_keys(true);

        let pool = SqlitePoolOptions::new()
            .connect_with(connect_options)
            .await
            .map_err(|e| e.to_string())?;

        // Enable WAL mode & Normal Sync for better concurrent performance
        let _ = sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await;
        let _ = sqlx::query("PRAGMA foreign_keys=ON;").execute(&pool).await;
        let _ = sqlx::query("PRAGMA synchronous=NORMAL;")
            .execute(&pool)
            .await;

        Self::create_tables(&pool)
            .await
            .map_err(|e| e.to_string())?;
        Self::run_migrations(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(pool)
    }

    async fn create_tables(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                nickname TEXT,
                avatar TEXT,
                bio TEXT,
                device_name TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS friendships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                friend_id INTEGER NOT NULL,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (friend_id) REFERENCES users(id),
                UNIQUE(user_id, friend_id)
            );

            CREATE TABLE IF NOT EXISTS trusted_devices (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                user_uuid TEXT,
                username TEXT DEFAULT '',
                device_uuid TEXT UNIQUE NOT NULL,
                device_name TEXT NOT NULL,
                public_key_b64 TEXT NOT NULL,
                trust_level TEXT DEFAULT 'trusted',
                trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transfer_uuid TEXT,
                direction TEXT DEFAULT 'outgoing',
                sender_user_id INTEGER,
                receiver_user_id INTEGER,
                sender_device_id TEXT DEFAULT '',
                sender_device TEXT NOT NULL,
                receiver_device_id TEXT DEFAULT '',
                receiver_device TEXT NOT NULL,
                remote_device_id TEXT DEFAULT '',
                remote_device_name TEXT DEFAULT '',
                remote_username TEXT DEFAULT '',
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                hash TEXT,
                status TEXT NOT NULL,
                error_message TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (sender_user_id) REFERENCES users(id),
                FOREIGN KEY (receiver_user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS starred_items (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                source TEXT NOT NULL,
                project_id TEXT,
                title TEXT,
                author TEXT,
                snapshot TEXT NOT NULL,
                state TEXT NOT NULL,
                meta TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS favorite_tombstones (
                item_id TEXT PRIMARY KEY,
                deleted_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT
            );

            CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS sync_queue (
                id TEXT PRIMARY KEY,
                action TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collections (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                type TEXT NOT NULL,
                cover_image TEXT,
                sort_order INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS collection_items (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                item_id TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                extra TEXT,
                created_at INTEGER NOT NULL,
                UNIQUE (collection_id, item_id)
            );

            CREATE TABLE IF NOT EXISTS mod_set_trackers (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                collection_name TEXT NOT NULL,
                game_version TEXT NOT NULL,
                loader TEXT NOT NULL,
                readiness_status TEXT NOT NULL,
                ready_count INTEGER NOT NULL DEFAULT 0,
                total_count INTEGER NOT NULL DEFAULT 0,
                projects_json TEXT NOT NULL,
                items_json TEXT NOT NULL,
                last_checked_at INTEGER,
                notified_ready_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_starred_type ON starred_items(type);
            CREATE INDEX IF NOT EXISTS idx_starred_updated ON starred_items(updated_at);
            CREATE INDEX IF NOT EXISTS idx_starred_project ON starred_items(source, project_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);
            CREATE INDEX IF NOT EXISTS idx_mod_set_trackers_collection ON mod_set_trackers(collection_id);

            CREATE TABLE IF NOT EXISTS global_mod_cache (
                cache_key TEXT PRIMARY KEY,
                name TEXT,
                description TEXT,
                icon_url TEXT,
                updated_at INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS mod_global_metadata_cache (
                mod_id TEXT PRIMARY KEY,
                curseforge_fingerprint INTEGER,
                modrinth_hash TEXT,
                curseforge_project_id TEXT,
                modrinth_project_id TEXT,
                name TEXT,
                description TEXT,
                icon_rel_path TEXT NOT NULL,
                icon_source TEXT,
                aliases TEXT,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_mod_cache_cf_fp ON mod_global_metadata_cache(curseforge_fingerprint);
            CREATE INDEX IF NOT EXISTS idx_mod_cache_mr_hash ON mod_global_metadata_cache(modrinth_hash);
            CREATE INDEX IF NOT EXISTS idx_mod_cache_mr_pid ON mod_global_metadata_cache(modrinth_project_id);
            CREATE INDEX IF NOT EXISTS idx_mod_cache_cf_pid ON mod_global_metadata_cache(curseforge_project_id);

            CREATE TABLE IF NOT EXISTS mod_aliases (
                alias TEXT PRIMARY KEY,
                canonical_mod_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                source TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_mod_aliases_canonical ON mod_aliases(canonical_mod_id);

            CREATE TABLE IF NOT EXISTS mod_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_identifier TEXT NOT NULL,
                source_type TEXT NOT NULL,
                target_identifier TEXT NOT NULL,
                target_type TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                version_requirement TEXT,
                target_name_hint TEXT,
                source_provider TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE (source_identifier, target_identifier, relation_type)
            );

            CREATE INDEX IF NOT EXISTS idx_mod_relations_forward ON mod_relations(source_identifier, relation_type);
            CREATE INDEX IF NOT EXISTS idx_mod_relations_reverse ON mod_relations(target_identifier, relation_type);

            CREATE TABLE IF NOT EXISTS instance_mods (
                instance_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                is_enabled BOOLEAN NOT NULL DEFAULT 1,
                file_size INTEGER NOT NULL,
                modified_at INTEGER NOT NULL,
                sha1 TEXT,
                curseforge_fingerprint INTEGER,
                mod_id TEXT,
                custom_display_name TEXT,
                version TEXT,
                source_platform TEXT,
                source_project_id TEXT,
                source_file_id TEXT,
                updated_at INTEGER NOT NULL,
                PRIMARY KEY (instance_id, file_name)
            );

            CREATE INDEX IF NOT EXISTS idx_instance_mods_query ON instance_mods(instance_id, is_enabled);
            CREATE INDEX IF NOT EXISTS idx_instance_mods_mod_id ON instance_mods(mod_id);
            CREATE INDEX IF NOT EXISTS idx_instance_mods_fp ON instance_mods(curseforge_fingerprint);
            CREATE INDEX IF NOT EXISTS idx_instance_mods_sha1 ON instance_mods(sha1);

            CREATE TABLE IF NOT EXISTS instances (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                mc_version TEXT NOT NULL,
                loader_type TEXT,
                loader_version TEXT,
                java_path TEXT,
                min_memory INTEGER DEFAULT 1024,
                max_memory INTEGER DEFAULT 4096,
                icon_path TEXT,
                last_played_at DATETIME,
                playtime_secs INTEGER DEFAULT 0,
                pending_delta INTEGER DEFAULT 0,
                jvm_args TEXT,
                window_width INTEGER,
                window_height INTEGER,
                is_favorite INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL COLLATE NOCASE UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS instance_tags (
                instance_id TEXT NOT NULL,
                tag_id INTEGER NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (instance_id, tag_id),
                FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
                FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_tags_name
                ON tags(name);
            CREATE INDEX IF NOT EXISTS idx_instance_tags_instance
                ON instance_tags(instance_id, sort_order);
            CREATE INDEX IF NOT EXISTS idx_instance_tags_tag
                ON instance_tags(tag_id);

            CREATE TABLE IF NOT EXISTS servers (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                address TEXT NOT NULL,
                port INTEGER NOT NULL DEFAULT 25565,
                icon_base64 TEXT,
                hide_address BOOLEAN NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS instance_servers (
                instance_id TEXT NOT NULL,
                server_id TEXT NOT NULL,
                is_primary BOOLEAN NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (instance_id, server_id),
                FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
                FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_instance_servers_instance
                ON instance_servers(instance_id, sort_order);
            CREATE INDEX IF NOT EXISTS idx_servers_address
                ON servers(address, port);

            CREATE TABLE IF NOT EXISTS logshare_history (
                uuid TEXT PRIMARY KEY,
                log_id TEXT NOT NULL,
                log_type TEXT NOT NULL,
                url TEXT NOT NULL,
                raw_url TEXT,
                token TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_logshare_history_log_id
                ON logshare_history(log_id);
            CREATE INDEX IF NOT EXISTS idx_logshare_history_expires_at
                ON logshare_history(expires_at);
            ",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        Self::ensure_migration_table(pool).await?;

        if !Self::is_migration_applied(pool, 1).await? {
            Self::migrate_legacy_core_columns(pool).await?;
            Self::record_migration(pool, 1, "legacy_core_columns").await?;
        }

        if !Self::is_migration_applied(pool, 2).await? {
            Self::migrate_normalized_instance_tags(pool).await?;
            Self::record_migration(pool, 2, "normalized_instance_tags").await?;
        }

        if !Self::is_migration_applied(pool, 3).await? {
            Self::migrate_library_mod_set_trackers(pool).await?;
            Self::record_migration(pool, 3, "library_mod_set_trackers").await?;
        }

        if !Self::is_migration_applied(pool, 4).await? {
            Self::migrate_favorite_tombstones(pool).await?;
            Self::record_migration(pool, 4, "favorite_tombstones").await?;
        }

        if !Self::is_migration_applied(pool, 5).await? {
            Self::migrate_library_resource_mappings(pool).await?;
            Self::record_migration(pool, 5, "library_resource_mappings").await?;
        }

        if !Self::is_migration_applied(pool, 6).await? {
            Self::migrate_mod_global_metadata_cache(pool).await?;
            Self::record_migration(pool, 6, "mod_global_metadata_cache").await?;
        }

        if !Self::is_migration_applied(pool, 7).await? {
            Self::migrate_mod_relations(pool).await?;
            Self::record_migration(pool, 7, "mod_relations").await?;
        }

        if !Self::is_migration_applied(pool, 8).await? {
            Self::migrate_mod_aliases(pool).await?;
            Self::seed_essential_aliases(pool).await?;
            Self::record_migration(pool, 8, "mod_aliases_and_seeds").await?;
        }

        sqlx::query(
            "INSERT OR REPLACE INTO app_meta (key, value)
             VALUES ('schema_version', ?)",
        )
        .bind(Self::CURRENT_SCHEMA_VERSION.to_string())
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn ensure_migration_table(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn is_migration_applied(pool: &SqlitePool, version: i64) -> Result<bool, sqlx::Error> {
        let exists: Option<i64> =
            sqlx::query_scalar("SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1")
                .bind(version)
                .fetch_optional(pool)
                .await?;

        Ok(exists.is_some())
    }

    async fn record_migration(
        pool: &SqlitePool,
        version: i64,
        name: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT OR REPLACE INTO schema_migrations (version, name, applied_at)
             VALUES (?, ?, CURRENT_TIMESTAMP)",
        )
        .bind(version)
        .bind(name)
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_legacy_core_columns(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        let trusted_rows = sqlx::query("PRAGMA table_info(trusted_devices)")
            .fetch_all(pool)
            .await?;

        let has_trusted_column = |name: &str| {
            trusted_rows.iter().any(|row| {
                let col_name: String = sqlx::Row::get(row, "name");
                col_name == name
            })
        };

        if !has_trusted_column("user_uuid") {
            sqlx::query("ALTER TABLE trusted_devices ADD COLUMN user_uuid TEXT DEFAULT ''")
                .execute(pool)
                .await?;
        }

        if !has_trusted_column("username") {
            sqlx::query("ALTER TABLE trusted_devices ADD COLUMN username TEXT DEFAULT ''")
                .execute(pool)
                .await?;
        }

        if !has_trusted_column("trust_level") {
            sqlx::query(
                "ALTER TABLE trusted_devices ADD COLUMN trust_level TEXT DEFAULT 'trusted'",
            )
            .execute(pool)
            .await?;
        }

        sqlx::query(
            "UPDATE trusted_devices
             SET trust_level = 'trusted'
             WHERE trust_level IS NULL OR trim(trust_level) = ''",
        )
        .execute(pool)
        .await?;

        let transfer_rows = sqlx::query("PRAGMA table_info(transfers)")
            .fetch_all(pool)
            .await?;

        let has_transfer_column = |name: &str| {
            transfer_rows.iter().any(|row| {
                let col_name: String = sqlx::Row::get(row, "name");
                col_name == name
            })
        };

        let transfer_alters = [
            (
                "transfer_uuid",
                "ALTER TABLE transfers ADD COLUMN transfer_uuid TEXT",
            ),
            (
                "direction",
                "ALTER TABLE transfers ADD COLUMN direction TEXT DEFAULT 'outgoing'",
            ),
            (
                "sender_device_id",
                "ALTER TABLE transfers ADD COLUMN sender_device_id TEXT DEFAULT ''",
            ),
            (
                "receiver_device_id",
                "ALTER TABLE transfers ADD COLUMN receiver_device_id TEXT DEFAULT ''",
            ),
            (
                "remote_device_id",
                "ALTER TABLE transfers ADD COLUMN remote_device_id TEXT DEFAULT ''",
            ),
            (
                "remote_device_name",
                "ALTER TABLE transfers ADD COLUMN remote_device_name TEXT DEFAULT ''",
            ),
            (
                "remote_username",
                "ALTER TABLE transfers ADD COLUMN remote_username TEXT DEFAULT ''",
            ),
            (
                "error_message",
                "ALTER TABLE transfers ADD COLUMN error_message TEXT DEFAULT ''",
            ),
        ];

        for (column, statement) in transfer_alters {
            if !has_transfer_column(column) {
                sqlx::query(statement).execute(pool).await?;
            }
        }

        // Migrate instances table
        let instance_rows = sqlx::query("PRAGMA table_info(instances)")
            .fetch_all(pool)
            .await?;

        let has_instance_column = |name: &str| {
            instance_rows.iter().any(|row| {
                let col_name: String = sqlx::Row::get(row, "name");
                col_name == name
            })
        };

        let instance_alters = [
            (
                "last_played_at",
                "ALTER TABLE instances ADD COLUMN last_played_at DATETIME",
            ),
            (
                "playtime_secs",
                "ALTER TABLE instances ADD COLUMN playtime_secs INTEGER DEFAULT 0",
            ),
            (
                "pending_delta",
                "ALTER TABLE instances ADD COLUMN pending_delta INTEGER DEFAULT 0",
            ),
            ("jvm_args", "ALTER TABLE instances ADD COLUMN jvm_args TEXT"),
            (
                "window_width",
                "ALTER TABLE instances ADD COLUMN window_width INTEGER",
            ),
            (
                "window_height",
                "ALTER TABLE instances ADD COLUMN window_height INTEGER",
            ),
            (
                "is_favorite",
                "ALTER TABLE instances ADD COLUMN is_favorite INTEGER DEFAULT 0",
            ),
        ];

        for (column, statement) in instance_alters {
            if !has_instance_column(column) {
                sqlx::query(statement).execute(pool).await?;
            }
        }

        Ok(())
    }

    async fn migrate_normalized_instance_tags(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        let already_migrated: Option<String> = sqlx::query_scalar(
            "SELECT value FROM app_meta WHERE key = 'migrated_instance_tags_v1'",
        )
        .fetch_optional(pool)
        .await?;

        if already_migrated.as_deref() == Some("1") {
            return Ok(());
        }

        let instance_rows = sqlx::query("PRAGMA table_info(instances)")
            .fetch_all(pool)
            .await?;
        let has_legacy_tags_column = instance_rows.iter().any(|row| {
            let col_name: String = sqlx::Row::get(row, "name");
            col_name == "tags"
        });

        if has_legacy_tags_column {
            let rows = sqlx::query(
                "SELECT id, tags
                 FROM instances
                 WHERE tags IS NOT NULL AND trim(tags) <> ''",
            )
            .fetch_all(pool)
            .await?;

            for row in rows {
                let instance_id: String = row.get("id");
                let tags_json: String = row.get("tags");
                let tags = serde_json::from_str::<Vec<String>>(&tags_json).unwrap_or_default();
                Self::replace_instance_tag_rows(pool, &instance_id, &tags).await?;
            }
        }

        sqlx::query(
            "DELETE FROM tags
             WHERE NOT EXISTS (
                 SELECT 1 FROM instance_tags
                 WHERE instance_tags.tag_id = tags.id
             )",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "INSERT OR REPLACE INTO app_meta (key, value)
             VALUES ('migrated_instance_tags_v1', '1')",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_library_mod_set_trackers(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS mod_set_trackers (
                id TEXT PRIMARY KEY,
                collection_id TEXT NOT NULL,
                collection_name TEXT NOT NULL,
                game_version TEXT NOT NULL,
                loader TEXT NOT NULL,
                readiness_status TEXT NOT NULL,
                ready_count INTEGER NOT NULL DEFAULT 0,
                total_count INTEGER NOT NULL DEFAULT 0,
                projects_json TEXT NOT NULL,
                items_json TEXT NOT NULL,
                last_checked_at INTEGER,
                notified_ready_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            )",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_set_trackers_collection
             ON mod_set_trackers(collection_id)",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_favorite_tombstones(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS favorite_tombstones (
                item_id TEXT PRIMARY KEY,
                deleted_at INTEGER NOT NULL
            )",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_library_resource_mappings(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS library_resource_mappings (
                id TEXT PRIMARY KEY,
                resource_id TEXT NOT NULL,
                instance_id TEXT NOT NULL,
                resource_type TEXT NOT NULL,
                target_filename TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                UNIQUE (resource_id, instance_id)
            )",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_library_resource_mappings_resource
             ON library_resource_mappings(resource_id)",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_library_resource_mappings_instance
             ON library_resource_mappings(instance_id)",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn replace_instance_tag_rows(
        pool: &SqlitePool,
        instance_id: &str,
        tags: &[String],
    ) -> Result<(), sqlx::Error> {
        let mut normalized_tags = Vec::new();
        for tag in tags {
            let normalized = tag.split_whitespace().collect::<Vec<_>>().join(" ");
            if !normalized.is_empty() && !normalized_tags.contains(&normalized) {
                normalized_tags.push(normalized);
            }
        }

        let mut tx = pool.begin().await?;
        sqlx::query("DELETE FROM instance_tags WHERE instance_id = ?")
            .bind(instance_id)
            .execute(&mut *tx)
            .await?;

        for (index, tag) in normalized_tags.iter().enumerate() {
            sqlx::query(
                "INSERT INTO tags (name)
                 VALUES (?)
                 ON CONFLICT(name) DO UPDATE SET updated_at = CURRENT_TIMESTAMP",
            )
            .bind(tag)
            .execute(&mut *tx)
            .await?;

            let tag_id: i64 = sqlx::query_scalar("SELECT id FROM tags WHERE name = ?")
                .bind(tag)
                .fetch_one(&mut *tx)
                .await?;

            sqlx::query(
                "INSERT INTO instance_tags (instance_id, tag_id, sort_order)
                 VALUES (?, ?, ?)
                 ON CONFLICT(instance_id, tag_id) DO UPDATE SET sort_order = excluded.sort_order",
            )
            .bind(instance_id)
            .bind(tag_id)
            .bind(index as i64)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    async fn migrate_mod_global_metadata_cache(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS mod_global_metadata_cache (
                mod_id TEXT PRIMARY KEY,
                curseforge_fingerprint INTEGER,
                modrinth_hash TEXT,
                curseforge_project_id TEXT,
                modrinth_project_id TEXT,
                name TEXT,
                description TEXT,
                icon_rel_path TEXT NOT NULL,
                icon_source TEXT,
                updated_at INTEGER NOT NULL
            );",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_cache_cf_fp ON mod_global_metadata_cache(curseforge_fingerprint);",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_cache_mr_hash ON mod_global_metadata_cache(modrinth_hash);",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_cache_mr_pid ON mod_global_metadata_cache(modrinth_project_id);",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_cache_cf_pid ON mod_global_metadata_cache(curseforge_project_id);",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_mod_relations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS mod_relations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_identifier TEXT NOT NULL,
                source_type TEXT NOT NULL,
                target_identifier TEXT NOT NULL,
                target_type TEXT NOT NULL,
                relation_type TEXT NOT NULL,
                version_requirement TEXT,
                target_name_hint TEXT,
                source_provider TEXT NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE (source_identifier, target_identifier, relation_type)
            );",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_relations_forward ON mod_relations(source_identifier, relation_type);",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_relations_reverse ON mod_relations(target_identifier, relation_type);",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn migrate_mod_aliases(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS mod_aliases (
                alias TEXT PRIMARY KEY,
                canonical_mod_id TEXT NOT NULL,
                display_name TEXT NOT NULL,
                source TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            );",
        )
        .execute(pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_mod_aliases_canonical ON mod_aliases(canonical_mod_id);",
        )
        .execute(pool)
        .await?;

        // Check if aliases column exists on mod_global_metadata_cache
        let pragma_rows = sqlx::query("PRAGMA table_info(mod_global_metadata_cache);")
            .fetch_all(pool)
            .await?;

        let has_aliases_col = pragma_rows.iter().any(|row| {
            let name: String = row.get("name");
            name == "aliases"
        });

        if !has_aliases_col {
            let _ = sqlx::query("ALTER TABLE mod_global_metadata_cache ADD COLUMN aliases TEXT;")
                .execute(pool)
                .await;
        }

        Ok(())
    }

    pub async fn save_mod_aliases(
        pool: &SqlitePool,
        canonical_mod_id: &str,
        display_name: &str,
        aliases: &[String],
        source: &str,
    ) -> Result<(), sqlx::Error> {
        let clean_canonical = canonical_mod_id.trim().to_lowercase();
        if clean_canonical.is_empty() || aliases.is_empty() {
            return Ok(());
        }

        let mut tx = pool.begin().await?;
        let now = chrono::Utc::now().timestamp();

        for raw_alias in aliases {
            let clean_alias = raw_alias.trim().to_lowercase();
            if clean_alias.is_empty() {
                continue;
            }

            sqlx::query(
                "INSERT INTO mod_aliases (alias, canonical_mod_id, display_name, source, updated_at)
                 VALUES (?, ?, ?, ?, ?)
                 ON CONFLICT(alias) DO UPDATE SET
                    canonical_mod_id = excluded.canonical_mod_id,
                    display_name = excluded.display_name,
                    source = excluded.source,
                    updated_at = excluded.updated_at;",
            )
            .bind(&clean_alias)
            .bind(&clean_canonical)
            .bind(display_name)
            .bind(source)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn query_mod_aliases(
        pool: &SqlitePool,
        aliases: &[String],
    ) -> Result<HashMap<String, (String, String)>, sqlx::Error> {
        if aliases.is_empty() {
            return Ok(HashMap::new());
        }

        let mut clean_list: Vec<String> = aliases
            .iter()
            .map(|a| a.trim().to_lowercase())
            .filter(|a| !a.is_empty())
            .collect();
        clean_list.sort();
        clean_list.dedup();

        if clean_list.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders = clean_list.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT alias, canonical_mod_id, display_name FROM mod_aliases WHERE alias IN ({})",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String, String, String)>(&sql);
        for a in &clean_list {
            query = query.bind(a);
        }

        let rows = query.fetch_all(pool).await?;
        let mut map = HashMap::new();
        for (alias, canonical_id, name) in rows {
            map.insert(alias, (canonical_id, name));
        }

        Ok(map)
    }

    pub async fn query_aliases_for_mod_ids(
        pool: &SqlitePool,
        mod_ids: &[String],
    ) -> Result<HashMap<String, Vec<String>>, sqlx::Error> {
        if mod_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let mut clean_list: Vec<String> = mod_ids
            .iter()
            .map(|m| m.trim().to_lowercase())
            .filter(|m| !m.is_empty())
            .collect();
        clean_list.sort();
        clean_list.dedup();

        if clean_list.is_empty() {
            return Ok(HashMap::new());
        }

        let placeholders = clean_list.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT alias, canonical_mod_id FROM mod_aliases WHERE canonical_mod_id IN ({})",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String, String)>(&sql);
        for m in &clean_list {
            query = query.bind(m);
        }

        let rows = query.fetch_all(pool).await?;
        let mut map: HashMap<String, Vec<String>> = HashMap::new();
        for (alias, canonical_id) in rows {
            map.entry(canonical_id).or_default().push(alias);
        }

        Ok(map)
    }

    pub async fn seed_essential_aliases(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        let seeds: &[(&str, &str, &[&str])] = &[
            ("cloth-config", "Cloth Config", &[
                "cloth-config", "cloth_config", "clothconfig",
                "cloth-config2", "cloth_config2", "clothconfig2",
                "499980", "9s6osm5g", "cloth-config-fabric", "cloth-config-forge",
            ]),
            ("fabric-api", "Fabric API", &[
                "fabric-api", "fabric_api", "fabricapi", "fabric",
                "306612", "P7dR8mBk", "fabric-api-base",
            ]),
            ("architectury", "Architectury API", &[
                "architectury", "architectury-api", "architectury_api", "architecturyapi",
                "419699", "lhGA9TYQ",
            ]),
            ("geckolib", "GeckoLib", &[
                "geckolib", "geckolib3", "geckolib4", "geckolib-fabric", "geckolib-forge",
                "388172", "8BmcYKb2",
            ]),
            ("curios", "Curios API", &[
                "curios", "curios-api", "curios_api", "curiosapi", "309927",
            ]),
            ("jei", "Just Enough Items", &[
                "jei", "just-enough-items", "justenoughitems", "238222", "u6dRKJwZ",
            ]),
            ("rei", "Roughly Enough Items", &[
                "rei", "roughly-enough-items", "roughlyenoughitems", "310111", "nfn13YXw",
            ]),
            ("emi", "EMI", &[
                "emi", "580555", "fRiHVvU7",
            ]),
            ("patchouli", "Patchouli", &[
                "patchouli", "306770", "n6XB85cy",
            ]),
            ("citresewn", "CIT Resewn", &[
                "citresewn", "cit-resewn", "cit_resewn", "510842", "otVJHGxO",
            ]),
            ("indium", "Indium", &[
                "indium", "540608", "Orvt0mII",
            ]),
            ("iris", "Iris Shaders", &[
                "iris", "iris-shaders", "irisshaders", "455508", "YL57xq9U",
            ]),
            ("sodium", "Sodium / Embeddium", &[
                "sodium", "rubidium", "embeddium", "394468", "1103431", "908741", "AANobbMI",
            ]),
            ("fabric-language-kotlin", "Fabric Language Kotlin", &[
                "fabric-language-kotlin", "kotlin", "kotlinforforge", "fabric_language_kotlin",
                "308769", "Ha28R6CL",
            ]),
            ("terrablender", "TerraBlender", &[
                "terrablender", "563928", "mOgUt4GM",
            ]),
            ("yungs-api", "YUNG's API", &[
                "yungs-api", "yung-api", "yungsapi", "yungapi", "379965", "O5705Jpv",
            ]),
            ("balm", "Balm", &[
                "balm", "balm-fabric", "balm-forge", "balm_fabric", "balm_forge",
                "531761", "MBAknsWE",
            ]),
            ("collective", "Collective", &[
                "collective", "409026", "e0M1Uh0y",
            ]),
            ("resourceful-lib", "Resourceful Lib", &[
                "resourceful-lib", "resourcefullib", "resourceful_lib", "570073", "G1epqFG1",
            ]),
            ("owo-lib", "oωo (owo-lib)", &[
                "owo-lib", "owo", "owolib", "530898", "ccKDOlHs",
            ]),
            ("cardinal-components", "Cardinal Components", &[
                "cardinal-components", "cardinal-components-base", "cardinal_components",
                "312812", "P67965P6",
            ]),
            ("yacl", "YetAnotherConfigLib", &[
                "yacl", "yet-another-config-lib", "yetanotherconfiglib", "587483", "1eAoo2KR",
            ]),
            ("bookshelf", "Bookshelf", &[
                "bookshelf", "416954", "5ZwdcRci",
            ]),
            ("citadel", "Citadel", &[
                "citadel", "419286", "gvQqBUqZ",
            ]),
            ("puzzles-lib", "Puzzles Lib", &[
                "puzzleslib", "puzzles-lib", "puzzles_lib", "63823", "kKmKFzv5",
            ]),
            ("malilib", "MaLiLib", &[
                "malilib", "60089", "fE4bR1Sr",
            ]),
            ("appleskin", "AppleSkin", &[
                "appleskin", "248787", "rOu7bqlL",
            ]),
            ("ferritecore", "FerriteCore", &[
                "ferritecore", "504107", "NNAgCjsB",
            ]),
            ("modernfix", "ModernFix", &[
                "modernfix", "636180", "ohNO6lps",
            ]),
            ("c2me", "C2ME", &[
                "c2me", "c2me-fabric", "c2me_fabric", "437778", "PtjYWJxP",
            ]),
        ];

        let mut tx = pool.begin().await?;
        let now = chrono::Utc::now().timestamp();

        for (canon_id, name, aliases) in seeds {
            for alias in *aliases {
                sqlx::query(
                    "INSERT INTO mod_aliases (alias, canonical_mod_id, display_name, source, updated_at)
                     VALUES (?, ?, ?, 'system_seed', ?)
                     ON CONFLICT(alias) DO NOTHING;",
                )
                .bind(alias.to_lowercase())
                .bind(canon_id.to_lowercase())
                .bind(*name)
                .bind(now)
                .execute(&mut *tx)
                .await?;
            }
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn save_mod_relations(
        pool: &SqlitePool,
        relations: &[ModRelationRecord],
    ) -> Result<(), sqlx::Error> {
        if relations.is_empty() {
            return Ok(());
        }

        let mut tx = pool.begin().await?;
        let now = chrono::Utc::now().timestamp();

        for rel in relations {
            let src_id = if rel.source_type == "mod_id" {
                rel.source_identifier.trim().to_lowercase()
            } else {
                rel.source_identifier.trim().to_string()
            };
            let tgt_id = if rel.target_type == "mod_id" {
                rel.target_identifier.trim().to_lowercase()
            } else {
                rel.target_identifier.trim().to_string()
            };

            if src_id.is_empty() || tgt_id.is_empty() || src_id == tgt_id {
                continue;
            }

            sqlx::query(
                "INSERT INTO mod_relations (
                    source_identifier, source_type, target_identifier, target_type,
                    relation_type, version_requirement, target_name_hint, source_provider, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (source_identifier, target_identifier, relation_type) DO UPDATE SET
                    target_type = excluded.target_type,
                    version_requirement = COALESCE(excluded.version_requirement, mod_relations.version_requirement),
                    target_name_hint = COALESCE(excluded.target_name_hint, mod_relations.target_name_hint),
                    source_provider = excluded.source_provider,
                    updated_at = excluded.updated_at;",
            )
            .bind(&src_id)
            .bind(&rel.source_type)
            .bind(&tgt_id)
            .bind(&rel.target_type)
            .bind(&rel.relation_type)
            .bind(&rel.version_requirement)
            .bind(&rel.target_name_hint)
            .bind(&rel.source_provider)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn query_mod_dependencies(
        pool: &SqlitePool,
        identifiers: &[String],
    ) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
        if identifiers.is_empty() {
            return Ok(Vec::new());
        }

        let placeholders = identifiers.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT source_identifier, source_type, target_identifier, target_type,
                    relation_type, version_requirement, target_name_hint, source_provider
             FROM mod_relations
             WHERE source_identifier IN ({})",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, String)>(&sql);
        for id in identifiers {
            query = query.bind(id.trim().to_lowercase());
        }

        let rows = query.fetch_all(pool).await?;
        let result = rows
            .into_iter()
            .map(|(src_id, src_type, tgt_id, tgt_type, rel_type, ver, hint, prov)| ModRelationRecord {
                source_identifier: src_id,
                source_type: src_type,
                target_identifier: tgt_id,
                target_type: tgt_type,
                relation_type: rel_type,
                version_requirement: ver,
                target_name_hint: hint,
                source_provider: prov,
            })
            .collect();

        Ok(result)
    }

    pub async fn query_mod_dependents(
        pool: &SqlitePool,
        identifiers: &[String],
    ) -> Result<Vec<ModRelationRecord>, sqlx::Error> {
        if identifiers.is_empty() {
            return Ok(Vec::new());
        }

        let placeholders = identifiers.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "SELECT source_identifier, source_type, target_identifier, target_type,
                    relation_type, version_requirement, target_name_hint, source_provider
             FROM mod_relations
             WHERE target_identifier IN ({})",
            placeholders
        );

        let mut query = sqlx::query_as::<_, (String, String, String, String, String, Option<String>, Option<String>, String)>(&sql);
        for id in identifiers {
            query = query.bind(id.trim().to_lowercase());
        }

        let rows = query.fetch_all(pool).await?;
        let result = rows
            .into_iter()
            .map(|(src_id, src_type, tgt_id, tgt_type, rel_type, ver, hint, prov)| ModRelationRecord {
                source_identifier: src_id,
                source_type: src_type,
                target_identifier: tgt_id,
                target_type: tgt_type,
                relation_type: rel_type,
                version_requirement: ver,
                target_name_hint: hint,
                source_provider: prov,
            })
            .collect();

        Ok(result)
    }
}

#[derive(sqlx::FromRow)]
struct RawInstanceModQueryResult {
    file_name: String,
    is_enabled: bool,
    file_size: i64,
    modified_at: i64,
    sha1: Option<String>,
    curseforge_fingerprint: Option<i64>,
    mod_id: Option<String>,
    name: Option<String>,
    version: Option<String>,
    description: Option<String>,
    icon_rel_path: Option<String>,
    icon_source: Option<String>,
    aliases: Option<String>,
    source_platform: Option<String>,
    source_project_id: Option<String>,
    source_file_id: Option<String>,
}

impl DbService {
    pub async fn query_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
    ) -> Result<Vec<EnrichedInstanceModRow>, sqlx::Error> {
        let raw_rows = sqlx::query_as::<_, RawInstanceModQueryResult>(
            "SELECT 
                im.file_name, im.is_enabled, im.file_size, im.modified_at, im.sha1, im.curseforge_fingerprint,
                im.mod_id, COALESCE(im.custom_display_name, g.name) AS name, im.version,
                g.description, g.icon_rel_path, g.icon_source, g.aliases,
                im.source_platform, im.source_project_id, im.source_file_id
             FROM instance_mods im
             LEFT JOIN mod_global_metadata_cache g ON im.mod_id = g.mod_id
             WHERE im.instance_id = ?
             ORDER BY im.is_enabled DESC, im.file_name ASC;"
        )
        .bind(instance_id)
        .fetch_all(pool)
        .await?;

        if raw_rows.is_empty() {
            return Ok(Vec::new());
        }

        // 收集当前实例中所有的标识符，批量走索引查询关系表
        let mut instance_all_identifiers = std::collections::HashSet::new();
        for r in &raw_rows {
            if let Some(ref mid) = r.mod_id {
                let trimmed = mid.trim().to_lowercase();
                if !trimmed.is_empty() {
                    instance_all_identifiers.insert(trimmed);
                }
            }
            let fn_trim = r.file_name.trim().to_lowercase();
            if !fn_trim.is_empty() {
                instance_all_identifiers.insert(fn_trim);
            }
            if let Some(ref pid) = r.source_project_id {
                let pid_trim = pid.trim().to_lowercase();
                if !pid_trim.is_empty() {
                    instance_all_identifiers.insert(pid_trim);
                }
            }
        }

        let identifiers_vec: Vec<String> = instance_all_identifiers.iter().cloned().collect();
        let forward_relations = Self::query_mod_dependencies(pool, &identifiers_vec).await.unwrap_or_default();
        let reverse_relations = Self::query_mod_dependents(pool, &identifiers_vec).await.unwrap_or_default();

        // 1. 构建前向必需依赖映射: source_id -> Vec<target_id>
        let mut forward_map: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
        for rel in forward_relations {
            if rel.relation_type == "required" {
                forward_map.entry(rel.source_identifier.to_lowercase()).or_default().push(rel.target_identifier);
            }
        }

        // 2. 构建反向附属映射: target_id -> Set of source_identifiers (仅限本实例已安装的 mod)
        let mut reverse_map: std::collections::HashMap<String, std::collections::HashSet<String>> = std::collections::HashMap::new();
        for rel in reverse_relations {
            let src_lower = rel.source_identifier.to_lowercase();
            if rel.relation_type == "required" && instance_all_identifiers.contains(&src_lower) {
                reverse_map.entry(rel.target_identifier.to_lowercase()).or_default().insert(src_lower);
            }
        }

        let result = raw_rows
            .into_iter()
            .map(|r| {
                let mut deps = Vec::new();
                let mut matched_dependents = std::collections::HashSet::new();

                let keys = [
                    r.mod_id.as_deref(),
                    Some(r.file_name.as_str()),
                    r.source_project_id.as_deref(),
                ];

                for k in keys.into_iter().flatten() {
                    let lower_k = k.trim().to_lowercase();
                    if let Some(targets) = forward_map.get(&lower_k) {
                        for t in targets {
                            if !deps.contains(t) {
                                deps.push(t.clone());
                            }
                        }
                    }
                    if let Some(srcs) = reverse_map.get(&lower_k) {
                        for s in srcs {
                            matched_dependents.insert(s.clone());
                        }
                    }
                }

                let dependents_count = matched_dependents.len() as i64;
                let dependencies = if deps.is_empty() { None } else { Some(deps) };

                EnrichedInstanceModRow {
                    file_name: r.file_name,
                    is_enabled: r.is_enabled,
                    file_size: r.file_size,
                    modified_at: r.modified_at,
                    sha1: r.sha1,
                    curseforge_fingerprint: r.curseforge_fingerprint.map(|v| v as u32),
                    mod_id: r.mod_id,
                    name: r.name,
                    version: r.version,
                    description: r.description,
                    icon_rel_path: r.icon_rel_path,
                    icon_source: r.icon_source,
                    aliases: r.aliases,
                    source_platform: r.source_platform,
                    source_project_id: r.source_project_id,
                    source_file_id: r.source_file_id,
                    dependents_count,
                    dependencies,
                }
            })
            .collect();

        Ok(result)
    }

    pub async fn upsert_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
        mods: &[InstanceModDbRow],
    ) -> Result<(), sqlx::Error> {
        if mods.is_empty() {
            return Ok(());
        }

        let mut tx = pool.begin().await?;
        let now = chrono::Utc::now().timestamp();

        for m in mods {
            sqlx::query(
                "INSERT INTO instance_mods (
                    instance_id, file_name, is_enabled, file_size, modified_at,
                    sha1, curseforge_fingerprint, mod_id, custom_display_name, version,
                    source_platform, source_project_id, source_file_id, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(instance_id, file_name) DO UPDATE SET
                    is_enabled = excluded.is_enabled,
                    file_size = excluded.file_size,
                    modified_at = excluded.modified_at,
                    sha1 = COALESCE(excluded.sha1, instance_mods.sha1),
                    curseforge_fingerprint = COALESCE(excluded.curseforge_fingerprint, instance_mods.curseforge_fingerprint),
                    mod_id = COALESCE(excluded.mod_id, instance_mods.mod_id),
                    custom_display_name = COALESCE(excluded.custom_display_name, instance_mods.custom_display_name),
                    version = COALESCE(excluded.version, instance_mods.version),
                    source_platform = COALESCE(excluded.source_platform, instance_mods.source_platform),
                    source_project_id = COALESCE(excluded.source_project_id, instance_mods.source_project_id),
                    source_file_id = COALESCE(excluded.source_file_id, instance_mods.source_file_id),
                    updated_at = excluded.updated_at;"
            )
            .bind(instance_id)
            .bind(&m.file_name)
            .bind(m.is_enabled)
            .bind(m.file_size)
            .bind(m.modified_at)
            .bind(&m.sha1)
            .bind(m.curseforge_fingerprint.map(|v| v as i64))
            .bind(&m.mod_id)
            .bind(&m.custom_display_name)
            .bind(&m.version)
            .bind(&m.source_platform)
            .bind(&m.source_project_id)
            .bind(&m.source_file_id)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn delete_instance_mods(
        pool: &SqlitePool,
        instance_id: &str,
        file_names: &[String],
    ) -> Result<(), sqlx::Error> {
        if file_names.is_empty() {
            return Ok(());
        }

        let placeholders = file_names.iter().map(|_| "?").collect::<Vec<_>>().join(",");
        let sql = format!(
            "DELETE FROM instance_mods WHERE instance_id = ? AND file_name IN ({})",
            placeholders
        );

        let mut query = sqlx::query(&sql).bind(instance_id);
        for f in file_names {
            query = query.bind(f);
        }

        query.execute(pool).await?;
        Ok(())
    }

    pub async fn toggle_instance_mod(
        pool: &SqlitePool,
        instance_id: &str,
        old_file_name: &str,
        new_file_name: &str,
        is_enabled: bool,
    ) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "UPDATE instance_mods 
             SET file_name = ?, is_enabled = ?, updated_at = ?
             WHERE instance_id = ? AND file_name = ?;"
        )
        .bind(new_file_name)
        .bind(is_enabled)
        .bind(now)
        .bind(instance_id)
        .bind(old_file_name)
        .execute(pool)
        .await?;

        Ok(())
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct InstanceModDbRow {
    pub instance_id: String,
    pub file_name: String,
    pub is_enabled: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
    pub mod_id: Option<String>,
    pub custom_display_name: Option<String>,
    pub version: Option<String>,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct EnrichedInstanceModRow {
    pub file_name: String,
    pub is_enabled: bool,
    pub file_size: i64,
    pub modified_at: i64,
    pub sha1: Option<String>,
    pub curseforge_fingerprint: Option<u32>,
    pub mod_id: Option<String>,
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub icon_rel_path: Option<String>,
    pub icon_source: Option<String>,
    pub aliases: Option<String>,
    pub source_platform: Option<String>,
    pub source_project_id: Option<String>,
    pub source_file_id: Option<String>,
    pub dependents_count: i64,
    pub dependencies: Option<Vec<String>>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModRelationRecord {
    pub source_identifier: String,
    pub source_type: String,
    pub target_identifier: String,
    pub target_type: String,
    pub relation_type: String,
    pub version_requirement: Option<String>,
    pub target_name_hint: Option<String>,
    pub source_provider: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mod_relations_uniqueness_and_queries() {
        let pool = SqlitePoolOptions::new()
            .connect("sqlite::memory:")
            .await
            .unwrap();

        DbService::create_tables(&pool).await.unwrap();
        DbService::run_migrations(&pool).await.unwrap();

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

        DbService::create_tables(&pool).await.unwrap();
        DbService::run_migrations(&pool).await.unwrap();

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
