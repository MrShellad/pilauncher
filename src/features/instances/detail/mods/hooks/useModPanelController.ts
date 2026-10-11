import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useLauncherStore } from '../../../../../app/stores/useLauncherStore';
import { useToastStore } from '../../../../../shared/stores/useToastStore';
import { useModManager, type ModSortType } from '../../hooks/useModManager';
import { mergeModBatch } from '../../hooks/mod-manager/modManagerShared';
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
} from '../../logic/modPanelService';
import { modService, type ModMeta, type ModMetadataSettings } from '../../../../instance-resources';
import { useModPanelDialogs } from './useModPanelDialogs';
import { useModPanelResourceRefresh } from './useModPanelResourceRefresh';
import { useModUpgradeActions } from './useModUpgradeActions';

export const useModPanelController = (instanceId: string) => {
  const { t } = useTranslation();
  const {
    mods,
    isLoading,
    isCheckingModUpdates,
    checkUpdateProgress,
    cancelUpdateCheck,
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
    loadMods,
    checkModUpdates,
    saveModMetadataSettings,
    reidentifyMod,
    upgradeMod,
    installModVersion,
    setMods,
    syncCloudMetadata
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const addToast = useToastStore((state) => state.addToast);

  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupItems, setCleanupItems] = useState<ModFileCleanupItem[] | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const {
    dependencyHealth,
    refreshDependencyHealth,
    isBatchUpgradeRunningRef,
  } = useModPanelResourceRefresh({
    instanceId,
    mods,
    isLoading,
    loadMods,
  });

  const handleDeletedMods = useCallback((fileNames: string[]) => {
    setSelectedMods((current) => pruneDeletedModSelections(current, fileNames));
  }, []);

  const { state: dialogState, actions: dialogActions } = useModPanelDialogs({
    mods,
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
    openDeleteConfirm,
    openGlobalMetadata
  } = dialogActions;

  const {
    handleUpdateAllMods,
    handleUpgradeMod,
    upgradeSnapshotDialog,
  } = useModUpgradeActions({
    instanceId,
    mods,
    upgradeMod,
    installModVersion,
    loadMods,
    takeSnapshot,
    syncHistoryAfterSnapshot,
    addToast,
    t,
    isBatchUpgradeRunningRef,
  });

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

  const handleCheckModUpdates = useCallback(() => {
    void checkModUpdates();
  }, [checkModUpdates]);

  const handleMetadataResolved = useCallback((updatedMod: ModMeta) => {
    setMods((current) => {
      let changed = false;
      const nextMods = current.map((mod) => {
        if (mod.fileName !== updatedMod.fileName) {
          return mod;
        }

        const nextMod = {
          ...mod,
          name: mod.name || updatedMod.name,
          description: mod.description || updatedMod.description,
          networkInfo: updatedMod.networkInfo || mod.networkInfo,
          networkIconUrl: updatedMod.networkIconUrl || updatedMod.networkInfo?.icon_url || mod.networkIconUrl,
          iconAbsolutePath: updatedMod.iconAbsolutePath || mod.iconAbsolutePath,
          offlineJarIconAbsolutePath: updatedMod.offlineJarIconAbsolutePath || mod.offlineJarIconAbsolutePath,
          isFetchingNetwork: false
        };

        const sameNetworkInfo = (
          nextMod.networkInfo === mod.networkInfo ||
          (
            nextMod.networkInfo?.id === mod.networkInfo?.id &&
            nextMod.networkInfo?.title === mod.networkInfo?.title &&
            nextMod.networkInfo?.description === mod.networkInfo?.description &&
            nextMod.networkInfo?.icon_url === mod.networkInfo?.icon_url &&
            nextMod.networkInfo?.source === mod.networkInfo?.source
          )
        );

        if (
          nextMod.name === mod.name &&
          nextMod.description === mod.description &&
          sameNetworkInfo &&
          nextMod.networkIconUrl === mod.networkIconUrl &&
          nextMod.iconAbsolutePath === mod.iconAbsolutePath &&
          nextMod.offlineJarIconAbsolutePath === mod.offlineJarIconAbsolutePath &&
          nextMod.isFetchingNetwork === mod.isFetchingNetwork
        ) {
          return mod;
        }

        changed = true;
        return nextMod;
      });

      if (changed) {
        void refreshDependencyHealth();
      }
      return changed ? nextMods : current;
    });
  }, [setMods, refreshDependencyHealth]);

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
    setSortOrder(type === 'time' || type === 'update' ? 'desc' : 'asc');
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

  const saveGlobalMetadataSettings = useCallback(async (settings: ModMetadataSettings, skipReload = false) => {
    try {
      await modService.updateAllModsMetadataSettings(instanceId, settings);
      addToast('success', t('instanceDetail.mods.globalMetadataSettingsSaved', '全局元数据设置已保存'));
      if (!skipReload) {
        void loadMods({ silent: true });
      }
    } catch (error) {
      console.error(error);
      addToast('error', t('instanceDetail.mods.globalMetadataSettingsSaveFailed', '保存全局元数据设置失败'));
    }
  }, [instanceId, loadMods, addToast, t]);

  const [isReidentifyingAll, setIsReidentifyingAll] = useState(false);

  const reidentifyAllMods = useCallback(async (progressCallback?: unknown) => {
    if (isReidentifyingAll) return;
    setIsReidentifyingAll(true);
    const onProgress = typeof progressCallback === 'function' ? (progressCallback as (current: number, total: number) => void) : undefined;
    try {
      await modService.resetAllModsPlatformMetadata(instanceId);
      addToast('info', t('instanceDetail.mods.metadataResetStart', '元数据已重置，正在重新云端匹配所有模组...'));
      const freshMods = await modService.getMods(instanceId);
      const synced = await syncCloudMetadata(freshMods, {
        force: true,
        onProgress,
        onIncrementalUpdate: (updatedMap) => {
          setMods((currentMods) => currentMods.map((mod) => {
            const updated = updatedMap.get(mod.fileName);
            if (!updated) return mod;
            return {
              ...mod,
              ...updated,
              // Cloud identification enriches metadata only. A concurrent local
              // toggle remains authoritative for the file name and enabled state.
              fileName: mod.fileName,
              isEnabled: mod.isEnabled,
              manifestEntry: updated.manifestEntry
                ? ({
                    ...(mod.manifestEntry || {}),
                    ...updated.manifestEntry,
                    matchedPlatforms: {
                      ...(mod.manifestEntry?.matchedPlatforms || {}),
                      ...(updated.manifestEntry.matchedPlatforms || {})
                    }
                  } as ModMeta['manifestEntry'])
                : mod.manifestEntry
            };
          }));
        },
        globalMetadataPlatform: instanceConfig?.globalMetadataSettings?.metadataPlatform
      });
      setMods((current) => mergeModBatch(current, synced));
      void refreshDependencyHealth();
      addToast('success', t('instanceDetail.mods.cloudMatchComplete', '云端元数据拉取完成'));
    } catch (error) {
      console.error(error);
      addToast('error', t('instanceDetail.mods.cloudMatchFailed', '重新匹配失败'));
      throw error;
    } finally {
      setIsReidentifyingAll(false);
    }
  }, [instanceId, syncCloudMetadata, setMods, addToast, t, instanceConfig, isReidentifyingAll, refreshDependencyHealth]);

  const filteredMods = useMemo(() => {
    return filterModsByQuery(mods, searchQuery);
  }, [mods, searchQuery]);

  const isBatchMode = selectedMods.size > 0;
  const isAllSelected = areAllModFilesSelected(mods, selectedMods);
  const searchPlaceholder = t('instanceDetail.mods.searchPlaceholderCount', { count: mods.length, defaultValue: `搜索 ${mods.length} 个项目...` });
  const emptyMessage = searchQuery
    ? t('instanceDetail.mods.emptySearch', '没有匹配当前搜索的模组。')
    : t('instanceDetail.mods.emptyInstance', '当前实例还没有模组。');

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
      actions: {
        ...dialogActions,
        onSaveGlobalMetadataSettings: saveGlobalMetadataSettings,
        onReidentifyAllMods: reidentifyAllMods
      }
    },
    modActions: {
      onInstallVersion: handleUpgradeMod,
      onSaveMetadataSettings: saveModMetadataSettings,
      onReidentifyMod: async (mod: ModMeta) => {
        const res = await reidentifyMod(mod);
        void refreshDependencyHealth();
        return res;
      },
      onMetadataResolved: handleMetadataResolved
    },
    topBar: {
      snapshotState,
      snapshotProgressPhase: snapshotProgress?.phase ?? null,
      onCreateSnapshot: handleCreateSnapshot,
      onOpenHistory: openHistoryModal,
      onOpenModFolder: openModFolder,
      onAnalyzeCleanup: handleAnalyzeCleanup,
      onOpenDownload: handleOpenDownload
    },
    list: {
      instanceId,
      mods,
      dependencyHealth,
      isLoading,
      selectedMods,
      isBatchMode,
      isAllSelected,
      isCheckingModUpdates,
      checkUpdateProgress,
      isReidentifyingAll,
      searchQuery,
      searchPlaceholder,
      sortType,
      sortOrder,
      onSearchQueryChange: handleSearchQueryChange,
      onClearSearch: clearSearchQuery,
      onSelectAll: handleSelectAll,
      onSortClick: handleSortClick,
      onToggleSelection: handleToggleSelection,
      onToggleMod: handleToggleMod,
      onUpgradeMod: handleUpgradeMod,
      onSelectMod: openModDetail,
      onDeleteMod: handleDeleteMod,
      onBatchEnable: handleBatchEnable,
      onBatchDisable: handleBatchDisable,
      onBatchDelete: handleBatchDelete,
      onExitBatchMode: exitBatchMode,
      onOpenModMetadataSettings: openGlobalMetadata,
      onReidentifyAllMods: reidentifyAllMods,
      onCheckModUpdates: handleCheckModUpdates,
      onCancelCheckModUpdates: cancelUpdateCheck,
      onUpdateAllMods: handleUpdateAllMods,
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
    },
    upgradeSnapshotDialog
  };
};
