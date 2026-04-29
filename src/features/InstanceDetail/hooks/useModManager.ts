// /src/features/InstanceDetail/hooks/useModManager.ts
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import {
  fetchCurseForgeVersions,
  getCurseForgeProjectDetails,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints
} from '../../Download/logic/curseforgeApi';
import { useDownloadStore } from '../../../store/useDownloadStore';
import {
  modService,
  resolveInstanceGameVersion,
  resolveInstanceLoader,
  type ModMeta,
  type SnapshotProgressEvent
} from '../logic/modService';
import {
  fetchModrinthVersions,
  getProjectDetails,
  matchModrinthVersionsByHashes,
  type OreProjectVersion
} from '../logic/modrinthApi';

export type ModSortType = 'time' | 'name' | 'fileName' | 'version' | 'update';
export type ModSortOrder = 'asc' | 'desc';

interface LoadModsOptions {
  checkUpdates?: boolean;
  forceUpdateCheck?: boolean;
}

interface ModUpdateCacheEntry {
  hasUpdate: boolean;
  updateVersionName?: string;
  updateFileId?: string;
  updateFileName?: string;
  updateDownloadUrl?: string;
  checkedAt: number;
}

const autoUpdateCheckedKeys = new Set<string>();
const updateCacheByInstance = new Map<string, Map<string, ModUpdateCacheEntry>>();
const UPDATE_CACHE_TTL_MS = 30 * 60 * 1000;
const UPDATE_CHECK_CONCURRENCY = 6;
const UPDATE_STATE_FLUSH_SIZE = 12;
const UPDATE_STATE_FLUSH_INTERVAL_MS = 1200;

const getUpdateScopeKey = (instanceId: string, gameVersion: string, loader: string) => {
  return `${instanceId}|${gameVersion || 'unknown'}|${loader || 'unknown'}`;
};

const getModUpdateCacheKey = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;

  if (source?.platform === 'modrinth' && source.projectId && source.fileId) {
    return `modrinth:${source.projectId}:${source.fileId}`;
  }

  if (source?.platform === 'curseforge' && source.projectId && source.fileId) {
    return `curseforge:${source.projectId}:${source.fileId}`;
  }

  return `file:${mod.fileName.replace(/\.disabled$/i, '')}`;
};

const canCheckManagedUpdate = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;
  if (!source?.projectId || !source.fileId) return false;
  if (source.platform === 'modrinth') return true;
  if (source.platform === 'curseforge') return hasCurseForgeApiKey();
  return false;
};

const fetchManagedVersions = (platform: string | undefined, projectId: string, gameVersion: string, loader: string) => {
  if (platform === 'curseforge') {
    return fetchCurseForgeVersions(projectId, gameVersion, loader);
  }

  return fetchModrinthVersions(projectId, gameVersion, loader);
};

const getOrCreateUpdateCache = (scopeKey: string) => {
  let cache = updateCacheByInstance.get(scopeKey);

  if (!cache) {
    cache = new Map<string, ModUpdateCacheEntry>();
    updateCacheByInstance.set(scopeKey, cache);
  }

  return cache;
};

const isFreshUpdateCacheEntry = (entry?: ModUpdateCacheEntry) => {
  return !!entry && Date.now() - entry.checkedAt < UPDATE_CACHE_TTL_MS;
};

const compareText = (left?: string, right?: string) => {
  return (left || '').localeCompare(right || '', undefined, {
    numeric: true,
    sensitivity: 'base'
  });
};

const buildUpdateCacheEntry = (
  latest: OreProjectVersion | undefined,
  currentFileId: string
): ModUpdateCacheEntry => {
  if (!latest || latest.id === currentFileId) {
    return {
      hasUpdate: false,
      checkedAt: Date.now()
    };
  }

  return {
    hasUpdate: true,
    updateVersionName: latest.name || latest.version_number,
    updateDownloadUrl: latest.download_url,
    updateFileId: latest.id,
    updateFileName: latest.file_name,
    checkedAt: Date.now()
  };
};

const applyCachedUpdateState = (
  mod: ModMeta,
  cache: Map<string, ModUpdateCacheEntry> | undefined,
  checkUpdates: boolean,
  forceUpdateCheck = false
): ModMeta => {
  const cached = cache?.get(getModUpdateCacheKey(mod));
  const shouldCheck = checkUpdates &&
    canCheckManagedUpdate(mod) &&
    (forceUpdateCheck || !isFreshUpdateCacheEntry(cached));

  return {
    ...mod,
    hasUpdate: cached?.hasUpdate ?? false,
    updateVersionName: cached?.updateVersionName,
    updateDownloadUrl: cached?.updateDownloadUrl,
    updateFileId: cached?.updateFileId,
    updateFileName: cached?.updateFileName,
    isFetchingNetwork: false,
    isCheckingUpdate: shouldCheck,
    isUpdatingMod: false
  };
};

const needsCloudSourceMatch = (mod: ModMeta) => {
  const source = mod.manifestEntry?.source;
  return !source?.platform || !source.projectId || !source.fileId;
};

export const useModManager = (instanceId: string) => {
  const [mods, setMods] = useState<ModMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshotState, setSnapshotState] = useState<'idle' | 'snapshotting' | 'rolling_back'>('idle');
  const [snapshotProgress, setSnapshotProgress] = useState<SnapshotProgressEvent | null>(null);
  const [instanceConfig, setInstanceConfig] = useState<any>(null);

  const [sortType, setSortType] = useState<ModSortType>('time');
  const [sortOrder, setSortOrder] = useState<ModSortOrder>('desc');
  const updateAbortControllerRef = useRef<AbortController | null>(null);

  const cancelUpdateCheck = useCallback(() => {
    updateAbortControllerRef.current?.abort();
    updateAbortControllerRef.current = null;
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
      setMods((current) => current.map((item) => (
        canCheckManagedUpdate(item) ? { ...item, isCheckingUpdate: false } : item
      )));
      if (updateAbortControllerRef.current === abortController) {
        updateAbortControllerRef.current = null;
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
          updateFileName: cacheEntry.updateFileName,
          isCheckingUpdate: false
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

    await Promise.all(
      Array.from({ length: Math.min(UPDATE_CHECK_CONCURRENCY, targets.length) }, () => worker())
    );

    flushPendingEntries();

    if (!signal.aborted) {
      setMods((current) => current.map((item) => (
        canCheckManagedUpdate(item) ? { ...item, isCheckingUpdate: false } : item
      )));
    }

    if (updateAbortControllerRef.current === abortController) {
      updateAbortControllerRef.current = null;
    }
  }, [cancelUpdateCheck]);

  const syncCloudMetadata = useCallback(async (modsToSync: ModMeta[]) => {
    const candidates = modsToSync.filter(needsCloudSourceMatch);
    if (candidates.length === 0) {
      return modsToSync;
    }

    const matchedByFileName = new Map<string, Partial<ModMeta>>();
    const sha1Mods = candidates.filter((mod) => mod.manifestEntry?.hash.algorithm === 'sha1' && mod.manifestEntry.hash.value);

    try {
      const modrinthMatches = await matchModrinthVersionsByHashes(
        sha1Mods.map((mod) => mod.manifestEntry!.hash.value),
        'sha1'
      );

      await Promise.all(sha1Mods.map(async (mod) => {
        const version = modrinthMatches[mod.manifestEntry!.hash.value];
        if (!version?.project_id) return;

        try {
          const detail = await getProjectDetails(version.project_id);
          if (mod.cacheKey) {
            await modService.updateModCache(
              mod.cacheKey,
              detail.title,
              detail.description,
              detail.icon_url || ''
            );
          }
          await modService.updateModManifest(
            instanceId,
            mod.fileName,
            'externalImport',
            'modrinth',
            version.project_id,
            version.id
          );

          matchedByFileName.set(mod.fileName, {
            name: mod.name || detail.title,
            description: mod.description || detail.description,
            networkIconUrl: detail.icon_url || mod.networkIconUrl,
            manifestEntry: mod.manifestEntry
              ? {
                  ...mod.manifestEntry,
                  source: {
                    ...mod.manifestEntry.source,
                    kind: mod.manifestEntry.source.kind,
                    platform: 'modrinth',
                    projectId: version.project_id,
                    fileId: version.id
                  }
                }
              : mod.manifestEntry
          });
        } catch (error) {
          console.error('Modrinth cloud metadata sync failed', error);
        }
      }));
    } catch (error) {
      console.error('Modrinth hash match failed', error);
    }

    if (hasCurseForgeApiKey()) {
      const curseForgeMods = candidates.filter((mod) => (
        !matchedByFileName.has(mod.fileName) && typeof mod.curseforgeFingerprint === 'number'
      ));

      try {
        const curseForgeMatches = await matchCurseForgeFingerprints(
          curseForgeMods.map((mod) => mod.curseforgeFingerprint!)
        );

        await Promise.all(curseForgeMods.map(async (mod) => {
          const version = curseForgeMatches[mod.curseforgeFingerprint!];
          if (!version?.project_id) return;

          try {
            const detail = await getCurseForgeProjectDetails(version.project_id);
            if (mod.cacheKey) {
              await modService.updateModCache(
                mod.cacheKey,
                detail.title,
                detail.description,
                detail.icon_url || ''
              );
            }
            await modService.updateModManifest(
              instanceId,
              mod.fileName,
              'externalImport',
              'curseforge',
              version.project_id,
              version.id
            );

            matchedByFileName.set(mod.fileName, {
              name: mod.name || detail.title,
              description: mod.description || detail.description,
              networkIconUrl: detail.icon_url || mod.networkIconUrl,
              manifestEntry: mod.manifestEntry
                ? {
                    ...mod.manifestEntry,
                    source: {
                      ...mod.manifestEntry.source,
                      kind: mod.manifestEntry.source.kind,
                      platform: 'curseforge',
                      projectId: version.project_id,
                      fileId: version.id
                    }
                  }
                : mod.manifestEntry
            });
          } catch (error) {
            console.error('CurseForge cloud metadata sync failed', error);
          }
        }));
      } catch (error) {
        console.error('CurseForge fingerprint match failed', error);
      }
    }

    if (matchedByFileName.size === 0) {
      return modsToSync;
    }

    return modsToSync.map((mod) => {
      const matched = matchedByFileName.get(mod.fileName);
      return matched ? { ...mod, ...matched, isFetchingNetwork: false } : mod;
    });
  }, [instanceId]);

  const loadMods = useCallback(async (options: LoadModsOptions = {}) => {
    cancelUpdateCheck();
    setIsLoading(true);

    try {
      const config = await modService.getInstanceDetail(instanceId);
      setInstanceConfig(config);

      const targetMc = resolveInstanceGameVersion(config);
      const targetLoader = resolveInstanceLoader(config);
      const scopeKey = getUpdateScopeKey(instanceId, targetMc, targetLoader);
      const cache = updateCacheByInstance.get(scopeKey);
      const checkUpdates = !!options.checkUpdates;

      const localMods = await modService.getMods(instanceId);
      const enrichedMods = localMods.map((mod) => (
        applyCachedUpdateState(mod, cache, checkUpdates, options.forceUpdateCheck)
      ));
      setMods(enrichedMods);

      void (async () => {
        const syncedMods = await syncCloudMetadata(enrichedMods);
        if (syncedMods !== enrichedMods) {
          setMods(syncedMods);
        }
        if (checkUpdates) {
          await runUpdateCheck(scopeKey, syncedMods, targetMc, targetLoader, options.forceUpdateCheck);
        }
      })();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [cancelUpdateCheck, instanceId, runUpdateCheck, syncCloudMetadata]);

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

    autoUpdateCheckedKeys.add(scopeKey);
    await loadMods({ checkUpdates: true, forceUpdateCheck: true });
  }, [instanceId, loadMods]);

  const sortedMods = useMemo(() => {
    return [...mods].sort((a, b) => {
      let comparison = 0;
      if (sortType === 'time') {
        comparison = a.modifiedAt - b.modifiedAt;
      } else if (sortType === 'fileName') {
        comparison = compareText(a.fileName, b.fileName);
      } else if (sortType === 'version') {
        comparison = compareText(a.version, b.version);
      } else if (sortType === 'update') {
        comparison = Number(a.hasUpdate) - Number(b.hasUpdate);
        if (comparison === 0) {
          comparison = compareText(a.updateVersionName, b.updateVersionName);
        }
      } else {
        comparison = compareText(a.name || a.fileName, b.name || b.fileName);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [mods, sortType, sortOrder]);

  const toggleMod = async (fileName: string, currentEnabled: boolean) => {
    try {
      setMods((prev) => prev.map((mod) => (
        mod.fileName === fileName
          ? {
              ...mod,
              isEnabled: !currentEnabled,
              fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '')
            }
          : mod
      )));
      await modService.toggleMod(instanceId, fileName, !currentEnabled);
    } catch (error) {
      console.error(error);
      loadMods();
    }
  };

  const toggleMods = async (fileNames: string[], enable: boolean) => {
    try {
      setMods((prev) => prev.map((mod) => {
        if (fileNames.includes(mod.fileName) && mod.isEnabled !== enable) {
          return {
            ...mod,
            isEnabled: enable,
            fileName: enable ? mod.fileName.replace('.disabled', '') : `${mod.fileName}.disabled`
          };
        }
        return mod;
      }));
      await Promise.all(fileNames.map((fileName) => modService.toggleMod(instanceId, fileName, enable)));
    } catch (error) {
      console.error(error);
      loadMods();
    }
  };

  const deleteMod = async (fileName: string) => {
    try {
      setMods((prev) => prev.filter((mod) => mod.fileName !== fileName));
      await modService.deleteMod(instanceId, fileName);
    } catch (error) {
      console.error(error);
      loadMods();
    }
  };

  const deleteMods = async (fileNames: string[]) => {
    try {
      setMods((prev) => prev.filter((mod) => !fileNames.includes(mod.fileName)));
      await Promise.all(fileNames.map((fileName) => modService.deleteMod(instanceId, fileName)));
    } catch (error) {
      console.error(error);
      loadMods();
    }
  };

  const installModVersion = async (mod: ModMeta, version?: OreProjectVersion) => {
    const source = mod.manifestEntry?.source;
    const platform = source?.platform || '';
    const projectId = source?.projectId || '';
    const targetVersionId = version?.id || mod.updateFileId || '';
    const targetDownloadUrl = version?.download_url || mod.updateDownloadUrl || '';
    const remoteFileName = version?.file_name || mod.updateFileName || '';

    if (!projectId || !targetVersionId || !targetDownloadUrl || !remoteFileName) {
      throw new Error('缺少安装所需的远端文件信息，请先重新检查更新。');
    }

    const oldFileName = mod.fileName;
    const shouldKeepDisabled = !mod.isEnabled || oldFileName.endsWith('.disabled');
    const targetFileName = shouldKeepDisabled && !remoteFileName.endsWith('.disabled')
      ? `${remoteFileName}.disabled`
      : remoteFileName;

    setMods((current) => current.map((item) => (
      item.fileName === oldFileName ? { ...item, isUpdatingMod: true } : item
    )));

    useDownloadStore.getState().addOrUpdateTask({
      id: targetFileName,
      taskType: 'resource',
      title: targetFileName,
      stage: 'DOWNLOADING_MOD',
      current: 0,
      total: 100,
      message: '正在准备升级模组...',
      retryAction: 'download_resource',
      retryPayload: {
        url: targetDownloadUrl,
        fileName: targetFileName,
        instanceId,
        subFolder: 'mods'
      }
    });

    try {
      await modService.downloadResource(targetDownloadUrl, targetFileName, instanceId, 'mods');
      await modService.updateModManifest(
        instanceId,
        targetFileName,
        'launcherDownload',
        platform,
        projectId,
        targetVersionId
      );

      if (targetFileName !== oldFileName) {
        await modService.deleteMod(instanceId, oldFileName);
      }

      await loadMods();
    } catch (error) {
      setMods((current) => current.map((item) => (
        item.fileName === oldFileName ? { ...item, isUpdatingMod: false } : item
      )));
      throw error;
    }
  };

  const upgradeMod = async (mod: ModMeta) => installModVersion(mod);

  useEffect(() => {
    const unlisten = listen<SnapshotProgressEvent>('snapshot-progress', (event) => {
      setSnapshotProgress(event.payload);
    });
    return () => {
      unlisten.then((unlistenSnapshotProgress) => unlistenSnapshotProgress());
    };
  }, []);

  const takeSnapshot = async (trigger: string, message: string) => {
    setSnapshotState('snapshotting');
    setSnapshotProgress(null);
    try {
      return await modService.takeSnapshot(instanceId, trigger, message);
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setSnapshotState('idle');
      setSnapshotProgress(null);
    }
  };

  const fetchHistory = async () => {
    return await modService.getSnapshotHistory(instanceId);
  };

  const diffSnapshots = async (oldId: string, newId: string) => {
    return await modService.calculateSnapshotDiff(instanceId, oldId, newId);
  };

  const doRollback = async (snapshotId: string) => {
    setSnapshotState('rolling_back');
    try {
      await modService.rollbackInstance(instanceId, snapshotId);
      await loadMods();
    } catch (error) {
      console.error(error);
      throw error;
    } finally {
      setSnapshotState('idle');
    }
  };

  const openModFolder = () => {
    modService.openModFolder(instanceId).catch(console.error);
  };

  const executeModFileCleanup = async (items: { originalFileName: string; suggestedFileName: string }[]) => {
    try {
      const result = await modService.executeModFileCleanup(instanceId, items);
      await loadMods();
      return result;
    } catch (error) {
      console.error(error);
      throw error;
    }
  };

  return {
    mods: sortedMods,
    isLoading,
    instanceConfig,
    sortType,
    setSortType,
    sortOrder,
    setSortOrder,
    snapshotState,
    snapshotProgress,
    takeSnapshot,
    fetchHistory,
    diffSnapshots,
    doRollback,
    toggleMod,
    toggleMods,
    deleteMod,
    deleteMods,
    openModFolder,
    executeModFileCleanup,
    loadMods,
    checkModUpdates,
    upgradeMod,
    installModVersion
  };
};
