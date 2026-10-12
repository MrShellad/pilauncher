use crate::domain::library::{
    Collection, CollectionItem, FavoriteTombstone, LibraryExportFile, LibraryImportOptions,
    LibraryImportPreview, LibraryImportResult, ModSetTracker, StarredItem,
};
use serde_json::Value;
use sqlx::{Row, SqlitePool};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;

pub struct LibraryService;

const LIBRARY_EXPORT_SCHEMA_VERSION: i32 = 1;

impl LibraryService {
    // ------------------------------------------------------------------------
    // StarredItems
    // ------------------------------------------------------------------------

    pub async fn get_starred_items(pool: &SqlitePool) -> Result<Vec<StarredItem>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, type, source, project_id, title, author, snapshot, state, meta, created_at, updated_at 
             FROM starred_items ORDER BY updated_at DESC"
        )
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| StarredItem {
                id: row.get("id"),
                r#type: row.get("type"),
                source: row.get("source"),
                project_id: row.get("project_id"),
                title: row.get("title"),
                author: row.get("author"),
                snapshot: row.get("snapshot"),
                state: row.get("state"),
                meta: row.get("meta"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(items)
    }

    pub async fn save_starred_item(
        pool: &SqlitePool,
        item: &StarredItem,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO starred_items (id, type, source, project_id, title, author, snapshot, state, meta, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                type=excluded.type,
                source=excluded.source,
                project_id=excluded.project_id,
                title=excluded.title,
                author=excluded.author,
                snapshot=excluded.snapshot,
                state=excluded.state,
                meta=excluded.meta,
                updated_at=excluded.updated_at"
        )
        .bind(&item.id)
        .bind(&item.r#type)
        .bind(&item.source)
        .bind(&item.project_id)
        .bind(&item.title)
        .bind(&item.author)
        .bind(&item.snapshot)
        .bind(&item.state)
        .bind(&item.meta)
        .bind(item.created_at)
        .bind(item.updated_at)
        .execute(pool)
        .await?;

        sqlx::query("DELETE FROM favorite_tombstones WHERE item_id = ?")
            .bind(&item.id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn remove_starred_item(pool: &SqlitePool, item_id: &str) -> Result<(), sqlx::Error> {
        let deleted_at = Self::now_seconds();
        Self::apply_favorite_tombstone(
            pool,
            &FavoriteTombstone {
                item_id: item_id.to_string(),
                deleted_at,
            },
        )
        .await
    }

    pub async fn get_favorite_tombstones(
        pool: &SqlitePool,
    ) -> Result<Vec<FavoriteTombstone>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT item_id, deleted_at
             FROM favorite_tombstones
             ORDER BY deleted_at DESC",
        )
        .fetch_all(pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|row| FavoriteTombstone {
                item_id: row.get("item_id"),
                deleted_at: row.get("deleted_at"),
            })
            .collect())
    }

    pub async fn apply_favorite_tombstone(
        pool: &SqlitePool,
        tombstone: &FavoriteTombstone,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM starred_items WHERE id = ?")
            .bind(&tombstone.item_id)
            .execute(pool)
            .await?;

        // Also remove from any collections
        sqlx::query("DELETE FROM collection_items WHERE item_id = ?")
            .bind(&tombstone.item_id)
            .execute(pool)
            .await?;

        sqlx::query(
            "INSERT INTO favorite_tombstones (item_id, deleted_at)
             VALUES (?, ?)
             ON CONFLICT(item_id) DO UPDATE SET
                deleted_at = MAX(favorite_tombstones.deleted_at, excluded.deleted_at)",
        )
        .bind(&tombstone.item_id)
        .bind(tombstone.deleted_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    // Collections
    // ------------------------------------------------------------------------

    pub async fn get_collections(pool: &SqlitePool) -> Result<Vec<Collection>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, name, description, type, cover_image, sort_order, created_at, updated_at 
             FROM collections ORDER BY sort_order ASC, created_at DESC",
        )
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| Collection {
                id: row.get("id"),
                name: row.get("name"),
                description: row.get("description"),
                r#type: row.get("type"),
                cover_image: row.get("cover_image"),
                sort_order: row.get("sort_order"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            })
            .collect();

        Ok(items)
    }

    pub async fn save_collection(pool: &SqlitePool, item: &Collection) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO collections (id, name, description, type, cover_image, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                description=excluded.description,
                type=excluded.type,
                cover_image=excluded.cover_image,
                sort_order=excluded.sort_order,
                updated_at=excluded.updated_at"
        )
        .bind(&item.id)
        .bind(&item.name)
        .bind(&item.description)
        .bind(&item.r#type)
        .bind(&item.cover_image)
        .bind(item.sort_order)
        .bind(item.created_at)
        .bind(item.updated_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn remove_collection(
        pool: &SqlitePool,
        collection_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM collections WHERE id = ?")
            .bind(collection_id)
            .execute(pool)
            .await?;

        sqlx::query("DELETE FROM collection_items WHERE collection_id = ?")
            .bind(collection_id)
            .execute(pool)
            .await?;

        sqlx::query("DELETE FROM mod_set_trackers WHERE collection_id = ?")
            .bind(collection_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    // Collection Items
    // ------------------------------------------------------------------------

    pub async fn get_collection_items(
        pool: &SqlitePool,
        collection_id: &str,
    ) -> Result<Vec<CollectionItem>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, collection_id, item_id, position, extra, created_at
             FROM collection_items WHERE collection_id = ? ORDER BY position ASC",
        )
        .bind(collection_id)
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| CollectionItem {
                id: row.get("id"),
                collection_id: row.get("collection_id"),
                item_id: row.get("item_id"),
                position: row.get("position"),
                extra: row.get("extra"),
                created_at: row.get("created_at"),
            })
            .collect();

        Ok(items)
    }

    pub async fn get_all_collection_items(
        pool: &SqlitePool,
    ) -> Result<Vec<CollectionItem>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, collection_id, item_id, position, extra, created_at FROM collection_items ORDER BY collection_id ASC, position ASC",
        )
        .fetch_all(pool)
        .await?;

        let items = rows
            .into_iter()
            .map(|row| CollectionItem {
                id: row.get("id"),
                collection_id: row.get("collection_id"),
                item_id: row.get("item_id"),
                position: row.get("position"),
                extra: row.get("extra"),
                created_at: row.get("created_at"),
            })
            .collect();

        Ok(items)
    }

    pub async fn save_collection_item(
        pool: &SqlitePool,
        item: &CollectionItem,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO collection_items (id, collection_id, item_id, position, extra, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(collection_id, item_id) DO UPDATE SET
                position=excluded.position,
                extra=excluded.extra",
        )
        .bind(&item.id)
        .bind(&item.collection_id)
        .bind(&item.item_id)
        .bind(item.position)
        .bind(&item.extra)
        .bind(item.created_at)
        .execute(pool)
        .await?;

        Ok(())
    }

    pub async fn save_collection_items(
        pool: &SqlitePool,
        items: &[CollectionItem],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        for item in items {
            sqlx::query(
                "INSERT INTO collection_items (id, collection_id, item_id, position, extra, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(collection_id, item_id) DO UPDATE SET
                    position=excluded.position,
                    extra=excluded.extra",
            )
            .bind(&item.id)
            .bind(&item.collection_id)
            .bind(&item.item_id)
            .bind(item.position)
            .bind(&item.extra)
            .bind(item.created_at)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn remove_collection_item(
        pool: &SqlitePool,
        collection_id: &str,
        item_id: &str,
    ) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?")
            .bind(collection_id)
            .bind(item_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    pub async fn remove_collection_items(
        pool: &SqlitePool,
        collection_id: &str,
        item_ids: &[String],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        for item_id in item_ids {
            sqlx::query("DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?")
                .bind(collection_id)
                .bind(item_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn reorder_collection_items(
        pool: &SqlitePool,
        collection_id: &str,
        ordered_item_ids: &[String],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        for (index, item_id) in ordered_item_ids.iter().enumerate() {
            sqlx::query(
                "UPDATE collection_items SET position = ? WHERE collection_id = ? AND item_id = ?",
            )
            .bind((index + 1) as i32)
            .bind(collection_id)
            .bind(item_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Mod Set Trackers
    // ------------------------------------------------------------------------

    pub async fn get_mod_set_trackers(
        pool: &SqlitePool,
    ) -> Result<Vec<ModSetTracker>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, collection_id, collection_name, game_version, loader, readiness_status,
                    ready_count, total_count, projects_json, items_json, last_checked_at,
                    notified_ready_at, created_at, updated_at
             FROM mod_set_trackers ORDER BY updated_at DESC",
        )
        .fetch_all(pool)
        .await?;

        let trackers = rows
            .into_iter()
            .map(|row| {
                let projects_json: String = row.get("projects_json");
                let items_json: String = row.get("items_json");

                ModSetTracker {
                    id: row.get("id"),
                    collection_id: row.get("collection_id"),
                    collection_name: row.get("collection_name"),
                    game_version: row.get("game_version"),
                    loader: row.get("loader"),
                    readiness_status: row.get("readiness_status"),
                    ready_count: row.get("ready_count"),
                    total_count: row.get("total_count"),
                    projects: serde_json::from_str::<Value>(&projects_json)
                        .unwrap_or_else(|_| Value::Array(Vec::new())),
                    items: serde_json::from_str::<Value>(&items_json)
                        .unwrap_or_else(|_| Value::Array(Vec::new())),
                    last_checked_at: row.get("last_checked_at"),
                    notified_ready_at: row.get("notified_ready_at"),
                    created_at: row.get("created_at"),
                    updated_at: row.get("updated_at"),
                }
            })
            .collect();

        Ok(trackers)
    }

    pub async fn replace_mod_set_trackers(
        pool: &SqlitePool,
        trackers: &[ModSetTracker],
    ) -> Result<(), sqlx::Error> {
        let mut tx = pool.begin().await?;

        sqlx::query("DELETE FROM mod_set_trackers")
            .execute(&mut *tx)
            .await?;

        for tracker in trackers {
            sqlx::query(
                "INSERT INTO mod_set_trackers (
                    id, collection_id, collection_name, game_version, loader, readiness_status,
                    ready_count, total_count, projects_json, items_json, last_checked_at,
                    notified_ready_at, created_at, updated_at
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            )
            .bind(&tracker.id)
            .bind(&tracker.collection_id)
            .bind(&tracker.collection_name)
            .bind(&tracker.game_version)
            .bind(&tracker.loader)
            .bind(&tracker.readiness_status)
            .bind(tracker.ready_count)
            .bind(tracker.total_count)
            .bind(tracker.projects.to_string())
            .bind(tracker.items.to_string())
            .bind(tracker.last_checked_at)
            .bind(tracker.notified_ready_at)
            .bind(tracker.created_at)
            .bind(tracker.updated_at)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    // ------------------------------------------------------------------------
    // Library Import / Export
    // ------------------------------------------------------------------------

    pub async fn export_library_data(
        pool: &SqlitePool,
        path: &str,
    ) -> Result<LibraryExportFile, String> {
        let export_file = LibraryExportFile {
            schema_version: LIBRARY_EXPORT_SCHEMA_VERSION,
            exported_at: Self::now_seconds(),
            starred_items: Self::get_starred_items(pool)
                .await
                .map_err(|e| e.to_string())?,
            collections: Self::get_collections(pool)
                .await
                .map_err(|e| e.to_string())?,
            collection_items: Self::get_all_collection_items(pool)
                .await
                .map_err(|e| e.to_string())?,
            mod_set_trackers: Self::get_mod_set_trackers(pool)
                .await
                .map_err(|e| e.to_string())?,
        };

        let content = serde_json::to_string_pretty(&export_file).map_err(|e| e.to_string())?;
        if let Some(parent) = Path::new(path).parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::write(path, content).map_err(|e| e.to_string())?;

        Ok(export_file)
    }

    pub async fn preview_library_import(
        pool: &SqlitePool,
        path: &str,
        options: &LibraryImportOptions,
    ) -> Result<LibraryImportPreview, String> {
        let import_file = Self::read_library_export_file(path)?;
        let plan = Self::build_import_plan(pool, &import_file, options)
            .await
            .map_err(|e| e.to_string())?;

        Ok(LibraryImportPreview {
            schema_version: import_file.schema_version,
            starred_items: import_file.starred_items.len(),
            new_starred_items: plan.new_starred_count,
            duplicate_starred_items: plan.duplicate_starred_count,
            collections: import_file.collections.len(),
            new_collections: plan.new_collection_count,
            merged_tag_collections: plan.merged_tag_collection_count,
            collection_items: import_file.collection_items.len(),
            new_collection_items: plan.new_relation_count,
            duplicate_collection_items: plan.duplicate_relation_count,
            mod_set_trackers: import_file.mod_set_trackers.len(),
            importable_mod_set_trackers: plan.importable_tracker_count,
            warnings: plan.warnings,
        })
    }

    pub async fn import_library_data(
        pool: &SqlitePool,
        path: &str,
        options: &LibraryImportOptions,
    ) -> Result<LibraryImportResult, String> {
        let import_file = Self::read_library_export_file(path)?;
        let plan = Self::build_import_plan(pool, &import_file, options)
            .await
            .map_err(|e| e.to_string())?;

        let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

        for item in &plan.starred_to_insert {
            sqlx::query(
                "INSERT INTO starred_items (id, type, source, project_id, title, author, snapshot, state, meta, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    type=excluded.type,
                    source=excluded.source,
                    project_id=excluded.project_id,
                    title=excluded.title,
                    author=excluded.author,
                    snapshot=excluded.snapshot,
                    state=excluded.state,
                    meta=excluded.meta,
                    updated_at=excluded.updated_at",
            )
            .bind(&item.id)
            .bind(&item.r#type)
            .bind(&item.source)
            .bind(&item.project_id)
            .bind(&item.title)
            .bind(&item.author)
            .bind(&item.snapshot)
            .bind(&item.state)
            .bind(&item.meta)
            .bind(item.created_at)
            .bind(item.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        for collection in &plan.collections_to_insert {
            sqlx::query(
                "INSERT INTO collections (id, name, description, type, cover_image, sort_order, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    name=excluded.name,
                    description=excluded.description,
                    type=excluded.type,
                    cover_image=excluded.cover_image,
                    sort_order=excluded.sort_order,
                    updated_at=excluded.updated_at",
            )
            .bind(&collection.id)
            .bind(&collection.name)
            .bind(&collection.description)
            .bind(&collection.r#type)
            .bind(&collection.cover_image)
            .bind(collection.sort_order)
            .bind(collection.created_at)
            .bind(collection.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        for relation in &plan.relations_to_insert {
            sqlx::query(
                "INSERT INTO collection_items (id, collection_id, item_id, position, extra, created_at)
                 VALUES (?, ?, ?, ?, ?, ?)
                 ON CONFLICT(collection_id, item_id) DO UPDATE SET
                    position=excluded.position,
                    extra=excluded.extra",
            )
            .bind(&relation.id)
            .bind(&relation.collection_id)
            .bind(&relation.item_id)
            .bind(relation.position)
            .bind(&relation.extra)
            .bind(relation.created_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        for tracker in &plan.trackers_to_insert {
            sqlx::query(
                "INSERT INTO mod_set_trackers (
                    id, collection_id, collection_name, game_version, loader, readiness_status,
                    ready_count, total_count, projects_json, items_json, last_checked_at,
                    notified_ready_at, created_at, updated_at
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON CONFLICT(id) DO UPDATE SET
                    collection_id=excluded.collection_id,
                    collection_name=excluded.collection_name,
                    game_version=excluded.game_version,
                    loader=excluded.loader,
                    readiness_status=excluded.readiness_status,
                    ready_count=excluded.ready_count,
                    total_count=excluded.total_count,
                    projects_json=excluded.projects_json,
                    items_json=excluded.items_json,
                    last_checked_at=excluded.last_checked_at,
                    notified_ready_at=excluded.notified_ready_at,
                    updated_at=excluded.updated_at",
            )
            .bind(&tracker.id)
            .bind(&tracker.collection_id)
            .bind(&tracker.collection_name)
            .bind(&tracker.game_version)
            .bind(&tracker.loader)
            .bind(&tracker.readiness_status)
            .bind(tracker.ready_count)
            .bind(tracker.total_count)
            .bind(tracker.projects.to_string())
            .bind(tracker.items.to_string())
            .bind(tracker.last_checked_at)
            .bind(tracker.notified_ready_at)
            .bind(tracker.created_at)
            .bind(tracker.updated_at)
            .execute(&mut *tx)
            .await
            .map_err(|e| e.to_string())?;
        }

        tx.commit().await.map_err(|e| e.to_string())?;

        Ok(LibraryImportResult {
            imported_starred_items: plan.starred_to_insert.len(),
            skipped_starred_items: plan.duplicate_starred_count,
            imported_collections: plan.collections_to_insert.len(),
            merged_tag_collections: plan.merged_tag_collection_count,
            imported_collection_items: plan.relations_to_insert.len(),
            skipped_collection_items: plan.duplicate_relation_count,
            imported_mod_set_trackers: plan.trackers_to_insert.len(),
            warnings: plan.warnings,
        })
    }

    fn now_seconds() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_secs() as i64)
            .unwrap_or(0)
    }

    fn read_library_export_file(path: &str) -> Result<LibraryExportFile, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        let import_file: LibraryExportFile =
            serde_json::from_str(&content).map_err(|e| format!("Invalid library backup: {}", e))?;

        if import_file.schema_version > LIBRARY_EXPORT_SCHEMA_VERSION {
            return Err(format!(
                "Unsupported library backup schema version: {}",
                import_file.schema_version
            ));
        }

        Ok(import_file)
    }

    async fn build_import_plan(
        pool: &SqlitePool,
        import_file: &LibraryExportFile,
        options: &LibraryImportOptions,
    ) -> Result<LibraryImportPlan, sqlx::Error> {
        let existing_items = Self::get_starred_items(pool).await?;
        let existing_collections = Self::get_collections(pool).await?;
        let existing_relations = Self::get_all_collection_items(pool).await?;

        let mut warnings = Vec::new();
        let mut item_id_map = HashMap::new();
        let mut existing_item_keys = HashMap::new();
        let mut existing_item_ids = HashSet::new();
        for item in &existing_items {
            existing_item_ids.insert(item.id.clone());
            existing_item_keys.insert(Self::starred_item_key(item), item.id.clone());
        }

        let mut starred_to_insert = Vec::new();
        let mut duplicate_starred_count = 0usize;
        for item in &import_file.starred_items {
            let key = Self::starred_item_key(item);
            if let Some(existing_id) = existing_item_keys.get(&key).cloned() {
                item_id_map.insert(item.id.clone(), existing_id);
                duplicate_starred_count += 1;
                continue;
            }

            if existing_item_ids.contains(&item.id) {
                item_id_map.insert(item.id.clone(), item.id.clone());
                duplicate_starred_count += 1;
                continue;
            }

            item_id_map.insert(item.id.clone(), item.id.clone());
            existing_item_ids.insert(item.id.clone());
            existing_item_keys.insert(key, item.id.clone());
            starred_to_insert.push(item.clone());
        }

        let mut collection_id_map = HashMap::new();
        let existing_collection_ids: HashSet<String> = existing_collections
            .iter()
            .map(|item| item.id.clone())
            .collect();
        let mut existing_tag_names = HashMap::new();
        for collection in &existing_collections {
            if collection.r#type == "group" {
                existing_tag_names
                    .insert(collection.name.trim().to_lowercase(), collection.id.clone());
            }
        }

        let mut collections_to_insert = Vec::new();
        let mut merged_tag_collection_count = 0usize;
        for collection in &import_file.collections {
            if options.merge_same_name_tags && collection.r#type == "group" {
                if let Some(existing_id) = existing_tag_names
                    .get(&collection.name.trim().to_lowercase())
                    .cloned()
                {
                    collection_id_map.insert(collection.id.clone(), existing_id);
                    merged_tag_collection_count += 1;
                    continue;
                }
            }

            if existing_collection_ids.contains(&collection.id) {
                collection_id_map.insert(collection.id.clone(), collection.id.clone());
                continue;
            }

            collection_id_map.insert(collection.id.clone(), collection.id.clone());
            collections_to_insert.push(collection.clone());
        }

        let mut relation_keys: HashSet<(String, String)> = existing_relations
            .iter()
            .map(|relation| (relation.collection_id.clone(), relation.item_id.clone()))
            .collect();
        let mut relations_to_insert = Vec::new();
        let mut duplicate_relation_count = 0usize;

        for relation in &import_file.collection_items {
            let Some(collection_id) = collection_id_map.get(&relation.collection_id).cloned()
            else {
                warnings.push(format!(
                    "Skipped relation with missing collection {}",
                    relation.collection_id
                ));
                continue;
            };
            let Some(item_id) = item_id_map.get(&relation.item_id).cloned() else {
                warnings.push(format!(
                    "Skipped relation with missing item {}",
                    relation.item_id
                ));
                continue;
            };

            let key = (collection_id.clone(), item_id.clone());
            if relation_keys.contains(&key) {
                duplicate_relation_count += 1;
                continue;
            }

            relation_keys.insert(key);
            let mut next_relation = relation.clone();
            next_relation.collection_id = collection_id.clone();
            next_relation.item_id = item_id.clone();
            next_relation.id = format!("{}:{}", collection_id, item_id);
            relations_to_insert.push(next_relation);
        }

        let mut trackers_to_insert = Vec::new();
        for tracker in &import_file.mod_set_trackers {
            let Some(collection_id) = collection_id_map.get(&tracker.collection_id).cloned() else {
                warnings.push(format!(
                    "Skipped tracker with missing collection {}",
                    tracker.collection_id
                ));
                continue;
            };

            let mut next_tracker = tracker.clone();
            next_tracker.collection_id = collection_id;
            next_tracker.projects =
                Self::rewrite_tracker_item_ids(&next_tracker.projects, &item_id_map);
            next_tracker.items = Self::rewrite_tracker_item_ids(&next_tracker.items, &item_id_map);
            trackers_to_insert.push(next_tracker);
        }

        Ok(LibraryImportPlan {
            new_starred_count: starred_to_insert.len(),
            duplicate_starred_count,
            new_collection_count: collections_to_insert.len(),
            merged_tag_collection_count,
            new_relation_count: relations_to_insert.len(),
            duplicate_relation_count,
            importable_tracker_count: trackers_to_insert.len(),
            starred_to_insert,
            collections_to_insert,
            relations_to_insert,
            trackers_to_insert,
            warnings,
        })
    }

    fn starred_item_key(item: &StarredItem) -> String {
        let source = item.source.trim().to_lowercase();
        if let Some(project_id) = item
            .project_id
            .as_ref()
            .map(|value| value.trim())
            .filter(|value| !value.is_empty())
        {
            return format!("{}:{}", source, project_id.to_lowercase());
        }
        format!("id:{}", item.id.trim().to_lowercase())
    }

    fn rewrite_tracker_item_ids(value: &Value, item_id_map: &HashMap<String, String>) -> Value {
        let mut next_value = value.clone();
        if let Some(items) = next_value.as_array_mut() {
            for item in items {
                if let Some(object) = item.as_object_mut() {
                    if let Some(current_id) = object.get("itemId").and_then(|value| value.as_str())
                    {
                        if let Some(next_id) = item_id_map.get(current_id) {
                            object.insert("itemId".to_string(), Value::String(next_id.clone()));
                        }
                    }
                }
            }
        }
        next_value
    }
}

struct LibraryImportPlan {
    new_starred_count: usize,
    duplicate_starred_count: usize,
    new_collection_count: usize,
    merged_tag_collection_count: usize,
    new_relation_count: usize,
    duplicate_relation_count: usize,
    importable_tracker_count: usize,
    starred_to_insert: Vec<StarredItem>,
    collections_to_insert: Vec<Collection>,
    relations_to_insert: Vec<CollectionItem>,
    trackers_to_insert: Vec<ModSetTracker>,
    warnings: Vec<String>,
}
