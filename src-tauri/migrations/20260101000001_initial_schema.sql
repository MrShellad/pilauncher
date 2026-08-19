-- 20260101000001_initial_schema.sql
-- Baseline initial schema for PiLauncher database

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

CREATE INDEX IF NOT EXISTS idx_starred_type ON starred_items(type);
CREATE INDEX IF NOT EXISTS idx_starred_updated ON starred_items(updated_at);
CREATE INDEX IF NOT EXISTS idx_starred_project ON starred_items(source, project_id);

CREATE TABLE IF NOT EXISTS favorite_tombstones (
    item_id TEXT PRIMARY KEY,
    deleted_at INTEGER NOT NULL
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

CREATE INDEX IF NOT EXISTS idx_collection_items_collection ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_items_item ON collection_items(item_id);

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

CREATE INDEX IF NOT EXISTS idx_mod_set_trackers_collection ON mod_set_trackers(collection_id);

CREATE TABLE IF NOT EXISTS library_resource_mappings (
    id TEXT PRIMARY KEY,
    resource_id TEXT NOT NULL,
    instance_id TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    target_filename TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (resource_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_library_resource_mappings_resource ON library_resource_mappings(resource_id);
CREATE INDEX IF NOT EXISTS idx_library_resource_mappings_instance ON library_resource_mappings(instance_id);

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

CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_instance_tags_instance ON instance_tags(instance_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_instance_tags_tag ON instance_tags(tag_id);

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

CREATE INDEX IF NOT EXISTS idx_instance_servers_instance ON instance_servers(instance_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_servers_address ON servers(address, port);

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

CREATE INDEX IF NOT EXISTS idx_logshare_history_log_id ON logshare_history(log_id);
CREATE INDEX IF NOT EXISTS idx_logshare_history_expires_at ON logshare_history(expires_at);
