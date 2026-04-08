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
            sqlx::query("ALTER TABLE trusted_devices ADD COLUMN trust_level TEXT DEFAULT 'trusted'")
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
            ("transfer_uuid", "ALTER TABLE transfers ADD COLUMN transfer_uuid TEXT"),
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

        Ok(())
    }
}
