// src/features/InstanceDetail/hooks/useModpackUpgrade.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface ModpackUpgradeInfo {
  hasUpdate: boolean;
  currentVersion: string | null;
  latestVersion: string;
  changelog: string | null;
  newMcVersion: string;
  newLoaderType: string;
  newLoaderVersion: string;
  currentMcVersion: string;
  backupOriginalVersion?: string | null;
  backupOriginalMcVersion?: string | null;
  backupOriginalLoaderType?: string | null;
  backupOriginalLoaderVersion?: string | null;
}

export interface ProgressEvent {
  instanceId: string;
  stage: string;
  fileName: string;
  current: number;
  total: number;
  message: string;
}

export const useModpackUpgrade = (instanceId: string) => {
  const [loading, setLoading] = useState(false);
  const [upgradeInfo, setUpgradeInfo] = useState<ModpackUpgradeInfo | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'checking' | 'backing-up' | 'downloading' | 'extracting' | 'completed' | 'rolling-back' | 'rolled-back' | 'failed' | 'rollback-confirm'>('idle');

  // Check if update is available
  const checkUpdate = async (newPackPath?: string) => {
    setLoading(true);
    setStatus('checking');
    setError(null);
    try {
      const info = await invoke<ModpackUpgradeInfo>('check_modpack_update', {
        instanceId,
        newPackPath: newPackPath || null,
      });
      setUpgradeInfo(info);
      setStatus('idle');
    } catch (err: any) {
      setError(err.toString());
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  // Run the upgrade process
  const upgradeModpack = async (newPackPath: string, skipBackup?: boolean) => {
    setLoading(true);
    setStatus(skipBackup ? 'downloading' : 'backing-up');
    setError(null);
    setProgress(null);
    try {
      await invoke('execute_modpack_upgrade', {
        instanceId,
        newPackPath,
        skipBackup: skipBackup || false,
      });
      setStatus('completed');
    } catch (err: any) {
      setError(err.toString());
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  // Run the rollback process
  const rollbackUpgrade = async () => {
    setLoading(true);
    setStatus('rolling-back');
    setError(null);
    try {
      await invoke('rollback_modpack_upgrade', {
        instanceId,
      });
      setStatus('rolled-back');
    } catch (err: any) {
      setError(err.toString());
      setStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  // Listen for deployment progress events from Tauri
  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;

    const setupListener = async () => {
      const unsub = await listen<ProgressEvent>('instance-deployment-progress', (event) => {
        if (event.payload.instanceId === instanceId) {
          setProgress(event.payload);
          // Map backend stages to hook status
          if (event.payload.stage === 'EXTRACTING') {
            setStatus('extracting');
          } else if (event.payload.stage === 'DOWNLOADING_MOD') {
            setStatus('downloading');
          }
        }
      });
      unlistenProgress = unsub;
    };

    setupListener();

    return () => {
      if (unlistenProgress) {
        unlistenProgress();
      }
    };
  }, [instanceId]);

  return {
    loading,
    status,
    upgradeInfo,
    progress,
    error,
    checkUpdate,
    upgradeModpack,
    rollbackUpgrade,
    setStatus,
  };
};
