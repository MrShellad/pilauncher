// /src/features/InstanceDetail/hooks/useModManager.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { modService, type ModMeta } from '../logic/modService';
import { fetchModrinthInfo, fetchModrinthVersions } from '../logic/modrinthApi';

export type ModSortType = 'time' | 'name' | 'fileName';
export type ModSortOrder = 'asc' | 'desc';

export const useModManager = (instanceId: string) => {
  const [mods, setMods] = useState<ModMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
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
        isFetchingNetwork: !m.name || (!m.iconAbsolutePath && !m.networkIconUrl),
        isCheckingUpdate:
          m.manifestEntry?.source.platform === 'modrinth' &&
          !!m.manifestEntry?.source.projectId &&
          !!m.manifestEntry?.source.fileId
      }));
      setMods(enrichedMods);

      enrichedMods.forEach(async (mod, index) => {
        if (!mod.name || (!mod.iconAbsolutePath && !mod.networkIconUrl)) {
          const query = mod.modId || mod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');
          const netInfo = await fetchModrinthInfo(query);
          
          if (netInfo && mod.cacheKey) {
            modService.updateModCache(
              mod.cacheKey, 
              netInfo.title, netInfo.description, netInfo.icon_url
            ).catch(console.error);
          }
          
          setMods(current => {
            const newMods = [...current];
            newMods[index].networkInfo = netInfo;
            newMods[index].isFetchingNetwork = false;
            return newMods;
          });
        }

        // Check for updates
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
                return;
              }
            }
          } catch (e) { console.error("Update check failed", e); }
          setMods(current => {
            const newMods = [...current];
            newMods[index].isCheckingUpdate = false;
            return newMods;
          });
        }
      });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [instanceId]);

  useEffect(() => { loadMods(); }, [loadMods]);

  // ✅ 新增：使用 useMemo 动态计算排序结果
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

  const createSnapshot = async () => {
    setIsCreatingSnapshot(true);
    try { await modService.createSnapshot(instanceId, `更新前备份 (${mods.length}个模组)`); } 
    catch (e) { console.error(e); } finally { setIsCreatingSnapshot(false); }
  };

  const openModFolder = () => {
    modService.openModFolder(instanceId).catch(console.error);
  };

  return { 
    mods: sortedMods, // ✅ 吐出排序后的数据
    isLoading, instanceConfig, isCreatingSnapshot, sortType, setSortType, sortOrder, setSortOrder, 
    toggleMod, toggleMods, deleteMod, deleteMods, createSnapshot, openModFolder, loadMods
  };
};
