// /src/features/InstanceDetail/hooks/useModManager.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { listen } from '@tauri-apps/api/event';
import { modService, type ModMeta, type SnapshotProgressEvent, type InstanceSnapshot, type SnapshotDiff } from '../logic/modService';
import { fetchModrinthVersions } from '../logic/modrinthApi';

export type ModSortType = 'time' | 'name' | 'fileName';
export type ModSortOrder = 'asc' | 'desc';

export const useModManager = (instanceId: string) => {
  const [mods, setMods] = useState<ModMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [snapshotState, setSnapshotState] = useState<'idle' | 'snapshotting' | 'rolling_back'>('idle');
  const [snapshotProgress, setSnapshotProgress] = useState<SnapshotProgressEvent | null>(null);
  const [instanceConfig, setInstanceConfig] = useState<any>(null);
  
  // ✅ 新增：排序状态
  const [sortType, setSortType] = useState<ModSortType>('time');
  const [sortOrder, setSortOrder] = useState<ModSortOrder>('desc');

  const loadMods = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await modService.getInstanceDetail(instanceId);
      setInstanceConfig(config);

      const targetMc = config?.game_version || config?.gameVersion || config?.mcVersion || '';
      const targetLoader = config?.loader || '';

      const localMods = await modService.getMods(instanceId);
      const enrichedMods = localMods.map(m => ({ 
        ...m, 
        isFetchingNetwork: false,
        isCheckingUpdate:
          m.manifestEntry?.source.platform === 'modrinth' &&
          !!m.manifestEntry?.source.projectId &&
          !!m.manifestEntry?.source.fileId
      }));
      setMods(enrichedMods);

      // 后台缓速检测更新逻辑（避免触发 API 限流 429）
      (async () => {
        for (let index = 0; index < enrichedMods.length; index++) {
          const mod = enrichedMods[index];
          if (
            mod.manifestEntry?.source.platform === 'modrinth' &&
            mod.manifestEntry.source.projectId &&
            mod.manifestEntry.source.fileId
          ) {
            try {
              const versions = await fetchModrinthVersions(
                mod.manifestEntry.source.projectId,
                targetMc,
                targetLoader
              );
              if (versions && versions.length > 0) {
                const latest = versions[0];
                if (latest.id !== mod.manifestEntry.source.fileId) {
                  setMods(current => {
                    const newMods = [...current];
                    newMods[index].hasUpdate = true;
                    newMods[index].updateVersionName = latest.name || latest.version_number;
                    newMods[index].updateDownloadUrl = latest.download_url;
                    newMods[index].updateFileId = latest.id;
                    newMods[index].isCheckingUpdate = false;
                    return newMods;
                  });
                  await new Promise(r => setTimeout(r, 200)); // 限流睡眠
                  continue;
                }
              }
            } catch (e) {
              console.error("Update check failed", e);
            }
            
            setMods(current => {
              const newMods = [...current];
              newMods[index].isCheckingUpdate = false;
              return newMods;
            });
            await new Promise(r => setTimeout(r, 200)); // 限流睡眠
          }
        }
      })();
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsLoading(false); 
    }
  }, [instanceId]);

  useEffect(() => { loadMods(); }, [loadMods]);
  const sortedMods = useMemo(() => {
    return [...mods].sort((a, b) => {
      let comparison = 0;
      if (sortType === 'time') {
        comparison = a.modifiedAt - b.modifiedAt;
      } else if (sortType === 'fileName') {
        comparison = a.fileName.toLowerCase().localeCompare(b.fileName.toLowerCase());
      } else {
        const nameA = (a.name || a.fileName).toLowerCase();
        const nameB = (b.name || b.fileName).toLowerCase();
        comparison = nameA.localeCompare(nameB);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [mods, sortType, sortOrder]);

  const toggleMod = async (fileName: string, currentEnabled: boolean) => {
    try {
      setMods(prev => prev.map(m => m.fileName === fileName ? { ...m, isEnabled: !currentEnabled, fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '') } : m));
      await modService.toggleMod(instanceId, fileName, !currentEnabled);
    } catch (e) { console.error(e); loadMods(); }
  };

  const toggleMods = async (fileNames: string[], enable: boolean) => {
    try {
      setMods(prev => prev.map(m => {
        if (fileNames.includes(m.fileName) && m.isEnabled !== enable) {
          return { ...m, isEnabled: enable, fileName: enable ? m.fileName.replace('.disabled', '') : `${m.fileName}.disabled` };
        }
        return m;
      }));
      await Promise.all(fileNames.map(fileName => modService.toggleMod(instanceId, fileName, enable)));
    } catch (e) { console.error(e); loadMods(); }
  };

  const deleteMod = async (fileName: string) => {
    try {
      setMods(prev => prev.filter(m => m.fileName !== fileName));
      await modService.deleteMod(instanceId, fileName);
    } catch (e) { console.error(e); loadMods(); }
  };

  const deleteMods = async (fileNames: string[]) => {
    try {
      setMods(prev => prev.filter(m => !fileNames.includes(m.fileName)));
      await Promise.all(fileNames.map(fileName => modService.deleteMod(instanceId, fileName)));
    } catch (e) { console.error(e); loadMods(); }
  };

  useEffect(() => {
    const unlisten = listen<SnapshotProgressEvent>('snapshot-progress', (event) => {
      setSnapshotProgress(event.payload);
    });
    return () => {
      unlisten.then(f => f());
    };
  }, []);

  const takeSnapshot = async (trigger: string, message: string) => {
    setSnapshotState('snapshotting');
    setSnapshotProgress(null);
    try { 
      return await modService.takeSnapshot(instanceId, trigger, message); 
    } catch (e) { 
      console.error(e); 
      throw e;
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
      await loadMods(); // reload mods since directory mapping changed
    } catch (e) {
      console.error(e);
      throw e;
    } finally {
      setSnapshotState('idle');
    }
  };

  const openModFolder = () => {
    modService.openModFolder(instanceId).catch(console.error);
  };

  return { 
    mods: sortedMods, // ✅ 吐出排序后的数据
    isLoading, instanceConfig, sortType, setSortType, sortOrder, setSortOrder,
    snapshotState, snapshotProgress,
    takeSnapshot, fetchHistory, diffSnapshots, doRollback, 
    toggleMod, toggleMods, deleteMod, deleteMods, openModFolder, loadMods
  };
};
