import { useCallback, useEffect, useRef, useState } from 'react';

import { useEvent } from '../../../../hooks/useEvent';
import {
  modService,
  resolveInstanceGameVersion,
  resolveInstanceLoader,
  type ModMeta,
  type ModMetadataSettings
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

export interface ModUpdateCheckProgress {
  stage: 'syncing' | 'checking';
  stageText: string;
  current: number;
  total: number;
  percent: number;
}

export const useModManager = (instanceId: string) => {
  const listState = useModListState(instanceId);
  const updateEngine = useModUpdateEngine({ setMods: listState.setMods });
  const { syncCloudMetadata } = useModCloudSync(instanceId);
  const [checkUpdateProgress, setCheckUpdateProgress] = useState<ModUpdateCheckProgress | null>(null);
  const {
    mods,
    setMods,
    isLoading,
    setIsLoading,
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
    cancelUpdateCheck: rawCancelUpdateCheck,
    runUpdateCheck
  } = updateEngine;

  const cancelUpdateCheck = useCallback(() => {
    rawCancelUpdateCheck();
    setCheckUpdateProgress(null);
  }, [rawCancelUpdateCheck]);

  const loadMods = useCallback(async (options: LoadModsOptions = {}) => {
    cancelUpdateCheck();

    const requestId = `${instanceId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      const config = await modService.getInstanceDetail(instanceId);
      setInstanceConfig(config);

      const targetMc = resolveInstanceGameVersion(config);
      const targetLoader = resolveInstanceLoader(config);
      const scopeKey = getUpdateScopeKey(instanceId, targetMc, targetLoader);
      const cache = updateCacheByInstance.get(scopeKey);
      const checkUpdates = !!options.checkUpdates;

      prepareModScan(requestId, { cache }, options.silent);

      const localMods = await modService.getMods(instanceId, requestId);
      flushPendingScanMods();
      const enrichedMods = localMods.map((mod) => applyCachedUpdateState(mod, cache));
      if (isActiveModScan(requestId)) {
        setMods(enrichedMods);
      }

      void (async () => {
        const syncedMods = await syncCloudMetadata(enrichedMods, {
          globalMetadataPlatform: config?.globalMetadataSettings?.metadataPlatform,
        });
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
      finishModScan(requestId, options.silent);
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
        // 1. 0ms 第一屏渲染：先从本地 manifest 缓存读取
        let hasCache = false;
        try {
          const cached = await modService.getCachedModManifest(instanceId);
          if (cancelled) return;
          if (cached && cached.length > 0) {
            setMods(cached);
            setIsLoading(false);
            hasCache = true;
          }
        } catch {
          // ignore cache read error and fall through
        }

        // 2. 获取实例配置
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

        // 3. 静默（如果有缓存）或常规扫描后端文件系统，自动核对是否有 mod 被外部删除
        await loadMods({ silent: hasCache, checkUpdates: shouldAutoCheckUpdates });
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
  }, [cancelUpdateCheck, instanceId, loadMods, setIsLoading, setMods]);

  useEffect(() => {
    const handleOnline = () => {
      void loadMods({ silent: true });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [loadMods]);

  const fsChangeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEvent('instance-resources-fs-changed', (payload) => {
    if (payload.instanceId !== instanceId || payload.resType !== 'mod') return;
    modService.invalidateModManifestCache(instanceId);

    if (fsChangeDebounceTimerRef.current) {
      clearTimeout(fsChangeDebounceTimerRef.current);
    }
    fsChangeDebounceTimerRef.current = setTimeout(() => {
      void loadMods({ silent: true });
    }, 300);
  });

  useEffect(() => {
    return () => {
      if (fsChangeDebounceTimerRef.current) {
        clearTimeout(fsChangeDebounceTimerRef.current);
      }
    };
  }, []);

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
    setCheckUpdateProgress({
      stage: 'syncing',
      stageText: '正在准备模组元数据...',
      current: 0,
      total: currentMods.length,
      percent: 0
    });

    try {
      const syncedMods = await syncCloudMetadata(currentMods, {
        globalMetadataPlatform: instanceConfig?.globalMetadataSettings?.metadataPlatform,
        onProgress: (current, total) => {
          setCheckUpdateProgress({
            stage: 'syncing',
            stageText: `正在同步模组元数据 (${current}/${total})...`,
            current,
            total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0
          });
        }
      });
      if (syncedMods !== currentMods) {
        setMods((current) => mergeSyncedModMetadata(current, currentMods, syncedMods));
      }

      await runUpdateCheck(
        scopeKey,
        syncedMods,
        targetMc,
        targetLoader,
        true,
        (current, total) => {
          setCheckUpdateProgress({
            stage: 'checking',
            stageText: `正在检测模组可用版本 (${current}/${total})...`,
            current,
            total,
            percent: total > 0 ? Math.round((current / total) * 100) : 0
          });
        }
      );
    } catch (error) {
      setIsCheckingModUpdates(false);
      setCheckUpdateProgress(null);
      throw error;
    } finally {
      setIsCheckingModUpdates(false);
      setCheckUpdateProgress(null);
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
    instanceConfig
  ]);

  const saveModMetadataSettings = useCallback(async (
    mod: ModMeta,
    settings: ModMetadataSettings
  ) => {
    await modService.updateModMetadataSettings(instanceId, mod.fileName, settings);
    const updatedMod: ModMeta = {
      ...mod,
      manifestEntry: mod.manifestEntry
        ? {
            ...mod.manifestEntry,
            metadataSettings: settings
          }
        : mod.manifestEntry
    };

    setMods((current) => current.map((item) => (
      item.fileName === mod.fileName ? updatedMod : item
    )));

    return updatedMod;
  }, [instanceId, setMods]);

  const reidentifyMod = useCallback(async (mod: ModMeta) => {
    await modService.resetModPlatformMetadata(instanceId, mod.fileName);
    const freshMods = await modService.getMods(instanceId);
    const freshMod = freshMods.find((m) => m.fileName === mod.fileName) || mod;
    const syncedMods = await syncCloudMetadata([freshMod], {
      force: true,
      globalMetadataPlatform: instanceConfig?.globalMetadataSettings?.metadataPlatform
    });
    const syncedMod = syncedMods[0] || freshMod;

    setMods((current) => mergeModBatch(current, [syncedMod]));
    return syncedMod;
  }, [instanceId, setMods, syncCloudMetadata, instanceConfig]);

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
    checkUpdateProgress,
    cancelUpdateCheck,
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
    saveModMetadataSettings,
    reidentifyMod,
    upgradeMod: operations.upgradeMod,
    installModVersion: operations.installModVersion,
    setMods,
    syncCloudMetadata
  };
};
