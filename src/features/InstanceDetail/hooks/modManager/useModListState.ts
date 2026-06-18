import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { ModMeta } from '../../logic/modService';
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

  const setMods = useCallback((
    update: ModMeta[] | ((current: ModMeta[]) => ModMeta[])
  ) => {
    setRawMods((current) => {
      const next = typeof update === 'function' ? update(current) : update;
      return next.map((newMod) => {
        const existing = current.find((oldMod) => {
          if (oldMod.fileName === newMod.fileName) return true;
          if (newMod.cacheKey && oldMod.cacheKey && !newMod.cacheKey.startsWith('file_') && newMod.cacheKey === oldMod.cacheKey) return true;
          const newRef = newMod.manifestEntry?.source;
          const oldRef = oldMod.manifestEntry?.source;
          if (newRef?.platform && newRef?.projectId && oldRef?.platform && oldRef?.projectId) {
            if (newRef.platform === oldRef.platform && newRef.projectId === oldRef.projectId) {
              return true;
            }
          }
          return false;
        });

        if (existing) {
          return {
            ...newMod,
            version: newMod.version || existing.version,
            networkInfo: newMod.networkInfo || existing.networkInfo,
            networkIconUrl: newMod.networkIconUrl || existing.networkIconUrl || existing.networkInfo?.icon_url,
            isFetchingNetwork: newMod.isFetchingNetwork ?? existing.isFetchingNetwork,
            hasUpdate: newMod.hasUpdate ?? existing.hasUpdate,
            updateVersionName: newMod.updateVersionName ?? existing.updateVersionName,
            updateDownloadUrl: newMod.updateDownloadUrl ?? existing.updateDownloadUrl,
            updateFileId: newMod.updateFileId ?? existing.updateFileId,
            updateFileName: newMod.updateFileName ?? existing.updateFileName,
          };
        }
        return newMod;
      });
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
