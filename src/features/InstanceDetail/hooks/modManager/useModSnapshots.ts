import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';

import { modService, type SnapshotProgressEvent } from '../../logic/modService';

interface UseModSnapshotsOptions {
  instanceId: string;
  loadMods: () => Promise<void>;
}

export const useModSnapshots = ({ instanceId, loadMods }: UseModSnapshotsOptions) => {
  const [snapshotState, setSnapshotState] = useState<'idle' | 'snapshotting' | 'rolling_back'>('idle');
  const [snapshotProgress, setSnapshotProgress] = useState<SnapshotProgressEvent | null>(null);

  useEffect(() => {
    const unlisten = listen<SnapshotProgressEvent>('snapshot-progress', (event) => {
      setSnapshotProgress(event.payload);
    });
    return () => {
      unlisten.then((unlistenSnapshotProgress) => unlistenSnapshotProgress());
    };
  }, []);

  const takeSnapshot = useCallback(async (trigger: string, message: string) => {
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
  }, [instanceId]);

  const fetchHistory = useCallback(async () => {
    return await modService.getSnapshotHistory(instanceId);
  }, [instanceId]);

  const diffSnapshots = useCallback(async (oldId: string, newId: string) => {
    return await modService.calculateSnapshotDiff(instanceId, oldId, newId);
  }, [instanceId]);

  const doRollback = useCallback(async (snapshotId: string) => {
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
  }, [instanceId, loadMods]);

  return {
    snapshotState,
    snapshotProgress,
    takeSnapshot,
    fetchHistory,
    diffSnapshots,
    doRollback
  };
};
