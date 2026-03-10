// src-tauri/src/services/db_service.rs
use sqlx::{sqlite::{SqliteConnectOptions, SqlitePoolOptions}, SqlitePool};
use std::path::Path;
use std::fs;

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
        Self::create_tables(&pool).await.map_err(|e| e.to_string())?;

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
            "
        ).execute(pool).await?;

        Ok(())
    }
}