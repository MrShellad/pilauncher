import { useCallback, useEffect } from 'react';

import {
  modService,
  resolveInstanceGameVersion,
  resolveInstanceLoader
} from '../../logic/modService';
import { useModCloudSync } from './useModCloudSync';
import { useModListState } from './useModListState';
import { useModOperations } from './useModOperations';
import { useModSnapshots } from './useModSnapshots';
import { useModSorting } from './useModSorting';
import { useModUpdateEngine } from './useModUpdateEngine';
import {
  applyCachedUpdateState,
  autoUpdateCheckedKeys,
  getUpdateScopeKey,
  mergeModBatch,
  mergeSyncedModMetadata,
  updateCacheByInstance,
  type LoadModsOptions,
  type ModSortOrder,
  type ModSortType
} from './modManagerShared';

export type { ModSortOrder, ModSortType };

export const useModManager = (instanceId: string) => {
  const listState = useModListState(instanceId);
  const updateEngine = useModUpdateEngine({ setMods: listState.setMods });
  const { syncCloudMetadata } = useModCloudSync(instanceId);
  const {
    mods,
    setMods,
    isLoading,
    instanceConfig,
    setInstanceConfig,
    flushPendingScanMods,
    prepareModScan,
    setModScanContext,
    isActiveModScan,
    finishModScan
  } = listState;
  const {
    isCheckingModUpdates,
    setIsCheckingModUpdates,
    cancelUpdateCheck,
    runUpdateCheck
  } = updateEngine;

  const loadMods = useCallback(async (options: LoadModsOptions = {}) => {
    cancelUpdateCheck();

    const requestId = `${instanceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    prepareModScan(requestId, {});

    try {
      const config = await modService.getInstanceDetail(instanceId);
      setInstanceConfig(config);

      const targetMc = resolveInstanceGameVersion(config);
      const targetLoader = resolveInstanceLoader(config);
      const scopeKey = getUpdateScopeKey(instanceId, targetMc, targetLoader);
      const cache = updateCacheByInstance.get(scopeKey);
      const checkUpdates = !!options.checkUpdates;

      setModScanContext({ cache });

      const localMods = await modService.getMods(instanceId, requestId);
      flushPendingScanMods();
      const enrichedMods = localMods.map((mod) => applyCachedUpdateState(mod, cache));
      if (isActiveModScan(requestId)) {
        setMods(enrichedMods);
      }

      void (async () => {
        const syncedMods = await syncCloudMetadata(enrichedMods);
        if (syncedMods !== enrichedMods) {
          setMods((current) => mergeModBatch(current, syncedMods));
        }
        if (checkUpdates) {
          await runUpdateCheck(scopeKey, syncedMods, targetMc, targetLoader, options.forceUpdateCheck);
        }
      })();
    } catch (error) {
      console.error(error);
    } finally {
      finishModScan(requestId);
    }
  }, [
    cancelUpdateCheck,
    finishModScan,
    flushPendingScanMods,
    instanceId,
    isActiveModScan,
    prepareModScan,
    runUpdateCheck,
    setInstanceConfig,
    setModScanContext,
    setMods,
    syncCloudMetadata,
  ]);

  useEffect(() => {
    let cancelled = false;

    const loadInitialMods = async () => {
      try {
        const config = await modService.getInstanceDetail(instanceId);
        if (cancelled) {
          return;
        }

        const targetMc = resolveInstanceGameVersion(config);
        const targetLoader = resolveInstanceLoader(config);
        const scopeKey = getUpdateScopeKey(instanceId, targetMc, targetLoader);
        const shouldAutoCheckUpdates = !autoUpdateCheckedKeys.has(scopeKey);

        if (shouldAutoCheckUpdates) {
          autoUpdateCheckedKeys.add(scopeKey);
        }

        await loadMods({ checkUpdates: shouldAutoCheckUpdates });
      } catch (error) {
        console.error(error);
        await loadMods();
      }
    };

    void loadInitialMods();

    return () => {
      cancelled = true;
      cancelUpdateCheck();
    };
  }, [cancelUpdateCheck, instanceId, loadMods]);

  const checkModUpdates = useCallback(async () => {
    const config = await modService.getInstanceDetail(instanceId);
    const targetMc = resolveInstanceGameVersion(config);
    const targetLoader = resolveInstanceLoader(config);
    const scopeKey = getUpdateScopeKey(instanceId, targetMc, targetLoader);
    const currentMods = mods;

    autoUpdateCheckedKeys.add(scopeKey);

    if (currentMods.length === 0) {
      await loadMods({ checkUpdates: true, forceUpdateCheck: true });
      return;
    }

    cancelUpdateCheck();
    setIsCheckingModUpdates(true);

    try {
      const syncedMods = await syncCloudMetadata(currentMods);
      if (syncedMods !== currentMods) {
        setMods((current) => mergeSyncedModMetadata(current, currentMods, syncedMods));
      }

      await runUpdateCheck(scopeKey, syncedMods, targetMc, targetLoader, true);
    } catch (error) {
      setIsCheckingModUpdates(false);
      throw error;
    }
  }, [
    cancelUpdateCheck,
    instanceId,
    loadMods,
    mods,
    runUpdateCheck,
    setIsCheckingModUpdates,
    setMods,
    syncCloudMetadata,
  ]);

  const sorting = useModSorting(mods, isLoading);
  const operations = useModOperations({
    instanceId,
    setMods,
    loadMods
  });
  const snapshots = useModSnapshots({ instanceId, loadMods });

  return {
    mods: sorting.sortedMods,
    isLoading,
    isCheckingModUpdates,
    instanceConfig,
    sortType: sorting.sortType,
    setSortType: sorting.setSortType,
    sortOrder: sorting.sortOrder,
    setSortOrder: sorting.setSortOrder,
    snapshotState: snapshots.snapshotState,
    snapshotProgress: snapshots.snapshotProgress,
    takeSnapshot: snapshots.takeSnapshot,
    fetchHistory: snapshots.fetchHistory,
    diffSnapshots: snapshots.diffSnapshots,
    doRollback: snapshots.doRollback,
    toggleMod: operations.toggleMod,
    toggleMods: operations.toggleMods,
    deleteMod: operations.deleteMod,
    deleteMods: operations.deleteMods,
    openModFolder: operations.openModFolder,
    executeModFileCleanup: operations.executeModFileCleanup,
    loadMods,
    checkModUpdates,
    upgradeMod: operations.upgradeMod,
    installModVersion: operations.installModVersion
  };
};
