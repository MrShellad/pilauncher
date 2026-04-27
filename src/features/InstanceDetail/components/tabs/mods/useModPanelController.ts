import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLauncherStore } from '../../../../../store/useLauncherStore';
import { useToastStore } from '../../../../../store/useToastStore';
import { useModManager, type ModSortType } from '../../../hooks/useModManager';
import {
  analyzeModFileCleanupCandidates,
  areAllModFilesSelected,
  filterModsByQuery,
  pruneDeletedModSelections,
  pruneUnavailableModSelections,
  remapSelectedModsAfterBatchToggle,
  remapSelectedModsAfterToggle,
  toggleSelectAllModFiles,
  toggleSelectedModFile,
  type ModFileCleanupItem
} from '../../../logic/modPanelService';
import { useModPanelDialogs } from './useModPanelDialogs';

export const useModPanelController = (instanceId: string) => {
  const { t } = useTranslation();
  const {
    mods,
    isLoading,
    instanceConfig,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder,
    toggleMod,
    toggleMods,
    deleteMod,
    deleteMods,
    takeSnapshot,
    fetchHistory,
    diffSnapshots,
    doRollback,
    snapshotState,
    snapshotProgress,
    openModFolder,
    executeModFileCleanup,
    loadMods
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const addToast = useToastStore((state) => state.addToast);

  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupItems, setCleanupItems] = useState<ModFileCleanupItem[] | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  const handleDeletedMods = useCallback((fileNames: string[]) => {
    setSelectedMods((current) => pruneDeletedModSelections(current, fileNames));
  }, []);

  const { state: dialogState, actions: dialogActions } = useModPanelDialogs({
    fetchHistory,
    diffSnapshots,
    doRollback,
    toggleMod: (fileName, currentEnabled) => {
      const nextEnabled = !currentEnabled;
      setSelectedMods((current) => remapSelectedModsAfterToggle(current, fileName, nextEnabled));
      return toggleMod(fileName, currentEnabled);
    },
    deleteMod,
    deleteMods,
    onDeleteComplete: handleDeletedMods
  });

  const {
    openModDetail,
    openHistoryModal,
    syncHistoryAfterSnapshot,
    openDeleteConfirm
  } = dialogActions;

  useEffect(() => {
    const unlistenPromise = listen<{ current: number; total: number }>(
      'resource-download-progress',
      ({ payload }) => {
        if (!payload || payload.total <= 0 || payload.current < payload.total) {
          return;
        }

        window.setTimeout(() => {
          void loadMods();
        }, 500);
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [loadMods]);

  useEffect(() => {
    setSelectedMods((current) => pruneUnavailableModSelections(mods, current));
  }, [mods]);

  const handleCreateSnapshot = useCallback(async () => {
    try {
      const snapshot = await takeSnapshot(
        'USER_MANUAL',
        t('modSnapshots.messages.manualSnapshot', {
          count: mods.length,
          defaultValue: 'Manual Snapshot ({{count}} mods)'
        })
      );

      addToast('success', t('modSnapshots.messages.createSuccess', {
        count: snapshot.mods.length,
        defaultValue: 'Snapshot created successfully. Recorded {{count}} mods.'
      }));

      await syncHistoryAfterSnapshot();
    } catch (error) {
      console.error(error);
      addToast('error', t('modSnapshots.messages.createFailed', {
        defaultValue: 'Failed to create snapshot. Check the logs for details.'
      }));
    }
  }, [addToast, mods.length, syncHistoryAfterSnapshot, t, takeSnapshot]);

  const handleAnalyzeCleanup = useCallback(() => {
    const nextCleanupItems = analyzeModFileCleanupCandidates(mods);

    if (nextCleanupItems.length > 0) {
      setCleanupItems(nextCleanupItems);
      return;
    }

    addToast('info', t('modPanel.noModNamesToClean', {
      defaultValue: '没有找到包含中文或特殊标签的模组文件名。'
    }));
  }, [addToast, mods, t]);

  const closeCleanupDialog = useCallback(() => {
    setCleanupItems(null);
  }, []);

  const handleConfirmCleanup = useCallback(async () => {
    if (!cleanupItems) {
      return;
    }

    setIsCleaningUp(true);

    try {
      const result = await executeModFileCleanup(cleanupItems);
      addToast('success', t('modPanel.cleanSuccess', {
        count: result.renamed.length,
        defaultValue: `成功清理了 ${result.renamed.length} 个文件。`
      }));
    } catch (error) {
      console.error(error);

      const message = error instanceof Error ? error.message : String(error);
      addToast('error', t('modPanel.cleanFailed', {
        error: message,
        defaultValue: `清理失败: ${message}`
      }));
    } finally {
      setIsCleaningUp(false);
      setCleanupItems(null);
    }
  }, [addToast, cleanupItems, executeModFileCleanup, t]);

  const handleOpenDownload = useCallback(() => {
    setInstanceDownloadTarget('mod');
    setActiveTab('instance-mod-download');
  }, [setActiveTab, setInstanceDownloadTarget]);

  const handleSearchQueryChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const clearSearchQuery = useCallback(() => {
    setSearchQuery('');
  }, []);

  const handleSortClick = useCallback((type: ModSortType) => {
    if (sortType === type) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
      return;
    }

    setSortType(type);
    setSortOrder(type === 'time' ? 'desc' : 'asc');
  }, [setSortOrder, setSortType, sortOrder, sortType]);

  const handleToggleSelection = useCallback((fileName: string) => {
    setSelectedMods((current) => toggleSelectedModFile(current, fileName));
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedMods((current) => toggleSelectAllModFiles(mods, current));
  }, [mods]);

  const exitBatchMode = useCallback(() => {
    setSelectedMods(new Set());
  }, []);

  const handleBatchToggle = useCallback((enable: boolean) => {
    if (selectedMods.size === 0) {
      return;
    }

    const fileNames = Array.from(selectedMods);
    setSelectedMods((current) => remapSelectedModsAfterBatchToggle(current, fileNames, enable));
    void toggleMods(fileNames, enable);
  }, [selectedMods, toggleMods]);

  const handleBatchEnable = useCallback(() => {
    handleBatchToggle(true);
  }, [handleBatchToggle]);

  const handleBatchDisable = useCallback(() => {
    handleBatchToggle(false);
  }, [handleBatchToggle]);

  const handleBatchDelete = useCallback(() => {
    if (selectedMods.size === 0) {
      return;
    }

    openDeleteConfirm(Array.from(selectedMods));
  }, [openDeleteConfirm, selectedMods]);

  const handleToggleMod = useCallback((fileName: string, currentEnabled: boolean) => {
    const nextEnabled = !currentEnabled;
    setSelectedMods((current) => remapSelectedModsAfterToggle(current, fileName, nextEnabled));
    void toggleMod(fileName, currentEnabled);
  }, [toggleMod]);

  const handleDeleteMod = useCallback((fileName: string) => {
    openDeleteConfirm([fileName]);
  }, [openDeleteConfirm]);

  const filteredMods = useMemo(() => {
    return filterModsByQuery(mods, searchQuery);
  }, [mods, searchQuery]);

  const isBatchMode = selectedMods.size > 0;
  const isAllSelected = areAllModFilesSelected(mods, selectedMods);
  const searchPlaceholder = `搜索 ${mods.length} 个项目...`;
  const emptyMessage = searchQuery
    ? '没有匹配当前搜索的模组。'
    : '当前实例还没有模组。';

  return {
    state: {
      instanceConfig,
      mods,
      snapshotState,
      filteredMods,
      isLoading,
      selectedMods,
      isBatchMode
    },
    dialogs: {
      state: dialogState,
      actions: dialogActions
    },
    topBar: {
      isBatchMode,
      selectedCount: selectedMods.size,
      isAllSelected,
      searchQuery,
      searchPlaceholder,
      sortType,
      sortOrder,
      snapshotState,
      snapshotProgressPhase: snapshotProgress?.phase ?? null,
      onCreateSnapshot: handleCreateSnapshot,
      onOpenHistory: openHistoryModal,
      onOpenModFolder: openModFolder,
      onAnalyzeCleanup: handleAnalyzeCleanup,
      onOpenDownload: handleOpenDownload,
      onSearchQueryChange: handleSearchQueryChange,
      onClearSearch: clearSearchQuery,
      onSelectAll: handleSelectAll,
      onSortClick: handleSortClick,
      onBatchEnable: handleBatchEnable,
      onBatchDisable: handleBatchDisable,
      onBatchDelete: handleBatchDelete,
      onExitBatchMode: exitBatchMode
    },
    list: {
      mods: filteredMods,
      isLoading,
      selectedMods,
      onToggleSelection: handleToggleSelection,
      onToggleMod: handleToggleMod,
      onSelectMod: openModDetail,
      onDeleteMod: handleDeleteMod,
      emptyMessage
    },
    cleanupDialog: {
      items: cleanupItems,
      isOpen: cleanupItems !== null,
      isCleaningUp,
      onClose: closeCleanupDialog,
      onConfirm: handleConfirmCleanup,
      title: '清理模组文件名',
      headline: t('modPanel.cleanupHeadline', {
        count: cleanupItems?.length,
        defaultValue: `检测到 ${cleanupItems?.length ?? 0} 个包含中文或特殊标签的模组文件名，确定要清理它们吗？`
      }),
      confirmLabel: isCleaningUp ? '清理中...' : '确认清理',
      cancelLabel: '取消'
    }
  };
};
