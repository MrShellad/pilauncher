import { useCallback, useMemo, useState } from 'react';

import { useInputMode } from '../../../../../ui/focus/FocusProvider';
import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import { useModListData } from './hooks/useModListData';
import {
  type ModGroupId,
  type ModListViewMode,
  type ModQuickFilter,
  type RowAction
} from './modListShared';
import { useModIconSubscription } from './useModIconSubscription';
import { useModListFocus } from './useModListFocus';

interface UseModListControllerOptions {
  mods: ModMeta[];
  searchQuery: string;
  isLoading: boolean;
  selectedMods: Set<string>;
  onToggleSelection: (fileName: string) => void;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onUpgradeMod: (mod: ModMeta) => void;
  onSelectMod: (mod: ModMeta) => void;
  onDeleteMod: (fileName: string) => void;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
}

interface VirtualRange {
  startIndex: number;
  endIndex: number;
}

export const useModListController = ({
  mods,
  searchQuery,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onUpgradeMod,
  onSelectMod,
  onDeleteMod,
  onNavigateOut
}: UseModListControllerOptions) => {
  const inputMode = useInputMode();
  const [viewMode, setViewMode] = useState<ModListViewMode>('standard');
  const [quickFilter, setQuickFilter] = useState<ModQuickFilter>('all');
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<ModGroupId>>(new Set());
  const [virtualRange, setVirtualRange] = useState<VirtualRange>({ startIndex: 0, endIndex: 48 });

  const data = useModListData({
    mods,
    searchQuery,
    quickFilter,
    collapsedGroupIds,
    isLoading
  });

  const { activeMods, renderEntries } = data;

  const focus = useModListFocus({
    mods: activeMods,
    renderEntries,
    inputMode,
    onNavigateOut,
    onSelectMod,
    onToggleSelection
  });
  const {
    clearOperationRow,
    defaultFocusKey,
    enterRowOperation,
    focusedRowFileName,
    focusRow,
    getActionFocusKey,
    getGroupHeaderFocusKey,
    getRowFocusKey,
    handleActionArrow,
    handleCancelHierarchy,
    handleRowArrow,
    operationRowFileName,
    preventLockedAction,
    requiresRowOperation,
    restoreSafeFocus,
    setFocusedRowFileName,
    trapFocus
  } = focus;

  const focusedRowIndex = useMemo(() => {
    return activeMods.findIndex((mod) => mod.fileName === focusedRowFileName);
  }, [activeMods, focusedRowFileName]);

  const iconRangeMods = useMemo(() => {
    const startIndex = Math.max(0, virtualRange.startIndex - 16);
    const endIndex = Math.min(renderEntries.length - 1, virtualRange.endIndex + 16);

    if (endIndex < startIndex) {
      return activeMods.slice(0, 40);
    }

    const rangeMods = renderEntries
      .slice(startIndex, endIndex + 1)
      .filter((entry) => entry.type === 'mod')
      .map((entry) => entry.mod);

    if (focusedRowIndex >= 0) {
      const focusStart = Math.max(0, focusedRowIndex - 8);
      const focusEnd = Math.min(activeMods.length, focusedRowIndex + 9);
      activeMods.slice(focusStart, focusEnd).forEach((mod) => {
        if (!rangeMods.some((item) => item.fileName === mod.fileName)) {
          rangeMods.push(mod);
        }
      });
    }

    return rangeMods;
  }, [activeMods, focusedRowIndex, renderEntries, virtualRange.endIndex, virtualRange.startIndex]);

  const iconSnapshots = useModIconSubscription({
    mods: activeMods,
    visibleMods: iconRangeMods,
    focusedRowFileName
  });

  const handleRowClick = useCallback((mod: ModMeta) => {
    setFocusedRowFileName(mod.fileName);

    if (requiresRowOperation) {
      focusRow(mod.fileName);
      return;
    }

    clearOperationRow();
    onSelectMod(mod);
  }, [clearOperationRow, focusRow, onSelectMod, requiresRowOperation, setFocusedRowFileName]);

  const handleToggleSelection = useCallback((fileName: string) => {
    onToggleSelection(fileName);
  }, [onToggleSelection]);

  const handleToggleMod = useCallback((fileName: string, currentEnabled: boolean) => {
    onToggleMod(fileName, currentEnabled);
  }, [onToggleMod]);

  const handleUpgradeMod = useCallback((mod: ModMeta) => {
    onUpgradeMod(mod);
  }, [onUpgradeMod]);

  const handleDeleteMod = useCallback((fileName: string) => {
    onDeleteMod(fileName);
  }, [onDeleteMod]);

  const handleViewModeChange = useCallback((nextViewMode: ModListViewMode) => {
    setViewMode(nextViewMode);
  }, []);

  const handleQuickFilterChange = useCallback((nextFilter: ModQuickFilter) => {
    setQuickFilter(nextFilter);
    setVirtualRange({ startIndex: 0, endIndex: 48 });
  }, []);

  const handleToggleGroup = useCallback((groupId: ModGroupId) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleRangeChanged = useCallback((range: VirtualRange) => {
    setVirtualRange((current) => {
      if (current.startIndex === range.startIndex && current.endIndex === range.endIndex) {
        return current;
      }

      return range;
    });
  }, []);

  const getIconSnapshot = useCallback((fileName: string): ModIconSnapshot | undefined => {
    return iconSnapshots[fileName];
  }, [iconSnapshots]);

  const getRowProps = useCallback((mod: ModMeta, rowIndex: number) => {
    return {
      mod,
      iconSnapshot: getIconSnapshot(mod.fileName),
      focusedRowFileName,
      operationRowFileName,
      requiresRowOperation,
      isSelected: selectedMods.has(mod.fileName),
      rowIndex,
      rowFocusKey: getRowFocusKey(mod.fileName),
      viewMode,
      onFocusRow: setFocusedRowFileName,
      onEnterRowOperation: enterRowOperation,
      onRowArrow: handleRowArrow,
      onRowClick: handleRowClick,
      onActionArrow: handleActionArrow,
      onPreventLockedAction: preventLockedAction,
      onToggleMod: handleToggleMod,
      onUpgradeMod: handleUpgradeMod,
      onToggleSelection: handleToggleSelection,
      onDeleteMod: handleDeleteMod,
      getActionFocusKey: getActionFocusKey as (fileName: string, action: RowAction) => string
    };
  }, [
    enterRowOperation,
    focusedRowFileName,
    getActionFocusKey,
    getIconSnapshot,
    getRowFocusKey,
    handleActionArrow,
    handleDeleteMod,
    handleRowArrow,
    handleRowClick,
    handleToggleMod,
    handleUpgradeMod,
    handleToggleSelection,
    operationRowFileName,
    preventLockedAction,
    requiresRowOperation,
    selectedMods,
    setFocusedRowFileName,
    viewMode
  ]);

  return {
    state: {
      isLoading,
      mods,
      searchedMods: data.searchedMods,
      activeMods,
      renderEntries,
      groups: data.groups,
      quickFilter,
      filterOptions: data.filterOptions,
      stats: data.stats,
      viewMode,
      showInitialLoading: data.showInitialLoading,
      showEmptyState: data.showEmptyState,
      showFilteredEmptyState: data.showFilteredEmptyState,
      showCollapsedState: data.showCollapsedState,
      showSyncingOverlay: data.showSyncingOverlay
    },
    focus: {
      defaultFocusKey,
      trapFocus,
      handleCancelHierarchy,
      restoreSafeFocus,
      handleRowArrow,
      getGroupHeaderFocusKey
    },
    controls: {
      onViewModeChange: handleViewModeChange,
      onQuickFilterChange: handleQuickFilterChange,
      onToggleGroup: handleToggleGroup,
      onRangeChanged: handleRangeChanged
    },
    getRowProps
  };
};
