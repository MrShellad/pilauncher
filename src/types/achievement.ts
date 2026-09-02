// src/types/achievement.ts

export type AchievementFrameType = 'task' | 'goal' | 'challenge' | string;

export interface AdvancementItemDto {
  advancementId: string;
  namespace?: string;
  parentId?: string | null;
  title: string;
  description: string | null;
  iconRelPath: string;
  frameType: AchievementFrameType;
  isCompleted: boolean;
  unlockedAt: number | null;
  isFirstCareerUnlock: boolean;
  criteriaData?: Record<string, string> | null;

  // 兼容字段别名 (snake_case)
  advancement_id?: string;
  frame_type?: AchievementFrameType;
  is_completed?: boolean;
  unlocked_at?: number | null;
  is_first_career_unlock?: boolean;
  criteria_json?: string | null;
}

export interface GameSessionDto {
  id: string;
  instanceId: string;
  worldName: string | null;
  playerUuid: string;
  playerName: string | null;
  startedAt: number;
  endedAt: number;
  durationSecs: number;
  exitCode: number | null;
  newAdvancementsCount: number;

  // 兼容字段别名 (snake_case)
  instance_id?: string;
  world_name?: string | null;
  player_uuid?: string;
  player_name?: string | null;
  started_at?: number;
  ended_at?: number;
  duration_secs?: number;
  exit_code?: number | null;
  new_advancements_count?: number;
}

export interface CareerSummaryDto {
  playerUuid: string;
  totalPlayTimeSecs: number;
  totalSessions: number;
  totalCareerAdvancements: number;
  instancesPlayed: number;
  firstPlayedAt: number | null;
  lastPlayedAt: number | null;

  // 兼容字段别名 (snake_case)
  player_uuid?: string;
  total_play_time_secs?: number;
  total_sessions?: number;
  total_career_advancements?: number;
  instances_played?: number;
  first_played_at?: number | null;
  last_played_at?: number | null;
}
