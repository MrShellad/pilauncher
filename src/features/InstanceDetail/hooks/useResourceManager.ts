// /src/features/InstanceDetail/hooks/useResourceManager.ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { useEvent } from '../../../hooks/useEvent';
import type { ResourceDownloadProgressPayload } from '../../../utils/eventBus/events';
import { resourceService, type ResourceItem, type ResourceType } from '../logic/resourceService';

const RESOURCE_REFRESH_DELAY_MS = 200;
const RESOURCE_DONE_DEDUPE_MS = 1500;

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

export const useResourceManager = (instanceId: string, resType: ResourceType) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const lastDoneKeyRef = useRef('');
  const lastDoneAtRef = useRef(0);

  const loadItems = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!options?.silent) {
        setIsLoading(true);
      }

      try {
        const data = await resourceService.list(instanceId, resType);
        setItems(data);
      } catch (error) {
        console.error(`加载 ${resType} 失败:`, error);
      } finally {
        if (!options?.silent) {
          setIsLoading(false);
        }
      }
    },
    [instanceId, resType]
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
    void loadItems();
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

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return { items, isLoading, toggleItem, deleteItem, openFolder, formatSize, refresh: scheduleRefresh };
};
