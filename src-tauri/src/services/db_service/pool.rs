use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::fs;
use std::path::Path;

pub struct AppDatabase {
    pub pool: SqlitePool,
}

pub async fn init_db(config_dir: &Path) -> Result<SqlitePool, String> {
    if !config_dir.exists() {
        fs::create_dir_all(config_dir).map_err(|e| e.to_string())?;
    }
    let db_path = config_dir.join("pilauncher_data.db");

    let connect_options = SqliteConnectOptions::new()
        .filename(&db_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal)
        .busy_timeout(std::time::Duration::from_secs(30));

    let pool = SqlitePoolOptions::new()
        .max_connections(10)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(30))
        .connect_with(connect_options)
        .await
        .map_err(|e| e.to_string())?;

    let _ = sqlx::query("PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY; PRAGMA cache_size = -20000;").execute(&pool).await;

    // Run SQLx declarative migrations embedded from src-tauri/migrations/
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .map_err(|e| format!("Database migration failed: {}", e))?;

    // Seed builtin essential aliases
    super::seeds::seed_essential_aliases(&pool)
        .await
        .map_err(|e| format!("Failed to seed essential aliases: {}", e))?;

    Ok(pool)
}
