use crate::domain::library::{Collection, CollectionItem, StarredItem};
use crate::services::db_service::AppDatabase;
use crate::services::library_service::LibraryService;
use tauri::State;

#[tauri::command]
pub async fn get_starred_items(db: State<'_, AppDatabase>) -> Result<Vec<StarredItem>, String> {
    LibraryService::get_starred_items(&db.pool)
        .await
        .map_err(|e| format!("Failed to get starred items: {}", e))
}

#[tauri::command]
pub async fn save_starred_item(
    db: State<'_, AppDatabase>,
    item: StarredItem,
) -> Result<(), String> {
    LibraryService::save_starred_item(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save starred item: {}", e))
}

#[tauri::command]
pub async fn remove_starred_item(db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    LibraryService::remove_starred_item(&db.pool, &id)
        .await
        .map_err(|e| format!("Failed to remove starred item: {}", e))
}

#[tauri::command]
pub async fn get_collections(db: State<'_, AppDatabase>) -> Result<Vec<Collection>, String> {
    LibraryService::get_collections(&db.pool)
        .await
        .map_err(|e| format!("Failed to get collections: {}", e))
}

#[tauri::command]
pub async fn save_collection(db: State<'_, AppDatabase>, item: Collection) -> Result<(), String> {
    LibraryService::save_collection(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save collection: {}", e))
}

#[tauri::command]
pub async fn remove_collection(db: State<'_, AppDatabase>, id: String) -> Result<(), String> {
    LibraryService::remove_collection(&db.pool, &id)
        .await
        .map_err(|e| format!("Failed to remove collection: {}", e))
}

#[tauri::command]
pub async fn get_collection_items(
    db: State<'_, AppDatabase>,
    collection_id: String,
) -> Result<Vec<CollectionItem>, String> {
    LibraryService::get_collection_items(&db.pool, &collection_id)
        .await
        .map_err(|e| format!("Failed to get collection items: {}", e))
}

#[tauri::command]
pub async fn save_collection_item(
    db: State<'_, AppDatabase>,
    item: CollectionItem,
) -> Result<(), String> {
    LibraryService::save_collection_item(&db.pool, &item)
        .await
        .map_err(|e| format!("Failed to save collection item: {}", e))
}

#[tauri::command]
pub async fn remove_collection_item(
    db: State<'_, AppDatabase>,
    collection_id: String,
    item_id: String,
) -> Result<(), String> {
    LibraryService::remove_collection_item(&db.pool, &collection_id, &item_id)
        .await
        .map_err(|e| format!("Failed to remove collection item: {}", e))
}
