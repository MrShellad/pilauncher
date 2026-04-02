use crate::domain::library::{Collection, CollectionItem, StarredItem};
use sqlx::{Row, SqlitePool};

pub struct LibraryService;

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

        let items = rows.into_iter().map(|row| StarredItem {
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
        }).collect();

        Ok(items)
    }

    pub async fn save_starred_item(pool: &SqlitePool, item: &StarredItem) -> Result<(), sqlx::Error> {
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

        Ok(())
    }

    pub async fn remove_starred_item(pool: &SqlitePool, item_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM starred_items WHERE id = ?")
            .bind(item_id)
            .execute(pool)
            .await?;
        
        // Also remove from any collections
        sqlx::query("DELETE FROM collection_items WHERE item_id = ?")
            .bind(item_id)
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
             FROM collections ORDER BY sort_order ASC, created_at DESC"
        )
        .fetch_all(pool)
        .await?;

        let items = rows.into_iter().map(|row| Collection {
            id: row.get("id"),
            name: row.get("name"),
            description: row.get("description"),
            r#type: row.get("type"),
            cover_image: row.get("cover_image"),
            sort_order: row.get("sort_order"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        }).collect();

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

    pub async fn remove_collection(pool: &SqlitePool, collection_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM collections WHERE id = ?")
            .bind(collection_id)
            .execute(pool)
            .await?;

        sqlx::query("DELETE FROM collection_items WHERE collection_id = ?")
            .bind(collection_id)
            .execute(pool)
            .await?;

        Ok(())
    }

    // ------------------------------------------------------------------------
    // Collection Items
    // ------------------------------------------------------------------------

    pub async fn get_collection_items(pool: &SqlitePool, collection_id: &str) -> Result<Vec<CollectionItem>, sqlx::Error> {
        let rows = sqlx::query(
            "SELECT id, collection_id, item_id, position, extra, created_at 
             FROM collection_items WHERE collection_id = ? ORDER BY position ASC"
        )
        .bind(collection_id)
        .fetch_all(pool)
        .await?;

        let items = rows.into_iter().map(|row| CollectionItem {
            id: row.get("id"),
            collection_id: row.get("collection_id"),
            item_id: row.get("item_id"),
            position: row.get("position"),
            extra: row.get("extra"),
            created_at: row.get("created_at"),
        }).collect();

        Ok(items)
    }

    pub async fn save_collection_item(pool: &SqlitePool, item: &CollectionItem) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO collection_items (id, collection_id, item_id, position, extra, created_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(collection_id, item_id) DO UPDATE SET
                position=excluded.position,
                extra=excluded.extra"
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

    pub async fn remove_collection_item(pool: &SqlitePool, collection_id: &str, item_id: &str) -> Result<(), sqlx::Error> {
        sqlx::query("DELETE FROM collection_items WHERE collection_id = ? AND item_id = ?")
            .bind(collection_id)
            .bind(item_id)
            .execute(pool)
            .await?;

        Ok(())
    }
}
