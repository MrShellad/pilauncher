// /src/features/InstanceDetail/hooks/useSaveManager.ts
import { useState, useEffect, useCallback } from 'react';
import { saveService, type SaveItem, type SaveBackupMetadata } from '../logic/saveService';

export const useSaveManager = (instanceId: string) => {
  const [saves, setSaves] = useState<SaveItem[]>([]);
  const [backups, setBackups] = useState<SaveBackupMetadata[]>([]); // ✅ 新增备份列表状态
  const [isLoading, setIsLoading] = useState(true);
  const [isBackingUp, setIsBackingUp] = useState(false);

  const loadSavesAndBackups = useCallback(async () => {
    setIsLoading(true);
    try {
      const [savesData, backupsData] = await Promise.all([
        saveService.getSaves(instanceId),
        saveService.getBackups(instanceId) // ✅ 并发获取备份列表
      ]);
      setSaves(savesData);
      setBackups(backupsData);
    } catch (e) {
      console.error('获取存档/备份失败:', e);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId]);

  useEffect(() => { loadSavesAndBackups(); }, [loadSavesAndBackups]);

  const backupSave = async (folderName: string) => {
    setIsBackingUp(true);
    try {
      await saveService.backupSave(instanceId, folderName);
      loadSavesAndBackups(); // ✅ 备份成功后刷新列表
    } catch (e) {
      console.error('备份失败:', e);
      alert(`备份失败: ${e}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  const deleteSave = async (folderName: string, directDelete: boolean) => {
    try {
      setSaves((prev) => prev.filter((s) => s.folderName !== folderName));
      await saveService.deleteSave(instanceId, folderName, directDelete);
    } catch (e) {
      console.error('删除失败:', e);
      loadSavesAndBackups();
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number) => new Date(timestamp * 1000).toLocaleString();

  return { saves, backups, isLoading, isBackingUp, loadSavesAndBackups, backupSave, deleteSave, formatSize, formatDate };
};