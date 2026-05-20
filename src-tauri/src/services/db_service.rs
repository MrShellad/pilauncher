use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    Row, SqlitePool,
};
use std::fs;
use std::path::Path;

pub struct AppDatabase {
    pub pool: SqlitePool,
}

pub struct DbService;

impl DbService {
    const CURRENT_SCHEMA_VERSION: i64 = 4;

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
}
