// src/features/InstanceDetail/components/tabs/achievements/useAchievementPanel.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAccountStore } from '../../../../../store/useAccountStore';
import { useAchievementEvents } from '../../../../../hooks/useAchievementEvents';
import { saveService, type SaveItem } from '../../../logic/saveService';
import type { AdvancementItemDto } from '../../../../../types/achievement';

export type AchievementCategory =
  | 'all'
  | 'story'
  | 'nether'
  | 'the_end'
  | 'adventure'
  | 'husbandry';

export type AchievementViewMode = 'grid' | 'timeline';

export interface TimelineDateGroup {
  date: string;
  items: AdvancementItemDto[];
}

export const useAchievementPanel = (instanceId: string) => {
  const [saves, setSaves] = useState<SaveItem[]>([]);
  const [selectedWorld, setSelectedWorld] = useState<string>('');
  const [advancements, setAdvancements] = useState<AdvancementItemDto[]>([]);
  const [isLoadingSaves, setIsLoadingSaves] = useState(true);
  const [isLoadingAdvancements, setIsLoadingAdvancements] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 视图模式：卡片网格 vs 时间轴
  const [viewMode, setViewMode] = useState<AchievementViewMode>('grid');

  // 分类过滤状态
  const [activeCategory, setActiveCategory] = useState<AchievementCategory>('all');

  // 选中的成就（用于弹出多条件详情模态框）
  const [selectedAdvancement, setSelectedAdvancement] = useState<AdvancementItemDto | null>(null);

  // 获取当前活跃账号 UUID
  const { accounts, activeAccountId } = useAccountStore();
  const currentAccount = useMemo(
    () => accounts.find((a) => a.uuid === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );
  const playerUuid = currentAccount?.uuid ?? '';

  // 1. 加载世界存档列表
  const loadSaves = useCallback(async () => {
    setIsLoadingSaves(true);
    try {
      const data = await saveService.getSaves(instanceId);
      setSaves(data);
      if (data.length > 0) {
        setSelectedWorld((prev) => {
          if (prev && data.some((s) => s.folderName === prev)) {
            return prev;
          }
          return data[0].folderName;
        });
      } else {
        setSelectedWorld('');
      }
    } catch (error) {
      console.error('Failed to load saves for achievements:', error);
    } finally {
      setIsLoadingSaves(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadSaves();
  }, [loadSaves]);

  // 2. 加载成就列表
  const loadAdvancements = useCallback(
    async (isManualRefresh = false) => {
      if (!selectedWorld) {
        setAdvancements([]);
        return;
      }

      if (isManualRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoadingAdvancements(true);
      }

      try {
        const cmd = isManualRefresh
          ? 'refresh_instance_advancements'
          : 'get_instance_advancements';

        const data = await invoke<AdvancementItemDto[]>(cmd, {
          instanceId,
          worldName: selectedWorld,
          playerUuid,
        });
        setAdvancements(data);
      } catch (error) {
        console.error('Failed to query instance achievements:', error);
      } finally {
        setIsLoadingAdvancements(false);
        setIsRefreshing(false);
      }
    },
    [instanceId, selectedWorld, playerUuid]
  );

  useEffect(() => {
    loadAdvancements(false);
  }, [loadAdvancements]);

  // 3. 监听 EventBus 实时事件 (成就达成 / 会话结束时自动刷新)
  useAchievementEvents({
    instanceId,
    onUnlocked: () => {
      loadAdvancements(false);
    },
    onSessionSummary: () => {
      loadAdvancements(false);
    },
  });

  // 4. 自动过滤只保留原版成就 (排除非 minecraft: 命名空间的模组成就)
  const vanillaAdvancements = useMemo(() => {
    return advancements.filter((item) => {
      const advId = item.advancementId || item.advancement_id || '';
      return advId.startsWith('minecraft:') || item.namespace === 'minecraft';
    });
  }, [advancements]);

  // 5. 统计指标计算 (仅以原版成就为基准)
  const stats = useMemo(() => {
    const total = vanillaAdvancements.length;
    const completed = vanillaAdvancements.filter(
      (a) => a.isCompleted ?? a.is_completed ?? false
    ).length;
    const inProgress = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, inProgress, percentage };
  }, [vanillaAdvancements]);

  // 6. 分类过滤 (用于网格视图)
  const filteredAdvancements = useMemo(() => {
    return vanillaAdvancements.filter((item) => {
      const advId = item.advancementId || item.advancement_id || '';
      if (!advId) return false;

      // 原版五大分类过滤
      if (activeCategory !== 'all') {
        if (activeCategory === 'the_end') {
          if (!advId.includes(':end/') && !advId.includes(':the_end/')) return false;
        } else {
          if (!advId.includes(`:${activeCategory}/`)) return false;
        }
      }

      return true;
    });
  }, [vanillaAdvancements, activeCategory]);

  // 7. 时间轴模式数据 (按达成时间倒序排列并按日期分组)
  const timelineGroups = useMemo<TimelineDateGroup[]>(() => {
    const unlocked = vanillaAdvancements.filter(
      (item) =>
        (item.isCompleted ?? item.is_completed ?? false) &&
        (item.unlockedAt ?? item.unlocked_at ?? 0) > 0
    );

    const sorted = [...unlocked].sort((a, b) => {
      const timeA = a.unlockedAt ?? a.unlocked_at ?? 0;
      const timeB = b.unlockedAt ?? b.unlocked_at ?? 0;
      return timeB - timeA;
    });

    const map = new Map<string, AdvancementItemDto[]>();
    for (const item of sorted) {
      const time = item.unlockedAt ?? item.unlocked_at ?? 0;
      const date = new Date(time);
      const dateKey = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`;
      const group = map.get(dateKey) || [];
      group.push(item);
      map.set(dateKey, group);
    }

    return Array.from(map.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }, [vanillaAdvancements]);

  return {
    saves,
    selectedWorld,
    setSelectedWorld,
    advancements: filteredAdvancements,
    timelineGroups,
    allAdvancementsCount: vanillaAdvancements.length,
    isLoading: isLoadingSaves || isLoadingAdvancements,
    isRefreshing,
    stats,
    viewMode,
    setViewMode,
    activeCategory,
    setActiveCategory,
    selectedAdvancement,
    setSelectedAdvancement,
    refresh: () => loadAdvancements(true),
  };
};
