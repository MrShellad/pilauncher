// src-tauri/src/commands/achievement_cmd.rs
use tauri::{AppHandle, Runtime, State};

use crate::domain::achievement::{
    AdvancementItemDto, CareerSummaryDto, GameSessionDetailDto, GameSessionDto,
};
use crate::services::db_service::AppDatabase;
use crate::services::instance::achievement_service::AchievementService;

#[tauri::command]
pub async fn get_instance_advancements<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    instance_id: String,
    world_name: String,
    player_uuid: String,
) -> Result<Vec<AdvancementItemDto>, String> {
    AchievementService::get_instance_advancements(&app, &db.pool, &instance_id, &world_name, &player_uuid)
        .await
}

#[tauri::command]
pub async fn refresh_instance_advancements<R: Runtime>(
    app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    instance_id: String,
    world_name: String,
    player_uuid: String,
) -> Result<Vec<AdvancementItemDto>, String> {
    AchievementService::refresh_instance_advancements(
        &app,
        &db.pool,
        &instance_id,
        &world_name,
        &player_uuid,
    )
    .await
}

#[tauri::command]
pub async fn get_instance_game_sessions<R: Runtime>(
    _app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    instance_id: String,
    limit: Option<i64>,
    offset: Option<i64>,
) -> Result<Vec<GameSessionDto>, String> {
    let limit = limit.unwrap_or(20);
    let offset = offset.unwrap_or(0);
    AchievementService::get_instance_game_sessions(&db.pool, &instance_id, limit, offset).await
}

#[tauri::command]
pub async fn get_session_detail<R: Runtime>(
    _app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    session_id: String,
) -> Result<Option<GameSessionDetailDto>, String> {
    AchievementService::get_session_detail(&db.pool, &session_id).await
}

#[tauri::command]
pub async fn get_player_career_summary<R: Runtime>(
    _app: AppHandle<R>,
    db: State<'_, AppDatabase>,
    player_uuid: String,
) -> Result<CareerSummaryDto, String> {
    AchievementService::get_player_career_summary(&db.pool, &player_uuid).await
}
