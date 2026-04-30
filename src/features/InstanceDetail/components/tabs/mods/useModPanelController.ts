import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import type { ModMeta } from '../../../logic/modService';
import type { OreProjectVersion } from '../../../logic/modrinthApi';
import { useModPanelDialogs } from './useModPanelDialogs';

const RESOURCE_REFRESH_DELAY_MS = 700;
const RESOURCE_DONE_DEDUPE_MS = 2000;

interface ResourceDownloadProgressPayload {
  task_id?: string;
  file_name?: string;
  stage?: string;
  current?: number;
  total?: number;
}

const getResourceProgressKey = (payload: ResourceDownloadProgressPayload | null | undefined) =>
  String(payload?.task_id || payload?.file_name || '').trim();

const isCompletedResourceDownload = (payload: ResourceDownloadProgressPayload | null | undefined) => {
  const key = getResourceProgressKey(payload);
  if (!key || key === 'java_download') return false;

  return payload?.stage === 'DONE'
    || (
      typeof payload?.current === 'number'
      && typeof payload?.total === 'number'
      && payload.total > 0
      && payload.current >= payload.total
    );
};

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
    loadMods,
    checkModUpdates,
    upgradeMod,
    installModVersion
  } = useModManager(instanceId);

  const setActiveTab = useLauncherStore((state) => state.setActiveTab);
  const setInstanceDownloadTarget = useLauncherStore((state) => state.setInstanceDownloadTarget);
  const addToast = useToastStore((state) => state.addToast);

  const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupItems, setCleanupItems] = useState<ModFileCleanupItem[] | null>(null);
  const [isCleaningUp, setIsCleaningUp] = useState(false);
  const [pendingUpgradeMod, setPendingUpgradeMod] = useState<ModMeta | null>(null);
  const [pendingUpgradeVersion, setPendingUpgradeVersion] = useState<OreProjectVersion | null>(null);
  const [isPreparingUpgradeSnapshot, setIsPreparingUpgradeSnapshot] = useState(false);
  const upgradeSnapshotPromptHandledRef = useRef(false);

  useEffect(() => {
    upgradeSnapshotPromptHandledRef.current = false;
    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
    setIsPreparingUpgradeSnapshot(false);
  }, [instanceId]);

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
    let disposed = false;
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let isRefreshing = false;
    let refreshAgain = false;
    let lastDoneKey = '';
    let lastDoneAt = 0;

    const runRefresh = async () => {
      if (disposed) return;

      if (isRefreshing) {
        refreshAgain = true;
        return;
      }

      isRefreshing = true;
      try {
        await loadMods();
      } finally {
        isRefreshing = false;
        if (refreshAgain && !disposed) {
          refreshAgain = false;
          scheduleRefresh();
        }
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        void runRefresh();
      }, RESOURCE_REFRESH_DELAY_MS);
    };

    const unlistenPromise = listen<ResourceDownloadProgressPayload>(
      'resource-download-progress',
      ({ payload }) => {
        if (!isCompletedResourceDownload(payload)) return;

        const doneKey = getResourceProgressKey(payload);
        const now = Date.now();
        if (doneKey === lastDoneKey && now - lastDoneAt < RESOURCE_DONE_DEDUPE_MS) return;

        lastDoneKey = doneKey;
        lastDoneAt = now;
        scheduleRefresh();
      }
    );

    return () => {
      disposed = true;
      if (refreshTimer) clearTimeout(refreshTimer);
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

  const handleCheckModUpdates = useCallback(() => {
    void checkModUpdates();
  }, [checkModUpdates]);

  const executeUpgradeMod = useCallback(async (mod: ModMeta, version?: OreProjectVersion | null) => {
    try {
      if (version) {
        await installModVersion(mod, version);
      } else {
        await upgradeMod(mod);
      }
      addToast('success', t('modPanel.upgradeSuccess', {
        name: mod.name || mod.fileName,
        defaultValue: `已安装 ${mod.name || mod.fileName}。`
      }));
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      addToast('error', t('modPanel.upgradeFailed', {
        error: message,
        defaultValue: `升级失败: ${message}`
      }));
    }
  }, [addToast, installModVersion, t, upgradeMod]);

  const handleUpgradeMod = useCallback((mod: ModMeta, version?: OreProjectVersion) => {
    if ((!version && !mod.hasUpdate) || mod.isUpdatingMod) {
      return;
    }

    if (!upgradeSnapshotPromptHandledRef.current) {
      setPendingUpgradeMod(mod);
      setPendingUpgradeVersion(version || null);
      return;
    }

    void executeUpgradeMod(mod, version || null);
  }, [executeUpgradeMod]);

  const closeUpgradeSnapshotPrompt = useCallback(() => {
    if (isPreparingUpgradeSnapshot) {
      return;
    }

    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
  }, [isPreparingUpgradeSnapshot]);

  const confirmUpgradeWithSnapshot = useCallback(async () => {
    if (!pendingUpgradeMod) {
      return;
    }

    setIsPreparingUpgradeSnapshot(true);

    try {
      await takeSnapshot(
        'MOD_UPDATE',
        t('modPanel.beforeUpgradeSnapshotMessage', {
          name: pendingUpgradeMod.name || pendingUpgradeMod.fileName,
          defaultValue: `升级 ${pendingUpgradeMod.name || pendingUpgradeMod.fileName} 前的快照`
        })
      );
      upgradeSnapshotPromptHandledRef.current = true;
      const modToUpgrade = pendingUpgradeMod;
      const versionToInstall = pendingUpgradeVersion;
      setPendingUpgradeMod(null);
      setPendingUpgradeVersion(null);
      await executeUpgradeMod(modToUpgrade, versionToInstall);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : String(error);
      addToast('error', t('modPanel.beforeUpgradeSnapshotFailed', {
        error: message,
        defaultValue: `创建升级前快照失败: ${message}`
      }));
    } finally {
      setIsPreparingUpgradeSnapshot(false);
    }
  }, [addToast, executeUpgradeMod, pendingUpgradeMod, pendingUpgradeVersion, t, takeSnapshot]);

  const skipUpgradeSnapshot = useCallback(() => {
    if (!pendingUpgradeMod || isPreparingUpgradeSnapshot) {
      return;
    }

    upgradeSnapshotPromptHandledRef.current = true;
    const modToUpgrade = pendingUpgradeMod;
    const versionToInstall = pendingUpgradeVersion;
    setPendingUpgradeMod(null);
    setPendingUpgradeVersion(null);
    void executeUpgradeMod(modToUpgrade, versionToInstall);
  }, [executeUpgradeMod, isPreparingUpgradeSnapshot, pendingUpgradeMod, pendingUpgradeVersion]);

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

  const filteredMods = useMemo(() => {
    return filterModsByQuery(mods, searchQuery);
  }, [mods, searchQuery]);

  const isBatchMode = selectedMods.size > 0;
  const isAllSelected = areAllModFilesSelected(mods, selectedMods);
  const isCheckingModUpdates = mods.some((mod) => mod.isCheckingUpdate);
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
    modActions: {
      onInstallVersion: handleUpgradeMod
    },
    topBar: {
      snapshotState,
      snapshotProgressPhase: snapshotProgress?.phase ?? null,
      isCheckingModUpdates,
      onCreateSnapshot: handleCreateSnapshot,
      onOpenHistory: openHistoryModal,
      onOpenModFolder: openModFolder,
      onAnalyzeCleanup: handleAnalyzeCleanup,
      onCheckModUpdates: handleCheckModUpdates,
      onOpenDownload: handleOpenDownload
    },
    list: {
      mods,
      isLoading,
      selectedMods,
      isBatchMode,
      isAllSelected,
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
    upgradeSnapshotDialog: {
      isOpen: pendingUpgradeMod !== null,
      mod: pendingUpgradeMod,
      isCreatingSnapshot: isPreparingUpgradeSnapshot,
      onClose: closeUpgradeSnapshotPrompt,
      onConfirm: confirmUpgradeWithSnapshot,
      onSkip: skipUpgradeSnapshot
    }
  };
};
