import { useCallback, useMemo } from 'react';

import { useInputMode } from '../../../../../ui/focus/FocusProvider';
import type { ModIconSnapshot } from '../../../logic/modIconService';
import type { ModMeta } from '../../../logic/modService';
import {
  DEFAULT_INCREMENTAL_PAGE_SIZE,
  type RowAction
} from './modListShared';
import { useIncrementalList } from './useIncrementalList';
import { useModIconSubscription } from './useModIconSubscription';
import { useModListFocus } from './useModListFocus';

interface UseModListControllerOptions {
  mods: ModMeta[];
  isLoading: boolean;
  selectedMods: Set<string>;
  onToggleSelection: (fileName: string) => void;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onSelectMod: (mod: ModMeta) => void;
  onDeleteMod: (fileName: string) => void;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
}

export const useModListController = ({
  mods,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onSelectMod,
  onDeleteMod,
  onNavigateOut
}: UseModListControllerOptions) => {
  const inputMode = useInputMode();

  const focus = useModListFocus({
    mods,
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
    return mods.findIndex((mod) => mod.fileName === focusedRowFileName);
  }, [focusedRowFileName, mods]);

  const incremental = useIncrementalList({
    items: mods,
    getItemKey: (mod) => mod.fileName,
    pageSize: DEFAULT_INCREMENTAL_PAGE_SIZE,
    ensureVisibleIndex: focusedRowIndex
  });

  const iconSnapshots = useModIconSubscription({
    mods,
    visibleMods: incremental.visibleItems,
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

  const handleDeleteMod = useCallback((fileName: string) => {
    onDeleteMod(fileName);
  }, [onDeleteMod]);

  const getIconSnapshot = useCallback((fileName: string): ModIconSnapshot | undefined => {
    return iconSnapshots[fileName];
  }, [iconSnapshots]);

  const getRowProps = useCallback((mod: ModMeta) => {
    return {
      mod,
      iconSnapshot: getIconSnapshot(mod.fileName),
      focusedRowFileName,
      operationRowFileName,
      requiresRowOperation,
      isSelected: selectedMods.has(mod.fileName),
      rowFocusKey: getRowFocusKey(mod.fileName),
      onFocusRow: setFocusedRowFileName,
      onEnterRowOperation: enterRowOperation,
      onRowArrow: handleRowArrow,
      onRowClick: handleRowClick,
      onActionArrow: handleActionArrow,
      onPreventLockedAction: preventLockedAction,
      onToggleMod: handleToggleMod,
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
    handleToggleSelection,
    operationRowFileName,
    preventLockedAction,
    requiresRowOperation,
    selectedMods,
    setFocusedRowFileName
  ]);

  return {
    state: {
      isLoading,
      mods,
      visibleMods: incremental.visibleItems,
      showInitialLoading: isLoading && mods.length === 0,
      showEmptyState: !isLoading && mods.length === 0,
      showSyncingOverlay: isLoading && mods.length > 0
    },
    focus: {
      defaultFocusKey,
      trapFocus,
      handleCancelHierarchy,
      restoreSafeFocus
    },
    incremental,
    getRowProps
  };
};
