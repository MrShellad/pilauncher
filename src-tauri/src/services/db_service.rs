use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::fs;
use std::path::Path;

pub struct AppDatabase {
    pub pool: SqlitePool,
}

pub struct DbService;

impl DbService {
    pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, String> {
        if !config_dir.exists() {
            fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
        }
        let db_path = config_dir.join("pilauncher_data.db");

        let connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .connect_with(connect_options)
            .await
            .map_err(|e| e.to_string())?;

        // Enable WAL mode & Normal Sync for better concurrent performance
        let _ = sqlx::query("PRAGMA journal_mode=WAL;").execute(&pool).await;
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

            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT
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

            CREATE INDEX IF NOT EXISTS idx_starred_type ON starred_items(type);
            CREATE INDEX IF NOT EXISTS idx_starred_updated ON starred_items(updated_at);
            CREATE INDEX IF NOT EXISTS idx_starred_project ON starred_items(source, project_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);

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
                tags TEXT,
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
            ("tags", "ALTER TABLE instances ADD COLUMN tags TEXT"),
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
}
