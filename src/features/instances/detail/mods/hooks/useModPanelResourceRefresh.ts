import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEvent } from '../../../../../hooks/useEvent';
import { modService, type InstanceDependencyHealth, type ModMeta } from '../../../../instance-resources';
import type { useModManager } from '../../hooks/useModManager';

const RESOURCE_REFRESH_DELAY_MS = 700;
const RESOURCE_DONE_DEDUPE_MS = 2000;

interface ResourceDownloadProgressPayload {
  task_id?: string;
  file_name?: string;
  stage?: string;
  current?: number;
  total?: number;
}

interface UseModPanelResourceRefreshOptions {
  instanceId: string;
  mods: ModMeta[];
  isLoading: boolean;
  loadMods: ReturnType<typeof useModManager>['loadMods'];
}

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

export function useModPanelResourceRefresh({
  instanceId,
  mods,
  isLoading,
  loadMods,
}: UseModPanelResourceRefreshOptions) {
  const [dependencyHealth, setDependencyHealth] = useState<InstanceDependencyHealth | null>(null);
  const isBatchUpgradeRunningRef = useRef(false);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingRef = useRef(false);
  const refreshAgainRef = useRef(false);
  const lastDoneKeyRef = useRef('');
  const lastDoneAtRef = useRef(0);

  const refreshDependencyHealth = useCallback(async () => {
    if (!instanceId) return;
    try {
      const health = await modService.getInstanceDependencyHealth(instanceId);
      setDependencyHealth(health);
    } catch (error) {
      console.error('Failed to get instance dependency health', error);
    }
  }, [instanceId]);

  const dependencyStateSignature = useMemo(() => {
    return mods.map((mod) => `${mod.fileName}:${mod.modId || ''}:${mod.isEnabled ? '1' : '0'}:${mod.manifestEntry?.source?.projectId || ''}:${mod.manifestEntry?.matchedPlatforms?.curseforge?.projectId || ''}:${mod.manifestEntry?.matchedPlatforms?.modrinth?.projectId || ''}:${mod.networkInfo?.id || ''}`).join(';');
  }, [mods]);

  useEffect(() => {
    if (!isLoading && mods.length > 0) {
      void refreshDependencyHealth();
    }
  }, [instanceId, dependencyStateSignature, isLoading, refreshDependencyHealth]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(async () => {
      refreshTimerRef.current = null;
      if (isBatchUpgradeRunningRef.current) return;

      if (isRefreshingRef.current) {
        refreshAgainRef.current = true;
        return;
      }

      isRefreshingRef.current = true;
      try {
        await loadMods({ silent: true });
        await refreshDependencyHealth();
      } finally {
        isRefreshingRef.current = false;
        if (refreshAgainRef.current) {
          refreshAgainRef.current = false;
          scheduleRefresh();
        }
      }
    }, RESOURCE_REFRESH_DELAY_MS);
  }, [loadMods, refreshDependencyHealth]);

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, []);

  useEvent('instance-mods-fs-changed', (payload) => {
    if (payload.instanceId !== instanceId) return;
    if (isBatchUpgradeRunningRef.current) return;
    scheduleRefresh();
  });

  useEvent('resource-download-progress', (payload) => {
    if (!isCompletedResourceDownload(payload)) return;
    if (isBatchUpgradeRunningRef.current) return;

    const doneKey = getResourceProgressKey(payload);
    const now = Date.now();
    if (doneKey === lastDoneKeyRef.current && now - lastDoneAtRef.current < RESOURCE_DONE_DEDUPE_MS) return;

    lastDoneKeyRef.current = doneKey;
    lastDoneAtRef.current = now;
    scheduleRefresh();
  });

  return {
    dependencyHealth,
    refreshDependencyHealth,
    isBatchUpgradeRunningRef,
  };
}
