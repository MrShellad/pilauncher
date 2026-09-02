-- 20260903000001_create_achievement_and_session_tables.sql
-- Achievement and Game Session Tracking Schema for PiLauncher

CREATE TABLE IF NOT EXISTS game_sessions (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    world_name TEXT,
    player_uuid TEXT NOT NULL,
    player_name TEXT,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration_secs INTEGER NOT NULL,
    exit_code INTEGER DEFAULT 0,
    new_advancements_count INTEGER DEFAULT 0,
    summary_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_instance ON game_sessions(instance_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_player ON game_sessions(player_uuid, started_at DESC);

CREATE TABLE IF NOT EXISTS instance_advancements (
    id TEXT PRIMARY KEY,
    instance_id TEXT NOT NULL,
    world_name TEXT NOT NULL,
    player_uuid TEXT NOT NULL,
    advancement_id TEXT NOT NULL,
    frame_type TEXT NOT NULL,
    session_id TEXT,
    unlocked_at INTEGER NOT NULL,
    is_first_career_unlock BOOLEAN DEFAULT 0,
    criteria_json TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES game_sessions(id) ON DELETE SET NULL,
    UNIQUE(instance_id, world_name, player_uuid, advancement_id)
);

CREATE INDEX IF NOT EXISTS idx_advancements_query ON instance_advancements(instance_id, world_name, player_uuid);
CREATE INDEX IF NOT EXISTS idx_advancements_unlocked ON instance_advancements(unlocked_at DESC);
CREATE INDEX IF NOT EXISTS idx_advancements_id ON instance_advancements(advancement_id);

CREATE TABLE IF NOT EXISTS advancement_metadata_cache (
    advancement_id TEXT PRIMARY KEY,
    namespace TEXT NOT NULL,
    parent_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    frame_type TEXT NOT NULL,
    icon_rel_path TEXT NOT NULL,
    source_type TEXT NOT NULL DEFAULT 'vanilla',
    source_hash TEXT,
    updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meta_namespace ON advancement_metadata_cache(namespace);

CREATE TABLE IF NOT EXISTS instance_player_stats (
    instance_id TEXT NOT NULL,
    world_name TEXT NOT NULL,
    player_uuid TEXT NOT NULL,
    stat_category TEXT NOT NULL,
    stat_key TEXT NOT NULL,
    stat_value INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (instance_id, world_name, player_uuid, stat_category, stat_key),
    FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
);
