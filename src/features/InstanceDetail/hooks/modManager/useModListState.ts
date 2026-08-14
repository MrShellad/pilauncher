import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ModMeta } from '../../logic/modService';
import { getModIdentityKey } from '../../logic/modService';
import {
  applyCachedUpdateState,
  LOADING_EXIT_DELAY_MS,
  mergeModBatch,
  SCAN_STATE_FLUSH_INTERVAL_MS,
  type ModScanContext,
  type ModScanProgressPayload
} from './modManagerShared';

export const useModListState = (instanceId: string) => {
  const [mods, setRawMods] = useState<ModMeta[]>([]);

  const areEquivalent = (left: ModMeta, right: ModMeta) => {
    const leftManifest = JSON.stringify(left.manifestEntry || null);
    const rightManifest = JSON.stringify(right.manifestEntry || null);
    const leftNetwork = left.networkInfo;
    const rightNetwork = right.networkInfo;

    return left.fileName === right.fileName
      && left.modId === right.modId
      && left.name === right.name
      && left.version === right.version
      && left.description === right.description
      && left.iconAbsolutePath === right.iconAbsolutePath
      && left.offlineJarIconAbsolutePath === right.offlineJarIconAbsolutePath
      && left.networkIconUrl === right.networkIconUrl
      && left.fileSize === right.fileSize
      && left.isEnabled === right.isEnabled
      && left.modifiedAt === right.modifiedAt
      && left.isFetchingNetwork === right.isFetchingNetwork
      && left.hasUpdate === right.hasUpdate
      && left.updateVersionName === right.updateVersionName
      && left.updateFileId === right.updateFileId
      && left.updateFileName === right.updateFileName
      && left.updateDownloadUrl === right.updateDownloadUrl
      && left.isCheckingUpdate === right.isCheckingUpdate
      && left.isUpdatingMod === right.isUpdatingMod
      && left.cacheKey === right.cacheKey
      && left.curseforgeFingerprint === right.curseforgeFingerprint
      && JSON.stringify(left.dependencies || []) === JSON.stringify(right.dependencies || [])
      && leftManifest === rightManifest
      && (leftNetwork === rightNetwork || (
        leftNetwork?.id === rightNetwork?.id
        && leftNetwork?.title === rightNetwork?.title
        && leftNetwork?.description === rightNetwork?.description
        && leftNetwork?.icon_url === rightNetwork?.icon_url
        && leftNetwork?.source === rightNetwork?.source
      ));
  };

  const setMods = useCallback((
    update: ModMeta[] | ((current: ModMeta[]) => ModMeta[])
  ) => {
    setRawMods((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      const currentByIdentity = new Map(current.map((mod) => [getModIdentityKey(mod), mod]));
      let hasChanged = current.length !== next.length;

      const reconciled = next.map((newMod) => {
        const existing = currentByIdentity.get(getModIdentityKey(newMod))
          || current.find((oldMod) => oldMod.fileName === newMod.fileName);

        if (existing) {
          const merged = {
            ...newMod,
            version: newMod.version || existing.version,
            iconAbsolutePath: newMod.iconAbsolutePath || existing.iconAbsolutePath,
            offlineJarIconAbsolutePath: newMod.offlineJarIconAbsolutePath || existing.offlineJarIconAbsolutePath,
            networkInfo: newMod.networkInfo || existing.networkInfo,
            networkIconUrl: newMod.networkIconUrl || existing.networkIconUrl || existing.networkInfo?.icon_url,
            isFetchingNetwork: newMod.isFetchingNetwork ?? existing.isFetchingNetwork,
            hasUpdate: newMod.hasUpdate ?? existing.hasUpdate,
            updateVersionName: newMod.updateVersionName ?? existing.updateVersionName,
            updateDownloadUrl: newMod.updateDownloadUrl ?? existing.updateDownloadUrl,
            updateFileId: newMod.updateFileId ?? existing.updateFileId,
            updateFileName: newMod.updateFileName ?? existing.updateFileName,
          };

          if (areEquivalent(existing, merged)) {
            return existing;
          }

          hasChanged = true;
          return merged;
        }
        hasChanged = true;
        return newMod;
      });

      if (!hasChanged && reconciled.every((mod, index) => mod === current[index])) {
        return current;
      }

      return reconciled;
    });
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [instanceConfig, setInstanceConfig] = useState<any>(null);

  const activeModScanRequestRef = useRef<string | null>(null);
  const modScanContextRef = useRef<ModScanContext | null>(null);
  const pendingScanModsRef = useRef<ModMeta[]>([]);
  const scanFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushPendingScanMods = useCallback(() => {
    if (scanFlushTimerRef.current) {
      clearTimeout(scanFlushTimerRef.current);
      scanFlushTimerRef.current = null;
    }

    const pending = pendingScanModsRef.current;
    pendingScanModsRef.current = [];
    if (pending.length === 0) {
      return;
    }

    setMods((current) => mergeModBatch(current, pending));
  }, [setMods]);

  const scheduleScanFlush = useCallback(() => {
    if (scanFlushTimerRef.current) {
      return;
    }

    scanFlushTimerRef.current = setTimeout(flushPendingScanMods, SCAN_STATE_FLUSH_INTERVAL_MS);
  }, [flushPendingScanMods]);

  const finishLoadingSmoothly = useCallback(() => {
    if (loadingExitTimerRef.current) {
      clearTimeout(loadingExitTimerRef.current);
    }

    loadingExitTimerRef.current = setTimeout(() => {
      loadingExitTimerRef.current = null;
      setIsLoading(false);
    }, LOADING_EXIT_DELAY_MS);
  }, []);

  const prepareModScan = useCallback((requestId: string, context: ModScanContext, silent = false) => {
    if (loadingExitTimerRef.current) {
      clearTimeout(loadingExitTimerRef.current);
      loadingExitTimerRef.current = null;
    }

    if (!silent) {
      setIsLoading(true);
    }
    pendingScanModsRef.current = [];
    activeModScanRequestRef.current = requestId;
    modScanContextRef.current = context;
  }, []);

  const setModScanContext = useCallback((context: ModScanContext) => {
    modScanContextRef.current = context;
  }, []);

  const isActiveModScan = useCallback((requestId: string) => {
    return activeModScanRequestRef.current === requestId;
  }, []);

  const finishModScan = useCallback((requestId: string, silent = false) => {
    if (activeModScanRequestRef.current === requestId) {
      activeModScanRequestRef.current = null;
      modScanContextRef.current = null;
    }
    if (!silent) {
      finishLoadingSmoothly();
    }
  }, [finishLoadingSmoothly]);

  useEffect(() => {
    return () => {
      if (scanFlushTimerRef.current) {
        clearTimeout(scanFlushTimerRef.current);
      }
      if (loadingExitTimerRef.current) {
        clearTimeout(loadingExitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<ModScanProgressPayload>(
      'instance-mods-scan-progress',
      ({ payload }) => {
        if (payload.instanceId !== instanceId || payload.requestId !== activeModScanRequestRef.current) {
          return;
        }

        const context = modScanContextRef.current;
        const nextMods = payload.mods.map((mod) => (
          applyCachedUpdateState(mod, context?.cache)
        ));

        if (payload.complete) {
          flushPendingScanMods();
          setMods(nextMods);
          return;
        }

        pendingScanModsRef.current = mergeModBatch(pendingScanModsRef.current, nextMods);
        scheduleScanFlush();
      }
    );

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [flushPendingScanMods, instanceId, scheduleScanFlush, setMods]);

  return {
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
  };
};
