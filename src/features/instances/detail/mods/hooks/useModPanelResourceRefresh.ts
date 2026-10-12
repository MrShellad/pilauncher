import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useEvent } from '../../../../../hooks/useEvent';
import { modService, type InstanceDependencyHealth, type ModMeta } from '../../../../instance-resources';
import type { useModManager } from '../../hooks/useModManager';

const RESOURCE_REFRESH_DELAY_MS = 700;
interface UseModPanelResourceRefreshOptions {
  instanceId: string;
  mods: ModMeta[];
  isLoading: boolean;
  loadMods: ReturnType<typeof useModManager>['loadMods'];
}

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
    if (isLoading || mods.length === 0) return;

    const timer = window.setTimeout(() => {
      void refreshDependencyHealth();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [instanceId, dependencyStateSignature, isLoading, mods.length, refreshDependencyHealth]);

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

  return {
    dependencyHealth,
    refreshDependencyHealth,
    isBatchUpgradeRunningRef,
  };
}
