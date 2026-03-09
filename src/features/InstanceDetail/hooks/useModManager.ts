// /src/features/InstanceDetail/hooks/useModManager.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { modService, type ModMeta } from '../logic/modService';
import { fetchModrinthInfo } from '../logic/modrinthApi';

export type ModSortType = 'time' | 'name';

export const useModManager = (instanceId: string) => {
  const [mods, setMods] = useState<ModMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [instanceConfig, setInstanceConfig] = useState<any>(null);
  
  // ✅ 新增：排序状态
  const [sortType, setSortType] = useState<ModSortType>('time');

  const loadMods = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await modService.getInstanceDetail(instanceId);
      setInstanceConfig(config);

      const localMods = await modService.getMods(instanceId);
      const enrichedMods = localMods.map(m => ({ 
        ...m, 
        isFetchingNetwork: !m.name || (!m.iconAbsolutePath && !m.networkIconUrl) 
      }));
      setMods(enrichedMods);

      localMods.forEach(async (mod, index) => {
        if (!mod.name || (!mod.iconAbsolutePath && !mod.networkIconUrl)) {
          const query = mod.modId || mod.fileName.replace('.jar', '').replace('.disabled', '').replace(/[-_v0-9\.]+$/, '');
          const netInfo = await fetchModrinthInfo(query);
          
          if (netInfo) {
            modService.updateModCache(
              instanceId, mod.fileName.replace('.disabled', ''), 
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
      });
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  }, [instanceId]);

  useEffect(() => { loadMods(); }, [loadMods]);

  // ✅ 新增：使用 useMemo 动态计算排序结果
  const sortedMods = useMemo(() => {
    return [...mods].sort((a, b) => {
      // 禁用的模组永远沉底
      if (a.isEnabled !== b.isEnabled) return a.isEnabled ? -1 : 1;
      
      if (sortType === 'time') {
        return b.modifiedAt - a.modifiedAt; // 时间降序（最新下载的在最上面）
      } else {
        const nameA = (a.name || a.fileName).toLowerCase();
        const nameB = (b.name || b.fileName).toLowerCase();
        return nameA.localeCompare(nameB); // 名称字母顺序
      }
    });
  }, [mods, sortType]);

  const toggleMod = async (fileName: string, currentEnabled: boolean) => {
    try {
      setMods(prev => prev.map(m => m.fileName === fileName ? { ...m, isEnabled: !currentEnabled, fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '') } : m));
      await modService.toggleMod(instanceId, fileName, !currentEnabled);
    } catch (e) { console.error(e); loadMods(); }
  };

  const deleteMod = async (fileName: string) => {
    try {
      setMods(prev => prev.filter(m => m.fileName !== fileName));
      await modService.deleteMod(instanceId, fileName);
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
    isLoading, instanceConfig, isCreatingSnapshot, sortType, setSortType, 
    toggleMod, deleteMod, createSnapshot, openModFolder,loadMods
  };
};