use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use std::fs;
use std::path::Path;

const INITIAL_SCHEMA_MIGRATION_VERSION: i64 = 20_260_101_000_001;
// This is the checksum written by the short-lived first build of the initial
// SQLx migration. The migration was adjusted before release, which otherwise
// causes SQLx to reject that database on every subsequent launch.
const LEGACY_INITIAL_SCHEMA_CHECKSUM: &str =
    "DFE851319A16193D78479A1B993BFA75F0117A57861415BBB013DDAB28313C8D4409926834E1C57007D6FFEB74501718";

pub struct AppDatabase {
    pub pool: SqlitePool,
}

async fn repair_known_initial_schema_checksum(
    pool: &SqlitePool,
    migrator: &sqlx::migrate::Migrator,
) -> Result<(), String> {
    let migration_table_exists: i64 = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations')",
    )
    .fetch_one(pool)
    .await
    .map_err(|error| error.to_string())?;

    if migration_table_exists == 0 {
        return Ok(());
    }

    let Some(stored_checksum) = sqlx::query_scalar::<_, Vec<u8>>(
        "SELECT checksum FROM _sqlx_migrations WHERE version = ? AND success = 1",
    )
    .bind(INITIAL_SCHEMA_MIGRATION_VERSION)
    .fetch_optional(pool)
    .await
    .map_err(|error| error.to_string())?
    else {
        return Ok(());
    };

    let legacy_checksum = hex::decode(LEGACY_INITIAL_SCHEMA_CHECKSUM)
        .map_err(|error| format!("invalid legacy migration checksum constant: {error}"))?;
    if stored_checksum != legacy_checksum {
        return Ok(());
    }

    let current_checksum = migrator
        .iter()
        .find(|migration| migration.version == INITIAL_SCHEMA_MIGRATION_VERSION)
        .map(|migration| migration.checksum.as_ref())
        .ok_or_else(|| "initial schema migration is missing from the embedded migration set".to_string())?;

    if stored_checksum == current_checksum {
        return Ok(());
    }

    sqlx::query("UPDATE _sqlx_migrations SET checksum = ? WHERE version = ?")
        .bind(current_checksum)
        .bind(INITIAL_SCHEMA_MIGRATION_VERSION)
        .execute(pool)
        .await
        .map_err(|error| error.to_string())?;

    log::warn!(
        "repaired the checksum metadata for the known legacy initial database migration"
    );
    Ok(())
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
        .busy_timeout(std::time::Duration::from_secs(15));

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .min_connections(1)
        .acquire_timeout(std::time::Duration::from_secs(15))
        .after_connect(|conn, _meta| {
            Box::pin(async move {
                sqlx::query(
                    "PRAGMA foreign_keys = ON; PRAGMA temp_store = MEMORY; PRAGMA cache_size = -20000; PRAGMA busy_timeout = 15000;",
                )
                .execute(conn)
                .await?;
                Ok(())
            })
        })
        .connect_with(connect_options)
        .await
        .map_err(|e| e.to_string())?;

    // Run SQLx declarative migrations embedded from src-tauri/migrations/.
    // A pre-release build wrote a different checksum for the baseline
    // migration, so repair only that explicitly recognised legacy value first.
    let migrator = sqlx::migrate!("./migrations");
    repair_known_initial_schema_checksum(&pool, &migrator).await?;
    migrator
        .run(&pool)
        .await
        .map_err(|e| format!("Database migration failed: {}", e))?;

    // Seed builtin essential aliases
    super::seeds::seed_essential_aliases(&pool)
        .await
        .map_err(|e| format!("Failed to seed essential aliases: {}", e))?;

    Ok(pool)
}
