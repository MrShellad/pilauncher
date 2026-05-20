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
  const [mods, setMods] = useState<ModMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  }, []);

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

  const prepareModScan = useCallback((requestId: string, context: ModScanContext) => {
    if (loadingExitTimerRef.current) {
      clearTimeout(loadingExitTimerRef.current);
      loadingExitTimerRef.current = null;
    }

    setIsLoading(true);
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

  const finishModScan = useCallback((requestId: string) => {
    if (activeModScanRequestRef.current === requestId) {
      activeModScanRequestRef.current = null;
      modScanContextRef.current = null;
    }
    finishLoadingSmoothly();
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
  }, [flushPendingScanMods, instanceId, scheduleScanFlush]);

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
