import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import type { ModMeta } from '../../logic/modService';
import {
  buildUpdateCacheEntry,
  canCheckManagedUpdate,
  fetchManagedVersions,
  getModUpdateCacheKey,
  getOrCreateUpdateCache,
  isFreshUpdateCacheEntry,
  UPDATE_CHECK_CONCURRENCY,
  UPDATE_STATE_FLUSH_INTERVAL_MS,
  UPDATE_STATE_FLUSH_SIZE,
  type ModUpdateCacheEntry
} from './modManagerShared';

interface UseModUpdateEngineOptions {
  setMods: Dispatch<SetStateAction<ModMeta[]>>;
}

export const useModUpdateEngine = ({ setMods }: UseModUpdateEngineOptions) => {
  const [isCheckingModUpdates, setIsCheckingModUpdates] = useState(false);
  const updateAbortControllerRef = useRef<AbortController | null>(null);

  const cancelUpdateCheck = useCallback(() => {
    updateAbortControllerRef.current?.abort();
    updateAbortControllerRef.current = null;
    setIsCheckingModUpdates(false);
  }, []);

  const runUpdateCheck = useCallback(async (
    scopeKey: string,
    modsToCheck: ModMeta[],
    targetMc: string,
    targetLoader: string,
    force = false
  ) => {
    cancelUpdateCheck();

    const abortController = new AbortController();
    updateAbortControllerRef.current = abortController;
    setIsCheckingModUpdates(true);
    const { signal } = abortController;
    const cache = getOrCreateUpdateCache(scopeKey);
    const targetsByCacheKey = new Map<string, ModMeta>();

    for (const mod of modsToCheck) {
      const source = mod.manifestEntry?.source;

      if (!canCheckManagedUpdate(mod) || !source?.projectId || !source.fileId) {
        continue;
      }

      const cacheKey = getModUpdateCacheKey(mod);
      if (!force && isFreshUpdateCacheEntry(cache.get(cacheKey))) {
        continue;
      }

      targetsByCacheKey.set(cacheKey, mod);
    }

    const targets = Array.from(targetsByCacheKey.entries());
    if (targets.length === 0) {
      if (updateAbortControllerRef.current === abortController) {
        updateAbortControllerRef.current = null;
        setIsCheckingModUpdates(false);
      }
      return;
    }

    let cursor = 0;
    let completed = 0;
    let lastFlushAt = Date.now();
    const pendingEntries = new Map<string, ModUpdateCacheEntry>();

    const flushPendingEntries = () => {
      if (signal.aborted || pendingEntries.size === 0) {
        return;
      }

      const entries = new Map(pendingEntries);
      pendingEntries.clear();
      lastFlushAt = Date.now();

      setMods((current) => current.map((item) => {
        const cacheEntry = entries.get(getModUpdateCacheKey(item));

        if (!cacheEntry) {
          return item;
        }

        return {
          ...item,
          hasUpdate: cacheEntry.hasUpdate,
          updateVersionName: cacheEntry.updateVersionName,
          updateDownloadUrl: cacheEntry.updateDownloadUrl,
          updateFileId: cacheEntry.updateFileId,
          updateFileName: cacheEntry.updateFileName
        };
      }));
    };

    const shouldFlush = () => {
      return pendingEntries.size >= UPDATE_STATE_FLUSH_SIZE ||
        Date.now() - lastFlushAt >= UPDATE_STATE_FLUSH_INTERVAL_MS ||
        completed >= targets.length;
    };

    const worker = async () => {
      while (!signal.aborted) {
        const target = targets[cursor++];
        if (!target) {
          return;
        }

        const [cacheKey, mod] = target;
        const source = mod.manifestEntry?.source;
        if (!source?.projectId || !source.fileId) {
          continue;
        }

        let cacheEntry: ModUpdateCacheEntry = {
          hasUpdate: false,
          checkedAt: Date.now()
        };

        try {
          const versions = await fetchManagedVersions(source.platform, source.projectId, targetMc, targetLoader);
          const versionList = versions || [];
          const latest = versionList[0];
          const currentIndex = versionList.findIndex((version) => version.id === source.fileId);
          cacheEntry = buildUpdateCacheEntry(latest, source.fileId);

          if (currentIndex === 0) {
            cacheEntry = {
              hasUpdate: false,
              checkedAt: Date.now()
            };
          }
        } catch (error) {
          console.error('Update check failed', error);
        }

        cache.set(cacheKey, cacheEntry);
        pendingEntries.set(cacheKey, cacheEntry);
        completed += 1;

        if (shouldFlush()) {
          flushPendingEntries();
        }
      }
    };

    try {
      await Promise.all(
        Array.from({ length: Math.min(UPDATE_CHECK_CONCURRENCY, targets.length) }, () => worker())
      );

      flushPendingEntries();
    } finally {
      if (updateAbortControllerRef.current === abortController) {
        updateAbortControllerRef.current = null;
        setIsCheckingModUpdates(false);
      }
    }
  }, [cancelUpdateCheck, setMods]);

  return {
    isCheckingModUpdates,
    setIsCheckingModUpdates,
    cancelUpdateCheck,
    runUpdateCheck
  };
};
