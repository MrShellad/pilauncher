// src-tauri/src/domain/achievement.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSession {
    pub id: String,
    pub instance_id: String,
    pub world_name: Option<String>,
    pub player_uuid: String,
    pub player_name: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_secs: i64,
    pub exit_code: i32,
    pub new_advancements_count: i64,
    pub summary_json: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstanceAdvancement {
    pub id: String,
    pub instance_id: String,
    pub world_name: String,
    pub player_uuid: String,
    pub advancement_id: String,
    pub frame_type: String,
    pub session_id: Option<String>,
    pub unlocked_at: i64,
    pub is_first_career_unlock: bool,
    pub criteria_json: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancementMetadataCache {
    pub advancement_id: String,
    pub namespace: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub frame_type: String,
    pub icon_rel_path: String,
    pub source_type: String,
    pub source_hash: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdvancementItemDto {
    pub advancement_id: String,
    pub namespace: String,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub icon_rel_path: String,
    pub frame_type: String,
    pub unlocked_at: Option<i64>,
    pub is_completed: bool,
    pub is_first_career_unlock: bool,
    pub criteria_data: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSessionDto {
    pub id: String,
    pub instance_id: String,
    pub world_name: Option<String>,
    pub player_uuid: String,
    pub player_name: Option<String>,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_secs: i64,
    pub exit_code: i32,
    pub new_advancements_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSessionDetailDto {
    pub session: GameSessionDto,
    pub new_advancements: Vec<AdvancementItemDto>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CareerSummaryDto {
    pub total_playtime_secs: i64,
    pub total_sessions_count: i64,
    pub total_unique_advancements: i64,
    pub challenge_advancements_count: i64,
    pub last_played_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementUnlockedEventPayload {
    pub instance_id: String,
    pub world_name: String,
    pub player_uuid: String,
    pub player_name: Option<String>,
    pub advancement_id: String,
    pub title: String,
    pub description: Option<String>,
    pub icon_rel_path: String,
    pub frame_type: String,
    pub unlocked_at: i64,
    pub is_first_career_unlock: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AchievementSessionSummaryPayload {
    pub session_id: String,
    pub instance_id: String,
    pub world_name: Option<String>,
    pub player_uuid: String,
    pub duration_secs: i64,
    pub new_advancements_count: i64,
    pub new_advancements: Vec<AchievementUnlockedEventPayload>,
}
