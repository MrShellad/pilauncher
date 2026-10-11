import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { modService, type ModMeta } from '@/features/instance-resources';
import { useEvent } from '../../../hooks/useEvent';

export interface DownloadInstanceConfig {
  game_version?: string;
  gameVersion?: string;
  mcVersion?: string;
  loader_type?: string;
  loaderType?: string;
  loader?: {
    type?: string;
  };
  [key: string]: unknown;
}

interface ResourceDownloadProgressPayload {
  task_id?: string;
  file_name?: string;
  stage?: string;
  current?: number;
  total?: number;
}

interface UseResourceDownloadEnvironmentOptions {
  instanceId?: string | null;
  isCacheValid: boolean;
  cachedInstanceConfig: DownloadInstanceConfig | null;
  setMcVersion: Dispatch<SetStateAction<string>>;
  setLoaderType: Dispatch<SetStateAction<string>>;
}

const RESOURCE_REFRESH_DELAY_MS = 700;
const RESOURCE_DONE_DEDUPE_MS = 2000;

export const resolveInstanceGameVersion = (config: DownloadInstanceConfig | null | undefined) =>
  String(config?.game_version || config?.gameVersion || config?.mcVersion || '');

export const resolveInstanceLoaderType = (config: DownloadInstanceConfig | null | undefined) => {
  const raw = String(config?.loader_type || config?.loaderType || config?.loader?.type || '').toLowerCase();
  return raw === 'vanilla' ? '' : raw;
};

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

export const useResourceDownloadEnvironment = ({
  instanceId,
  isCacheValid,
  cachedInstanceConfig,
  setMcVersion,
  setLoaderType
}: UseResourceDownloadEnvironmentOptions) => {
  const [instanceConfig, setInstanceConfig] = useState<DownloadInstanceConfig | null>(cachedInstanceConfig);
  const [isEnvLoaded, setIsEnvLoaded] = useState(isCacheValid);
  const [installedMods, setInstalledMods] = useState<ModMeta[]>(() => (
    instanceId ? modService.getManifestModsSnapshot(instanceId) ?? [] : []
  ));

  const loadInstalledMods = useCallback(async (forceRefresh = false) => {
    if (!instanceId) {
      setInstalledMods([]);
      return [] as ModMeta[];
    }

    try {
      const mods = await modService.getCachedModManifest(instanceId, forceRefresh);
      const resolvedMods = mods || [];
      setInstalledMods(resolvedMods);
      return resolvedMods;
    } catch {
      return modService.getManifestModsSnapshot(instanceId) ?? [];
    }
  }, [instanceId]);

  const refreshInstalledMods = useCallback(async () => {
    return loadInstalledMods(true);
  }, [loadInstalledMods]);

  useEffect(() => {
    let cancelled = false;

    const loadInstalledManifest = async () => {
      if (!instanceId) return;
      try {
        // The download page must reflect the physical mods directory, including JARs
        // copied in outside the launcher. A DB-only snapshot is not authoritative here.
        const mods = await modService.getCachedModManifest(instanceId, true);
        if (!cancelled) setInstalledMods(mods || []);
      } catch {
        // Keep the last known list on transient scan failures instead of making every
        // project appear uninstalled.
      }
    };

    const initEnv = async () => {
      setInstalledMods(instanceId ? modService.getManifestModsSnapshot(instanceId) ?? [] : []);

      if (!instanceId) {
        setInstalledMods([]);
        setIsEnvLoaded(true);
        return;
      }

      if (isCacheValid) {
        await loadInstalledManifest();
        if (!cancelled) setIsEnvLoaded(true);
        return;
      }

      try {
        const config = await invoke<DownloadInstanceConfig>('get_instance_detail', { id: instanceId });
        if (cancelled) return;

        const safeConfig = config || {};
        setInstanceConfig(safeConfig);
        setMcVersion(resolveInstanceGameVersion(safeConfig));
        setLoaderType(resolveInstanceLoaderType(safeConfig));
      } catch (error) {
        console.error('获取实例环境失败:', error);
      } finally {
        await loadInstalledManifest();
        if (!cancelled) setIsEnvLoaded(true);
      }
    };

    void initEnv();

    return () => {
      cancelled = true;
    };
  }, [instanceId, isCacheValid, setLoaderType, setMcVersion]);

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const lastDoneKeyRef = useRef('');
  const lastDoneAtRef = useRef(0);

  const runRefresh = async () => {
    if (isRefreshingRef.current) {
      refreshAgainRef.current = true;
      return;
    }

    isRefreshingRef.current = true;
    try {
      await refreshInstalledMods();
    } finally {
      isRefreshingRef.current = false;
      if (refreshAgainRef.current) {
        refreshAgainRef.current = false;
        scheduleRefresh();
      }
    }
  };

  const scheduleRefresh = () => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void runRefresh();
    }, RESOURCE_REFRESH_DELAY_MS);
  };

  useEvent('resource-download-progress', (payload) => {
    if (!instanceId) return;
    if (!isCompletedResourceDownload(payload)) return;

    const doneKey = getResourceProgressKey(payload);
    const now = Date.now();
    if (doneKey === lastDoneKeyRef.current && now - lastDoneAtRef.current < RESOURCE_DONE_DEDUPE_MS) return;

    lastDoneKeyRef.current = doneKey;
    lastDoneAtRef.current = now;
    scheduleRefresh();
  });

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  return {
    instanceConfig,
    isEnvLoaded,
    installedMods,
    refreshInstalledMods
  };
};
