// src-tauri/src/services/instance/achievement_service.rs
use chrono::{DateTime, Utc};
use once_cell::sync::Lazy;
use serde_json::Value;
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Runtime};
use uuid::Uuid;

use crate::domain::achievement::{
    AchievementSessionSummaryPayload, AchievementUnlockedEventPayload, AdvancementItemDto,
    CareerSummaryDto, GameSession, GameSessionDetailDto, GameSessionDto, InstanceAdvancement,
};
use crate::services::config_service::ConfigService;
use crate::services::db_service::achievement_repo;
use crate::services::db_service::game_session_repo;

#[derive(Debug, Clone)]
struct ActiveSessionContext {
    pub session_id: String,
    pub _instance_id: String,
    pub player_uuid: String,
    pub player_name: Option<String>,
    pub started_at: i64,
}

static ACTIVE_SESSIONS: Lazy<Mutex<HashMap<String, ActiveSessionContext>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));

pub struct AchievementService;

impl AchievementService {
    /// 记录游戏启动时的会话信息
    pub fn start_session(
        instance_id: &str,
        player_uuid: Option<&str>,
        player_name: Option<&str>,
    ) {
        let now = Utc::now().timestamp_millis();
        let session_id = Uuid::new_v4().to_string();
        let uuid = player_uuid
            .filter(|s| !s.trim().is_empty())
            .unwrap_or("default_player")
            .to_string();

        let ctx = ActiveSessionContext {
            session_id,
            _instance_id: instance_id.to_string(),
            player_uuid: uuid,
            player_name: player_name.map(str::to_string),
            started_at: now,
        };

        if let Ok(mut map) = ACTIVE_SESSIONS.lock() {
            map.insert(instance_id.to_string(), ctx);
        }
    }

    fn get_base_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
        let base = ConfigService::get_base_path(app)
            .map_err(|e| e.to_string())?
            .ok_or_else(|| "未配置数据基础目录".to_string())?;
        Ok(PathBuf::from(base))
    }

    /// 获取实例的游戏目录
    fn get_game_dir<R: Runtime>(app: &AppHandle<R>, instance_id: &str) -> Result<PathBuf, String> {
        let base_dir = Self::get_base_dir(app)?;
        let instance_dir = base_dir.join("instances").join(instance_id);

        let mut game_dir = instance_dir.clone();
        let config_path = instance_dir.join("instance.json");
        if config_path.exists() {
            if let Ok(content) = fs::read_to_string(&config_path) {
                if let Ok(json) = serde_json::from_str::<Value>(&content) {
                    if let Some(tp) = json.get("thirdPartyPath").and_then(Value::as_str) {
                        game_dir = PathBuf::from(tp);
                    }
                }
            }
        }
        Ok(game_dir)
    }

    /// 解析 Minecraft 存档中的 advancements/<uuid>.json
    pub fn parse_advancements_file(
        path: &Path,
    ) -> Result<Vec<(String, i64, bool, Option<String>)>, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("无法读取成就文件 {}: {}", path.display(), e))?;
        let json: Value = serde_json::from_str(&content)
            .map_err(|e| format!("解析成就 JSON 失败: {}", e))?;

        let obj = json
            .as_object()
            .ok_or_else(|| "成就文件不是有效的 JSON 对象".to_string())?;

        let file_mtime = fs::metadata(path)
            .and_then(|m| m.modified())
            .map(|t| {
                t.duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_millis() as i64
            })
            .unwrap_or_else(|_| Utc::now().timestamp_millis());

        let mut list = Vec::new();

        for (key, val) in obj {
            // 跳过 DataVersion 等原版元数据字段以及配方合成表解锁条目
            if key == "DataVersion"
                || !key.contains(':')
                || key.contains(":recipes/")
                || key.contains(":recipe/")
            {
                continue;
            }

            if let Some(entry_obj) = val.as_object() {
                let is_done = entry_obj
                    .get("done")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);

                let criteria = entry_obj.get("criteria").and_then(Value::as_object);
                let has_criteria = criteria.map_or(false, |c| !c.is_empty());

                // 收集已完成或已有部分条件的成就
                if !is_done && !has_criteria {
                    continue;
                }

                // 尝试提取 criteria 中的完成时间
                let mut unlocked_at = 0i64;
                if let Some(criteria) = entry_obj.get("criteria").and_then(Value::as_object) {
                    for (_c_name, c_time_val) in criteria {
                        if let Some(time_str) = c_time_val.as_str() {
                            if let Ok(dt) =
                                DateTime::parse_from_str(time_str, "%Y-%m-%d %H:%M:%S %z")
                            {
                                let millis = dt.timestamp_millis();
                                if millis > unlocked_at {
                                    unlocked_at = millis;
                                }
                            }
                        }
                    }
                }

                if unlocked_at <= 0 {
                    unlocked_at = file_mtime;
                }

                let criteria_json = entry_obj
                    .get("criteria")
                    .map(|c| c.to_string());

                list.push((key.clone(), unlocked_at, is_done, criteria_json));
            }
        }

        Ok(list)
    }

    /// 兼容不同版本 Minecraft 的成就目录与 JSON 路径定位
    /// 1. 新版本 (如 26.2+ / 1.21+ 新特性): `saves/<world>/players/advancements/<uuid>.json`
    /// 2. 经典版本: `saves/<world>/advancements/<uuid>.json`
    pub fn find_advancement_json(save_dir: &Path, player_uuid: &str) -> Option<PathBuf> {
        let candidate_dirs = [
            save_dir.join("players").join("advancements"),
            save_dir.join("advancements"),
        ];

        for adv_dir in &candidate_dirs {
            if !adv_dir.is_dir() {
                continue;
            }

            // 1. 若指定了 player_uuid，优先查找精确匹配的文件
            if !player_uuid.is_empty() {
                let target = adv_dir.join(format!("{}.json", player_uuid));
                if target.is_file() {
                    return Some(target);
                }
            }

            // 2. 查找该目录下所有的 json 文件，按修改时间倒序（优先获取最近游玩的记录）
            if let Ok(entries) = fs::read_dir(adv_dir) {
                let mut json_files: Vec<_> = entries
                    .flatten()
                    .map(|e| e.path())
                    .filter(|p| p.extension().map_or(false, |ext| ext == "json"))
                    .collect();

                json_files.sort_by(|a, b| {
                    let mtime_a = fs::metadata(a).and_then(|m| m.modified()).ok();
                    let mtime_b = fs::metadata(b).and_then(|m| m.modified()).ok();
                    mtime_b.cmp(&mtime_a)
                });

                if let Some(first) = json_files.into_iter().next() {
                    return Some(first);
                }
            }
        }

        None
    }

    /// 从成就 ID 猜测默认 FrameType (task / goal / challenge)
    #[allow(dead_code)]
    fn guess_frame_type(advancement_id: &str) -> &'static str {
        if advancement_id.contains("challenge") || advancement_id.contains("kill_all") {
            "challenge"
        } else if advancement_id.contains("goal") {
            "goal"
        } else {
            "task"
        }
    }

    /// 处理游戏退出事件 (在后台线程运行)
    pub async fn handle_game_exit<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        exit_code: i32,
    ) -> Result<Option<AchievementSessionSummaryPayload>, String> {
        let ended_at = Utc::now().timestamp_millis();

        // 提取或初始化活动会话上下文
        let active_ctx = {
            let mut map = ACTIVE_SESSIONS
                .lock()
                .map_err(|e| format!("锁状态错误: {}", e))?;
            map.remove(instance_id)
        };

        let (session_id, player_uuid, player_name, started_at) = match active_ctx {
            Some(ctx) => (
                ctx.session_id,
                ctx.player_uuid,
                ctx.player_name,
                ctx.started_at,
            ),
            None => (
                Uuid::new_v4().to_string(),
                "default_player".to_string(),
                None,
                ended_at.saturating_sub(60_000), // 若无记录则回退为 1 分钟前
            ),
        };

        let duration_secs = ((ended_at - started_at).max(0) / 1000) as i64;
        let base_dir = Self::get_base_dir(app)?;
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let saves_dir = game_dir.join("saves");

        // 增量同步成就字典（原版 JSON + 用户自制扩展）至 SQLite 缓存
        let _ = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::sync_dictionaries_to_db(
            pool,
            &base_dir,
        ).await;

        let mut primary_world_name: Option<String> = None;
        let mut new_advancements_to_insert = Vec::new();
        let mut unlocked_event_payloads = Vec::new();

        if saves_dir.is_dir() {
            if let Ok(entries) = fs::read_dir(&saves_dir) {
                let mut candidate_saves: Vec<(PathBuf, String, i64)> = Vec::new();

                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let folder_name = entry.file_name().to_string_lossy().to_string();
                        let mtime = fs::metadata(&path)
                            .and_then(|m| m.modified())
                            .map(|t| {
                                t.duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as i64
                            })
                            .unwrap_or(0);

                        candidate_saves.push((path, folder_name, mtime));
                    }
                }

                // 优先检查修改时间在本次游玩启动时间之后（或最近修改）的存档
                candidate_saves.sort_by(|a, b| b.2.cmp(&a.2));

                if let Some(first) = candidate_saves.first() {
                    primary_world_name = Some(first.1.clone());
                }

                for (save_path, folder_name, save_mtime) in candidate_saves {
                    // 如果存档修改时间早于本次启动时间且不是最近的存档，则跳过
                    if save_mtime < started_at && primary_world_name.as_deref() != Some(&folder_name) {
                        continue;
                    }

                    // 兼容新版 (players/advancements) 与经典版 (advancements) 成就文件定位
                    let actual_json = Self::find_advancement_json(&save_path, &player_uuid);

                    if let Some(json_path) = actual_json {
                        if let Ok(adv_list) = Self::parse_advancements_file(&json_path) {
                            // 查询当前已入库的成就，做增量 Diff
                            let existing_list = achievement_repo::query_instance_advancements(
                                pool,
                                instance_id,
                                &folder_name,
                                &player_uuid,
                            )
                            .await
                            .unwrap_or_default();

                            let existing_set: std::collections::HashSet<String> = existing_list
                                .into_iter()
                                .map(|a| a.advancement_id)
                                .collect();

                            for (adv_id, unlocked_at, is_done, criteria_json) in adv_list {
                                if !is_done || existing_set.contains(&adv_id) {
                                    continue;
                                }

                                let is_career_first = !achievement_repo::is_advancement_unlocked_career(
                                    pool,
                                    &player_uuid,
                                    &adv_id,
                                )
                                .await
                                .unwrap_or(false);

                                let rec_id = format!(
                                    "{:x}",
                                    md5::compute(format!(
                                        "{}:{}:{}:{}",
                                        instance_id, folder_name, player_uuid, adv_id
                                    ))
                                );

                                // 查询元数据缓存获取标题；若未命中则通过字典/外部链路解析入库
                                let meta_record = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::resolve_single_metadata(
                                    pool,
                                    &base_dir,
                                    &adv_id,
                                ).await;

                                let title = meta_record.title;
                                let description = meta_record.description;
                                let icon_rel_path = meta_record.icon_rel_path;
                                let frame_type = meta_record.frame_type;

                                let record = InstanceAdvancement {
                                    id: rec_id,
                                    instance_id: instance_id.to_string(),
                                    world_name: folder_name.clone(),
                                    player_uuid: player_uuid.clone(),
                                    advancement_id: adv_id.clone(),
                                    frame_type: frame_type.clone(),
                                    session_id: Some(session_id.clone()),
                                    unlocked_at,
                                    is_first_career_unlock: is_career_first,
                                    criteria_json,
                                    created_at: ended_at,
                                };

                                new_advancements_to_insert.push(record);

                                unlocked_event_payloads.push(AchievementUnlockedEventPayload {
                                    instance_id: instance_id.to_string(),
                                    world_name: folder_name.clone(),
                                    player_uuid: player_uuid.clone(),
                                    player_name: player_name.clone(),
                                    advancement_id: adv_id,
                                    title,
                                    description,
                                    icon_rel_path,
                                    frame_type,
                                    unlocked_at,
                                    is_first_career_unlock: is_career_first,
                                });
                            }
                        }
                    }
                }
            }
        }

        let new_count = new_advancements_to_insert.len() as i64;

        // 1. 插入新成就
        if !new_advancements_to_insert.is_empty() {
            if let Err(e) =
                achievement_repo::upsert_advancements(pool, &new_advancements_to_insert).await
            {
                log::error!("保存新成就记录失败: {}", e);
            }
        }

        // 2. 插入会话记录
        let session = GameSession {
            id: session_id.clone(),
            instance_id: instance_id.to_string(),
            world_name: primary_world_name.clone(),
            player_uuid: player_uuid.clone(),
            player_name: player_name.clone(),
            started_at,
            ended_at,
            duration_secs,
            exit_code,
            new_advancements_count: new_count,
            summary_json: None,
            created_at: ended_at,
        };

        if let Err(e) = game_session_repo::insert_session(pool, &session).await {
            log::error!("保存游戏会话流水失败: {}", e);
        }

        // 3. 派发单个成就解锁事件
        for payload in &unlocked_event_payloads {
            let _ = app.emit("achievement-unlocked", payload);
        }

        // 4. 组装并派发本次游玩会话总结
        let summary_payload = AchievementSessionSummaryPayload {
            session_id,
            instance_id: instance_id.to_string(),
            world_name: primary_world_name,
            player_uuid,
            duration_secs,
            new_advancements_count: new_count,
            new_advancements: unlocked_event_payloads,
        };

        let _ = app.emit("achievement-session-summary", &summary_payload);

        Ok(Some(summary_payload))
    }

    /// 手动扫描并刷新指定存档的成就记录
    pub async fn refresh_instance_advancements<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        world_name: &str,
        player_uuid: &str,
    ) -> Result<Vec<AdvancementItemDto>, String> {
        let base_dir = Self::get_base_dir(app)?;
        let game_dir = Self::get_game_dir(app, instance_id)?;
        let save_dir = game_dir.join("saves").join(world_name);

        // 刷新时增量同步成就字典（原版 JSON + 用户自制扩展）至 SQLite 缓存
        let _ = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::sync_dictionaries_to_db(
            pool,
            &base_dir,
        ).await;

        let actual_json = Self::find_advancement_json(&save_dir, player_uuid);

        if let Some(json_path) = actual_json {
            if let Ok(adv_list) = Self::parse_advancements_file(&json_path) {
                let now = Utc::now().timestamp_millis();
                let mut records = Vec::new();

                for (adv_id, unlocked_at, is_done, criteria_json) in adv_list {
                    if !is_done && criteria_json.is_none() {
                        continue;
                    }

                    let is_career_first = if is_done {
                        !achievement_repo::is_advancement_unlocked_career(
                            pool,
                            player_uuid,
                            &adv_id,
                        )
                        .await
                        .unwrap_or(false)
                    } else {
                        false
                    };

                    // 确保元数据已解析并缓存（从成就字典中高效读取）
                    let meta = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::resolve_single_metadata(
                        pool,
                        &base_dir,
                        &adv_id,
                    ).await;

                    let frame_type = meta.frame_type;

                    let rec_id = format!(
                        "{:x}",
                        md5::compute(format!(
                            "{}:{}:{}:{}",
                            instance_id, world_name, player_uuid, adv_id
                        ))
                    );

                    records.push(InstanceAdvancement {
                        id: rec_id,
                        instance_id: instance_id.to_string(),
                        world_name: world_name.to_string(),
                        player_uuid: player_uuid.to_string(),
                        advancement_id: adv_id,
                        frame_type,
                        session_id: None,
                        unlocked_at,
                        is_first_career_unlock: is_career_first,
                        criteria_json,
                        created_at: now,
                    });
                }

                if !records.is_empty() {
                    let _ = achievement_repo::upsert_advancements(pool, &records).await;
                }
            }
        }

        achievement_repo::query_instance_advancements(pool, instance_id, world_name, player_uuid)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_instance_advancements<R: Runtime>(
        app: &AppHandle<R>,
        pool: &SqlitePool,
        instance_id: &str,
        world_name: &str,
        player_uuid: &str,
    ) -> Result<Vec<AdvancementItemDto>, String> {
        if let Ok(base_dir) = Self::get_base_dir(app) {
            let _ = crate::services::instance::advancement_dict_loader::AdvancementDictionaryLoader::sync_dictionaries_to_db(
                pool,
                &base_dir,
            ).await;
        }

        achievement_repo::query_instance_advancements(pool, instance_id, world_name, player_uuid)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_instance_game_sessions(
        pool: &SqlitePool,
        instance_id: &str,
        limit: i64,
        offset: i64,
    ) -> Result<Vec<GameSessionDto>, String> {
        game_session_repo::query_instance_sessions(pool, instance_id, limit, offset)
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn get_session_detail(
        pool: &SqlitePool,
        session_id: &str,
    ) -> Result<Option<GameSessionDetailDto>, String> {
        let session_opt = game_session_repo::query_session_by_id(pool, session_id)
            .await
            .map_err(|e| e.to_string())?;

        let Some(session) = session_opt else {
            return Ok(None);
        };

        let new_advancements = achievement_repo::query_session_advancements(pool, session_id)
            .await
            .map_err(|e| e.to_string())?;

        Ok(Some(GameSessionDetailDto {
            session,
            new_advancements,
        }))
    }

    pub async fn get_player_career_summary(
        pool: &SqlitePool,
        player_uuid: &str,
    ) -> Result<CareerSummaryDto, String> {
        game_session_repo::query_player_career_summary(pool, player_uuid)
            .await
            .map_err(|e| e.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_guess_frame_type() {
        assert_eq!(AchievementService::guess_frame_type("minecraft:story/mine_stone"), "task");
        assert_eq!(AchievementService::guess_frame_type("minecraft:nether/explore_nether_goal"), "goal");
        assert_eq!(AchievementService::guess_frame_type("minecraft:adventure/kill_all_mobs"), "challenge");
        assert_eq!(AchievementService::guess_frame_type("custom:epic_challenge"), "challenge");
    }

    #[test]
    fn test_parse_advancements_file() {
        let temp_dir = std::env::temp_dir().join(format!("test_adv_{}", Uuid::new_v4()));
        fs::create_dir_all(&temp_dir).unwrap();
        let test_file = temp_dir.join("test_player.json");

        let mock_json = r#"{
            "minecraft:story/root": {
                "criteria": {
                    "crafting_table": "2024-05-01 10:00:00 +0000"
                },
                "done": true
            },
            "minecraft:story/mine_stone": {
                "criteria": {
                    "mine_stone": "2024-05-01 10:05:00 +0000"
                },
                "done": true
            },
            "minecraft:story/smelt_iron": {
                "criteria": {},
                "done": false
            },
            "minecraft:recipes/building_blocks/stone": {
                "criteria": {
                    "has_the_recipe": "2024-05-01 10:00:00 +0000"
                },
                "done": true
            },
            "create:recipe/crafting/cogwheel": {
                "criteria": {
                    "has_the_recipe": "2024-05-01 10:00:00 +0000"
                },
                "done": true
            },
            "minecraft:adventure/adventuring_time": {
                "criteria": {
                    "minecraft:plains": "2024-05-01 10:10:00 +0000"
                },
                "done": false
            },
            "DataVersion": 3953
        }"#;

        let mut f = fs::File::create(&test_file).unwrap();
        f.write_all(mock_json.as_bytes()).unwrap();
        drop(f);

        let parsed = AchievementService::parse_advancements_file(&test_file).unwrap();
        assert_eq!(parsed.len(), 3);

        let ids: Vec<String> = parsed.iter().map(|item| item.0.clone()).collect();
        assert!(ids.contains(&"minecraft:story/root".to_string()));
        assert!(ids.contains(&"minecraft:story/mine_stone".to_string()));
        assert!(ids.contains(&"minecraft:adventure/adventuring_time".to_string()));

        // 验证配方已被过滤
        assert!(!ids.contains(&"minecraft:recipes/building_blocks/stone".to_string()));
        assert!(!ids.contains(&"create:recipe/crafting/cogwheel".to_string()));
        // 验证无 criteria 的未完成条目被过滤
        assert!(!ids.contains(&"minecraft:story/smelt_iron".to_string()));

        let _ = fs::remove_dir_all(temp_dir);
    }

    #[test]
    fn test_vanilla_and_translation_resolution() {
        let base_dir = std::env::temp_dir().join(format!("test_trans_{}", Uuid::new_v4()));
        let mod_lang_dir = base_dir.join("translations").join("assets").join("rusticdelight").join("lang");
        fs::create_dir_all(&mod_lang_dir).unwrap();

        let mock_zh = r#"{
            "advancements.rusticdelight.pancakes.title": "新鲜出炉",
            "advancements.rusticdelight.pancakes.description": "制作一些薄煎饼。"
        }"#;
        fs::write(mod_lang_dir.join("zh_cn.json"), mock_zh).unwrap();

        // 1. 原版成就解析 (零 I/O 权威字典)
        let vanilla_meta = crate::services::instance::translation_loader::TranslationLoader::resolve_advancement_metadata(
            &base_dir,
            "minecraft:story/smelt_iron",
        );
        assert_eq!(vanilla_meta.title, "热腾腾的成就");
        assert_eq!(vanilla_meta.description.as_deref(), Some("熔炼出一块铁锭"));
        assert_eq!(vanilla_meta.icon_rel_path, "iron_ingot");
        assert_eq!(vanilla_meta.source_type, "vanilla");

        // 2. 模组成就外部翻译加载
        let mod_meta = crate::services::instance::translation_loader::TranslationLoader::resolve_advancement_metadata(
            &base_dir,
            "rusticdelight:main/pancakes",
        );
        assert_eq!(mod_meta.title, "新鲜出炉");
        assert_eq!(mod_meta.description.as_deref(), Some("制作一些薄煎饼。"));
        assert_eq!(mod_meta.source_type, "mod");

        let _ = fs::remove_dir_all(base_dir);
    }

    #[test]
    fn test_find_advancement_json_dual_paths() {
        let root = std::env::temp_dir().join(format!("test_paths_{}", Uuid::new_v4()));
        let save_new = root.join("new_world");
        let save_classic = root.join("classic_world");

        // 1. 新版本路径: players/advancements/<uuid>.json
        let new_adv_dir = save_new.join("players").join("advancements");
        fs::create_dir_all(&new_adv_dir).unwrap();
        let new_file = new_adv_dir.join("6bf22d21-bc2c-310e-ab7c-4b293a6a1335.json");
        fs::write(&new_file, "{}").unwrap();

        let found_new = AchievementService::find_advancement_json(&save_new, "6bf22d21-bc2c-310e-ab7c-4b293a6a1335");
        assert_eq!(found_new, Some(new_file));

        // 2. 经典版本路径: advancements/<uuid>.json
        let classic_adv_dir = save_classic.join("advancements");
        fs::create_dir_all(&classic_adv_dir).unwrap();
        let classic_file = classic_adv_dir.join("37f56971-efb8-418f-93a7-5afd792f64e4.json");
        fs::write(&classic_file, "{}").unwrap();

        let found_classic = AchievementService::find_advancement_json(&save_classic, "37f56971-efb8-418f-93a7-5afd792f64e4");
        assert_eq!(found_classic, Some(classic_file));

        let _ = fs::remove_dir_all(root);
    }
}
