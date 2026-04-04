// src-tauri/src/services/db_service.rs
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::fs;
use std::path::Path;

// ✅ 全局数据库状态包装器，由于 SqlitePool 内部自带并发控制，不再需要 Mutex！
pub struct AppDatabase {
    pub pool: SqlitePool,
}

pub struct DbService;

impl DbService {
    // 改为异步初始化
    pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, String> {
        if !config_dir.exists() {
            fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
        }
        let db_path = config_dir.join("pilauncher_data.db");

        // 配置 SQLite，如果文件不存在则自动创建
        let connect_options = SqliteConnectOptions::new()
            .filename(&db_path)
            .create_if_missing(true);

        // 创建连接池
        let pool = SqlitePoolOptions::new()
            .connect_with(connect_options)
            .await
            .map_err(|e| e.to_string())?;

        // 执行异步建表
        Self::create_tables(&pool)
            .await
            .map_err(|e| e.to_string())?;

        // 迁移：为旧数据库补充 user_uuid 列
        Self::run_migrations(&pool)
            .await
            .map_err(|e| e.to_string())?;

        Ok(pool)
    }

    async fn create_tables(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        // sqlx 支持直接执行多条建表语句
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
                trust_level TEXT,
                trusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_used TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            );

            CREATE TABLE IF NOT EXISTS transfers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_user_id INTEGER,
                receiver_user_id INTEGER,
                sender_device TEXT NOT NULL,
                receiver_device TEXT NOT NULL,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                size INTEGER NOT NULL,
                hash TEXT,
                status TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (sender_user_id) REFERENCES users(id),
                FOREIGN KEY (receiver_user_id) REFERENCES users(id)
            );

            -- ============== Library (库) System ================= --
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

            -- Indexes for Library System --
            CREATE INDEX IF NOT EXISTS idx_starred_type ON starred_items(type);
            CREATE INDEX IF NOT EXISTS idx_starred_updated ON starred_items(updated_at);
            CREATE INDEX IF NOT EXISTS idx_starred_project ON starred_items(source, project_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
            CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);
            ",
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
        // 检查 trusted_devices 表是否已经有 user_uuid 列
        let rows = sqlx::query("PRAGMA table_info(trusted_devices)")
            .fetch_all(pool)
            .await?;

        let has_user_uuid = rows.iter().any(|row| {
            let col_name: String = sqlx::Row::get(row, "name");
            col_name == "user_uuid"
        });

        if !has_user_uuid {
            sqlx::query("ALTER TABLE trusted_devices ADD COLUMN user_uuid TEXT DEFAULT ''")
                .execute(pool)
                .await?;
        }

        // 迁移 2: 补充 username 列
        let has_username = rows.iter().any(|row| {
            let col_name: String = sqlx::Row::get(row, "name");
            col_name == "username"
        });

        if !has_username {
            sqlx::query("ALTER TABLE trusted_devices ADD COLUMN username TEXT DEFAULT ''")
                .execute(pool)
                .await?;
        }

        Ok(())
    }
}
