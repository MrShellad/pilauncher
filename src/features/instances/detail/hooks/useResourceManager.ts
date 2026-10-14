import { useCallback, useEffect, useRef, useState } from 'react';

import { runResourceDownloadTask } from '@/features/download';
import { useGameLogStore } from '@/features/game-log';
import {
  fetchCurseForgeVersions,
  fetchModrinthVersions,
  fetchModrinthProjectsBatch,
  getCurseForgeProjectsBatch,
  hasCurseForgeApiKey,
  matchCurseForgeFingerprints,
  matchModrinthVersionsByHashes,
  type OreProjectVersion
} from '@/features/resource-catalog';
import { useToastStore } from '@/shared/stores/useToastStore';
import { useEvent } from '../../../../hooks/useEvent';
import type { ResourceDownloadProgressPayload } from '../../../../utils/event-bus/events';
import {
  resourceService,
  type ResourceItem,
  type ResourceSourceMetadata,
  type ResourceType,
} from '../../../instance-resources';

const RESOURCE_REFRESH_DELAY_MS = 200;
const RESOURCE_DONE_DEDUPE_MS = 1500;
const UPDATE_CHECK_CONCURRENCY = 4;
const resourceProjectIconCache = new Map<string, string>();

const getResourceProgressKey = (payload: ResourceDownloadProgressPayload | null | undefined) =>
  String(payload?.task_id || payload?.file_name || '').trim();

const isCompletedResourceDownload = (payload: ResourceDownloadProgressPayload | null | undefined) => {
  const key = getResourceProgressKey(payload);
  if (!key || key === 'java_download') return false;

  return (
    payload?.stage === 'DONE' ||
    (typeof payload?.current === 'number' &&
      typeof payload?.total === 'number' &&
      payload.total > 0 &&
      payload.current >= payload.total)
  );
};

const isSupportedPlatform = (platform: string): platform is 'modrinth' | 'curseforge' => (
  platform === 'modrinth' || platform === 'curseforge'
);

const getLatestCompatibleVersion = async (
  item: ResourceItem,
  gameVersion: string,
): Promise<OreProjectVersion | null> => {
  const metadata = item.meta;
  if (!metadata || !isSupportedPlatform(metadata.platform) || !metadata.projectId) return null;

  if (metadata.platform === 'curseforge') {
    if (!hasCurseForgeApiKey()) {
      throw new Error('CurseForge API Key 未配置');
    }
    const versions = await fetchCurseForgeVersions(metadata.projectId, gameVersion || undefined);
    return versions[0] || null;
  }

  const versions = await fetchModrinthVersions(metadata.projectId, gameVersion || undefined);
  return versions[0] || null;
};

const mapWithConcurrency = async <T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(Math.max(1, concurrency), values.length) },
    async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await worker(values[currentIndex]);
      }
    },
  );
  await Promise.all(runners);
  return results;
};

const hydrateResourceProjectIcons = async (items: ResourceItem[]) => {
  const sources = Array.from(new Map(
    items
      .flatMap((item) => item.meta && isSupportedPlatform(item.meta.platform) ? [item.meta] : [])
      .map((metadata) => [`${metadata.platform}:${metadata.projectId}`, metadata]),
  ).values());
  const missingModrinthIds = sources
    .filter((source) => source.platform === 'modrinth')
    .map((source) => source.projectId)
    .filter((projectId) => !resourceProjectIconCache.has(`modrinth:${projectId}`));
  const missingCurseForgeIds = sources
    .filter((source) => source.platform === 'curseforge')
    .map((source) => source.projectId)
    .filter((projectId) => !resourceProjectIconCache.has(`curseforge:${projectId}`));

  await Promise.all([
    missingModrinthIds.length > 0
      ? fetchModrinthProjectsBatch(missingModrinthIds).then((projects) => {
          const returnedIds = new Set<string>();
          for (const project of projects) {
            returnedIds.add(String(project.id));
            resourceProjectIconCache.set(`modrinth:${project.id}`, project.icon_url || '');
          }
          for (const projectId of missingModrinthIds) {
            if (!returnedIds.has(projectId)) resourceProjectIconCache.set(`modrinth:${projectId}`, '');
          }
        }).catch((error) => console.warn('加载 Modrinth 资源图标失败:', error))
      : Promise.resolve(),
    missingCurseForgeIds.length > 0 && hasCurseForgeApiKey()
      ? getCurseForgeProjectsBatch(missingCurseForgeIds).then((projects) => {
          const returnedIds = new Set<string>();
          for (const project of projects) {
            returnedIds.add(String(project.id));
            resourceProjectIconCache.set(`curseforge:${project.id}`, project.icon_url || '');
          }
          for (const projectId of missingCurseForgeIds) {
            if (!returnedIds.has(projectId)) resourceProjectIconCache.set(`curseforge:${projectId}`, '');
          }
        }).catch((error) => console.warn('加载 CurseForge 资源图标失败:', error))
      : Promise.resolve(),
  ]);

  return new Map(
    sources.map((source) => [
      `${source.platform}:${source.projectId}`,
      resourceProjectIconCache.get(`${source.platform}:${source.projectId}`) || '',
    ]),
  );
};

export const useResourceManager = (
  instanceId: string,
  resType: ResourceType,
  gameVersion = '',
) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [isUpdatingAll, setIsUpdatingAll] = useState(false);
  const [updatingFileNames, setUpdatingFileNames] = useState<Set<string>>(() => new Set());
  const addToast = useToastStore((state) => state.addToast);
  const gameState = useGameLogStore((state) => state.gameState);
  const runningInstanceId = useGameLogStore((state) => state.currentInstanceId);
  const isInstanceRunning = runningInstanceId === instanceId
    && (gameState === 'launching' || gameState === 'running');

  const isCheckingUpdatesRef = useRef(false);
  const isUpdatingAllRef = useRef(false);
  const activeUpdatesRef = useRef<Set<string>>(new Set());
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const lastDoneKeyRef = useRef('');
  const lastDoneAtRef = useRef(0);

  const attachProjectIcons = useCallback(async (resourceItems: ResourceItem[]) => {
    const icons = await hydrateResourceProjectIcons(resourceItems);
    if (![...icons.values()].some(Boolean)) return;

    setItems((current) => current.map((item) => {
      if (!item.meta || !isSupportedPlatform(item.meta.platform)) return item;
      const iconUrl = icons.get(`${item.meta.platform}:${item.meta.projectId}`);
      return iconUrl && iconUrl !== item.networkIconUrl
        ? { ...item, networkIconUrl: iconUrl }
        : item;
    }));
  }, []);

  const loadItems = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }

      try {
        const data = await resourceService.list(instanceId, resType);
        setItems((current) => {
          const pendingUpdates = new Map(
            current
              .filter((item) => item.update && item.meta)
              .map((item) => [
                `${item.meta!.platform}:${item.meta!.projectId}`,
                item.update!,
              ]),
          );
          const currentIcons = new Map(
            current
              .filter((item) => item.networkIconUrl && item.meta)
              .map((item) => [
                `${item.meta!.platform}:${item.meta!.projectId}`,
                item.networkIconUrl!,
              ]),
          );
          return data.map((item) => {
            if (!item.meta) return item;
            const networkIconUrl = currentIcons.get(`${item.meta.platform}:${item.meta.projectId}`);
            const update = pendingUpdates.get(`${item.meta.platform}:${item.meta.projectId}`);
            return {
              ...item,
              ...(networkIconUrl ? { networkIconUrl } : {}),
              ...(update && update.fileId !== item.meta.fileId ? { update } : {}),
            };
          });
        });
        void attachProjectIcons(data);
      } catch (error) {
        console.error(`加载 ${resType} 失败:`, error);
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [attachProjectIcons, instanceId, resType]
  );

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      refreshTimerRef.current = null;

      if (isRefreshingRef.current) {
        refreshAgainRef.current = true;
        return;
      }

      isRefreshingRef.current = true;
      try {
        await loadItems({ silent: true });
      } finally {
        isRefreshingRef.current = false;
        if (refreshAgainRef.current) {
          refreshAgainRef.current = false;
          scheduleRefresh();
        }
      }
    }, RESOURCE_REFRESH_DELAY_MS);
  }, [loadItems]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadItems();
    });
    return () => {
      cancelled = true;
    };
  }, [loadItems]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  // 1. 监听通用资源文件系统变更事件 (Tauri 后端 / 前端 EventBus)
  useEvent('instance-resources-fs-changed', (payload) => {
    if (payload.instanceId !== instanceId) return;
    if (payload.resType && payload.resType !== resType) return;
    scheduleRefresh();
  });

  // 2. 兼容 Mod 文件变更事件
  useEvent('instance-mods-fs-changed', (payload) => {
    if (payload.instanceId !== instanceId) return;
    if (resType === 'mod') {
      scheduleRefresh();
    }
  });

  // 3. 监听资源下载完成事件
  useEvent('resource-download-progress', (payload) => {
    if (!isCompletedResourceDownload(payload)) return;

    const doneKey = getResourceProgressKey(payload);
    const now = Date.now();
    if (doneKey === lastDoneKeyRef.current && now - lastDoneAtRef.current < RESOURCE_DONE_DEDUPE_MS) return;

    lastDoneKeyRef.current = doneKey;
    lastDoneAtRef.current = now;
    scheduleRefresh();
  });

  // 4. 当用户打开资源文件夹在外部新增/修改文件并切回窗口时自动刷新
  useEffect(() => {
    const handleWindowFocus = () => {
      scheduleRefresh();
    };

    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [scheduleRefresh]);

  const toggleItem = async (fileName: string, currentEnabled: boolean) => {
    try {
      setItems((prev) =>
        prev.map((item) =>
          item.fileName === fileName
            ? {
                ...item,
                isEnabled: !currentEnabled,
                fileName: currentEnabled
                  ? `${fileName}.disabled`
                  : fileName.replace('.disabled', ''),
              }
            : item
        )
      );

      await resourceService.toggle(instanceId, resType, fileName, !currentEnabled);
    } catch (error) {
      console.error('状态切换失败:', error);
      void loadItems();
    }
  };

  const deleteItem = async (fileName: string) => {
    try {
      setItems((prev) => prev.filter((item) => item.fileName !== fileName));
      await resourceService.delete(instanceId, resType, fileName);
    } catch (error) {
      console.error('删除失败:', error);
      void loadItems();
    }
  };

  const openFolder = () => resourceService.openFolder(instanceId, resType).catch(console.error);

  const identifyLegacyResources = useCallback(async (currentItems: ResourceItem[]) => {
    const legacyItems = currentItems.filter((item) => !item.meta && !item.isDirectory);
    if (legacyItems.length === 0) return currentItems;

    const sha1Identifiers = await resourceService.calculateFileIdentifiers(
      instanceId,
      resType,
      legacyItems.map((item) => item.fileName),
      { includeSha1: true, includeCurseforge: false },
    );
    const identified = new Map<string, ResourceSourceMetadata>();
    const sha1Values = sha1Identifiers.flatMap((item) => item.sha1 ? [item.sha1] : []);

    try {
      const modrinthMatches = await matchModrinthVersionsByHashes(sha1Values, 'sha1');
      for (const identifier of sha1Identifiers) {
        if (!identifier.sha1) continue;
        const version = modrinthMatches[identifier.sha1];
        if (!version?.project_id) continue;
        identified.set(identifier.fileName, {
          resourceType: resType,
          fileName: identifier.fileName,
          sourceKind: 'legacyHashMatch',
          platform: 'modrinth',
          projectId: String(version.project_id),
          fileId: String(version.id),
          version: version.version_number || version.name,
          updatedAt: Math.floor(Date.now() / 1000),
        });
      }
    } catch (error) {
      console.warn('Modrinth 资源文件识别失败:', error);
    }

    const unmatchedFileNames = legacyItems
      .map((item) => item.fileName)
      .filter((fileName) => !identified.has(fileName));
    if (unmatchedFileNames.length > 0 && hasCurseForgeApiKey()) {
      try {
        const curseForgeIdentifiers = await resourceService.calculateFileIdentifiers(
          instanceId,
          resType,
          unmatchedFileNames,
          { includeSha1: false, includeCurseforge: true },
        );
        const fingerprints = curseForgeIdentifiers.flatMap((item) => (
          typeof item.curseforgeFingerprint === 'number' ? [item.curseforgeFingerprint] : []
        ));
        const curseForgeMatches = await matchCurseForgeFingerprints(fingerprints);
        for (const identifier of curseForgeIdentifiers) {
          if (typeof identifier.curseforgeFingerprint !== 'number') continue;
          const version = curseForgeMatches[identifier.curseforgeFingerprint];
          if (!version?.project_id) continue;
          identified.set(identifier.fileName, {
            resourceType: resType,
            fileName: identifier.fileName,
            sourceKind: 'legacyHashMatch',
            platform: 'curseforge',
            projectId: String(version.project_id),
            fileId: String(version.id),
            version: version.version_number || version.name,
            updatedAt: Math.floor(Date.now() / 1000),
          });
        }
      } catch (error) {
        console.warn('CurseForge 资源文件识别失败:', error);
      }
    }

    const persisted = new Map<string, ResourceSourceMetadata>();
    for (const [fileName, metadata] of identified) {
      try {
        await resourceService.updateManifest({
          instanceId,
          resType,
          fileName,
          sourceKind: metadata.sourceKind,
          platform: metadata.platform,
          projectId: metadata.projectId,
          fileId: metadata.fileId,
          version: metadata.version || undefined,
        });
        persisted.set(fileName, metadata);
      } catch (error) {
        console.warn(`保存资源来源信息失败: ${fileName}`, error);
      }
    }

    if (persisted.size === 0) return currentItems;
    const resolvedItems = currentItems.map((item) => (
      persisted.has(item.fileName) ? { ...item, meta: persisted.get(item.fileName) } : item
    ));
    setItems(resolvedItems);
    void attachProjectIcons(resolvedItems);
    return resolvedItems;
  }, [attachProjectIcons, instanceId, resType]);

  const checkUpdates = useCallback(async () => {
    if (isCheckingUpdatesRef.current) return;
    if (!gameVersion.trim()) {
      addToast('warning', '实例游戏版本尚未加载，暂时无法检查兼容更新');
      return;
    }
    isCheckingUpdatesRef.current = true;
    setIsCheckingUpdates(true);
    try {
      const resolvedItems = await identifyLegacyResources(items);
      const candidates = resolvedItems.filter((item) => item.meta?.projectId && item.meta?.fileId);
      if (candidates.length === 0) {
        addToast('info', '未能识别这些资源的下载来源，暂时无法检查更新');
        return;
      }

      const versionRequests = new Map<string, Promise<OreProjectVersion | null>>();
      const results = await mapWithConcurrency(candidates, UPDATE_CHECK_CONCURRENCY, async (item) => {
        try {
          const metadata = item.meta!;
          const requestKey = `${metadata.platform}:${metadata.projectId}:${gameVersion}`;
          let request = versionRequests.get(requestKey);
          if (!request) {
            request = getLatestCompatibleVersion(item, gameVersion);
            versionRequests.set(requestKey, request);
          }
          const latest = await request;
          const update = latest && latest.id !== item.meta?.fileId
            ? {
                fileId: String(latest.id),
                fileName: latest.file_name,
                version: latest.version_number || latest.name,
                downloadUrl: latest.download_url,
              }
            : undefined;
          return { fileName: item.fileName, update, failed: false };
        } catch (error) {
          console.error(`检查资源更新失败: ${item.fileName}`, error);
          return { fileName: item.fileName, update: undefined, failed: true };
        }
      });

      const updatesByFileName = new Map(results.map((result) => [result.fileName, result.update]));
      setItems((current) => current.map((item) => (
        updatesByFileName.has(item.fileName)
          ? { ...item, update: updatesByFileName.get(item.fileName) }
          : item
      )));

      const updateCount = results.filter((result) => result.update).length;
      const failedCount = results.filter((result) => result.failed).length;
      if (updateCount > 0) {
        addToast('success', `发现 ${updateCount} 个可用更新`);
      } else if (failedCount === 0) {
        addToast('info', '当前资源均为兼容的最新版本');
      }
      if (failedCount > 0) {
        addToast('warning', `${failedCount} 个资源检查失败，请检查网络或平台配置`);
      }
    } finally {
      isCheckingUpdatesRef.current = false;
      setIsCheckingUpdates(false);
    }
  }, [addToast, gameVersion, identifyLegacyResources, items]);

  const executeUpdate = useCallback(async (item: ResourceItem, announce: boolean) => {
    if (isInstanceRunning) {
      if (announce) addToast('warning', '请先关闭游戏，再更新资源包或光影包');
      return false;
    }
    const metadata = item.meta;
    const update = item.update;
    if (!metadata || !update || !isSupportedPlatform(metadata.platform)) return false;
    if (activeUpdatesRef.current.has(item.fileName)) return false;

    activeUpdatesRef.current.add(item.fileName);
    setUpdatingFileNames((current) => new Set(current).add(item.fileName));
    try {
      await runResourceDownloadTask({
        url: update.downloadUrl,
        fileName: update.fileName,
        instanceId,
        subFolder: resType === 'shader' ? 'shaderpacks' : 'resourcepacks',
        title: update.fileName,
        message: `正在更新: ${item.fileName}`,
        modSource: {
          sourceKind: metadata.sourceKind || 'launcherDownload',
          platform: metadata.platform,
          projectId: metadata.projectId,
          fileId: update.fileId,
          version: update.version,
          oldFileName: item.fileName,
        },
      });
      await loadItems({ silent: true });
      if (announce) addToast('success', `${item.fileName} 更新完成`);
      return true;
    } catch (error) {
      console.error(`更新资源失败: ${item.fileName}`, error);
      if (announce) addToast('error', `${item.fileName} 更新失败`);
      return false;
    } finally {
      activeUpdatesRef.current.delete(item.fileName);
      setUpdatingFileNames((current) => {
        const next = new Set(current);
        next.delete(item.fileName);
        return next;
      });
    }
  }, [addToast, instanceId, isInstanceRunning, loadItems, resType]);

  const updateItem = useCallback(
    (item: ResourceItem) => executeUpdate(item, true),
    [executeUpdate],
  );

  const updateAll = useCallback(async () => {
    if (isUpdatingAllRef.current) return;
    if (isInstanceRunning) {
      addToast('warning', '请先关闭游戏，再批量更新资源包或光影包');
      return;
    }
    const targets = items.filter((item) => item.update);
    if (targets.length === 0) return;

    isUpdatingAllRef.current = true;
    setIsUpdatingAll(true);
    let successCount = 0;
    try {
      for (const item of targets) {
        if (await executeUpdate(item, false)) successCount += 1;
      }
      if (successCount > 0) addToast('success', `成功更新 ${successCount} 个资源`);
      if (successCount < targets.length) {
        addToast('warning', `${targets.length - successCount} 个资源更新失败`);
      }
    } finally {
      isUpdatingAllRef.current = false;
      setIsUpdatingAll(false);
    }
  }, [addToast, executeUpdate, isInstanceRunning, items]);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return {
    items,
    isLoading,
    isCheckingUpdates,
    isUpdatingAll,
    updatingFileNames,
    isInstanceRunning,
    checkUpdates,
    updateItem,
    updateAll,
    toggleItem,
    deleteItem,
    openFolder,
    formatSize,
    refresh: scheduleRefresh,
  };
};
