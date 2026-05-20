import { useState, useEffect, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';

import {
  saveService,
  type SaveItem,
  type SaveBackupMetadata,
  type SaveBackupProgress,
  type SaveRestoreResult,
} from '../logic/saveService';

export const useSaveManager = (instanceId: string) => {
  const [saves, setSaves] = useState<SaveItem[]>([]);
  const [backups, setBackups] = useState<SaveBackupMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeletingBackup, setIsDeletingBackup] = useState(false);
  const [backupProgress, setBackupProgress] = useState<SaveBackupProgress | null>(null);

  const loadSavesAndBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savesData, backupsData] = await Promise.all([
        saveService.getSaves(instanceId),
        saveService.getBackups(instanceId),
      ]);
      setSaves(savesData);
      setBackups(backupsData);
    } catch (error) {
      console.error('Failed to load saves and backups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadSavesAndBackups();
  }, [loadSavesAndBackups]);

  useEffect(() => {
    const unlistenPromise = listen<SaveBackupProgress>('save-backup-progress', (event) => {
      if (event.payload.instanceId !== instanceId) return;
      setBackupProgress(event.payload);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [instanceId]);

  const clearBackupProgress = useCallback(() => {
    setBackupProgress(null);
  }, []);

  const backupSave = async (folderName: string, mode: 'full' | 'differential' = 'full'): Promise<SaveBackupMetadata> => {
    setIsBackingUp(true);
    setBackupProgress({
      instanceId,
      folderName,
      current: 0,
      total: 1,
      message: folderName,
      stage: 'QUEUE',
    });

    try {
      const result = await saveService.backupSave(instanceId, folderName, mode);
      await loadSavesAndBackups();
      setBackupProgress((current) =>
        current?.folderName === folderName
          ? {
              ...current,
              current: current.total > 0 ? current.total : 1,
              total: current.total > 0 ? current.total : 1,
              message: folderName,
              stage: 'DONE',
            }
          : {
              instanceId,
              folderName,
              current: 1,
              total: 1,
              message: folderName,
              stage: 'DONE',
            }
      );
      return result;
    } catch (error) {
      console.error('Failed to create backup:', error);
      setBackupProgress({
        instanceId,
        folderName,
        current: 1,
        total: 1,
        message: String(error),
        stage: 'ERROR',
      });
      throw error;
    } finally {
      setIsBackingUp(false);
    }
  };

  const restoreBackup = async (
    backupId: string,
    restoreConfigs: boolean
  ): Promise<SaveRestoreResult> => {
    setIsRestoring(true);
    try {
      const result = await saveService.restoreBackup(
        instanceId,
        backupId,
        restoreConfigs,
        true
      );
      await loadSavesAndBackups();
      return result;
    } catch (error) {
      console.error('Failed to restore backup:', error);
      throw error;
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteSave = async (folderName: string, directDelete: boolean) => {
    try {
      setSaves((prev) => prev.filter((item) => item.folderName !== folderName));
      await saveService.deleteSave(instanceId, folderName, directDelete);
    } catch (error) {
      console.error('Failed to delete save:', error);
      await loadSavesAndBackups();
    }
  };

  const deleteBackup = async (backupId: string) => {
    setIsDeletingBackup(true);
    try {
      setBackups((prev) => prev.filter((item) => item.backupId !== backupId));
      await saveService.deleteBackup(instanceId, backupId);
      await loadSavesAndBackups();
    } catch (error) {
      console.error('Failed to delete backup:', error);
      await loadSavesAndBackups();
      throw error;
    } finally {
      setIsDeletingBackup(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleString();

  return {
    saves,
    backups,
    isLoading,
    isBackingUp,
    isRestoring,
    isDeletingBackup,
    backupProgress,
    loadSavesAndBackups,
    backupSave,
    restoreBackup,
    deleteSave,
    deleteBackup,
    clearBackupProgress,
    formatSize,
    formatDate,
  };
};
