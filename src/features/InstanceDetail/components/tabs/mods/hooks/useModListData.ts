import { useMemo } from 'react';

import { filterModsByQuery } from '../../../../logic/modPanelService';
import type { ModMeta } from '../../../../logic/modService';
import {
  buildModGroups,
  getModListStats,
  matchesModQuickFilter,
  type ModGroupId,
  type ModListRenderEntry,
  type ModQuickFilter
} from '../modListShared';

interface UseModListDataOptions {
  mods: ModMeta[];
  searchQuery: string;
  quickFilter: ModQuickFilter;
  collapsedGroupIds: Set<ModGroupId>;
  isLoading: boolean;
}

export const useModListData = ({
  mods,
  searchQuery,
  quickFilter,
  collapsedGroupIds,
  isLoading
}: UseModListDataOptions) => {
  const searchedMods = useMemo(() => {
    return filterModsByQuery(mods, searchQuery);
  }, [mods, searchQuery]);

  const quickFilteredMods = useMemo(() => {
    return searchedMods.filter((mod) => matchesModQuickFilter(mod, quickFilter));
  }, [quickFilter, searchedMods]);

  const groups = useMemo(() => {
    return buildModGroups(quickFilteredMods);
  }, [quickFilteredMods]);

  const activeMods = useMemo(() => {
    return groups.flatMap((group) => (
      collapsedGroupIds.has(group.id) ? [] : group.mods
    ));
  }, [collapsedGroupIds, groups]);

  const renderEntries = useMemo<ModListRenderEntry[]>(() => {
    let rowIndex = 0;

    return groups.flatMap((group) => {
      const collapsed = collapsedGroupIds.has(group.id);
      const entries: ModListRenderEntry[] = [{
        type: 'group' as const,
        group,
        collapsed
      }];

      if (!collapsed) {
        entries.push(...group.mods.map((mod) => ({
          type: 'mod' as const,
          mod,
          groupId: group.id,
          rowIndex: rowIndex++
        })));
      }

      return entries;
    });
  }, [collapsedGroupIds, groups]);

  const filterOptions = useMemo(() => {
    const stats = getModListStats(searchedMods, quickFilteredMods);

    return [
      { id: 'all' as const, label: '全部', count: stats.total },
      { id: 'enabled' as const, label: '已启用', count: stats.enabled },
      { id: 'disabled' as const, label: '已禁用', count: stats.disabled },
      { id: 'updates' as const, label: '可更新', count: stats.updates },
      { id: 'external' as const, label: '外部/手动', count: stats.external }
    ];
  }, [quickFilteredMods, searchedMods]);

  const stats = useMemo(() => {
    return getModListStats(searchedMods, quickFilteredMods);
  }, [quickFilteredMods, searchedMods]);

  return {
    searchedMods,
    quickFilteredMods,
    groups,
    activeMods,
    renderEntries,
    filterOptions,
    stats,
    showInitialLoading: isLoading && mods.length === 0,
    showEmptyState: !isLoading && mods.length === 0,
    showFilteredEmptyState: !isLoading && mods.length > 0 && quickFilteredMods.length === 0,
    showCollapsedState: !isLoading && quickFilteredMods.length > 0 && activeMods.length === 0,
    showSyncingOverlay: isLoading && mods.length > 0
  };
};
