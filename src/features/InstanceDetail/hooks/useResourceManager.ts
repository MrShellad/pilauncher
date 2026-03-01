// /src/features/InstanceDetail/hooks/useResourceManager.ts
import { useState, useEffect, useCallback } from 'react';
import { resourceService, type ResourceType, type ResourceItem } from '../logic/resourceService';
import { ask } from '@tauri-apps/plugin-dialog';

export const useResourceManager = (instanceId: string, resType: ResourceType) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await resourceService.list(instanceId, resType);
      setItems(data);
    } catch (e) {
      console.error(`加载 ${resType} 失败:`, e);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, resType]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const toggleItem = async (fileName: string, currentEnabled: boolean) => {
    try {
      // 乐观 UI 更新：瞬间变色/变灰，消除延迟感
      setItems(prev => prev.map(item => 
        item.fileName === fileName 
          ? { ...item, isEnabled: !currentEnabled, fileName: currentEnabled ? `${fileName}.disabled` : fileName.replace('.disabled', '') } 
          : item
      ));
      await resourceService.toggle(instanceId, resType, fileName, !currentEnabled);
    } catch (e) {
      console.error('状态切换失败:', e);
      loadItems(); // 失败则回滚
    }
  };

  const deleteItem = async (fileName: string) => {
    const confirmed = await ask(`确定要彻底删除 "${fileName}" 吗？此操作不可逆！`, { title: '删除确认', kind: 'warning' });
    if (confirmed) {
      try {
        setItems(prev => prev.filter(item => item.fileName !== fileName));
        await resourceService.delete(instanceId, resType, fileName);
      } catch (e) {
        console.error('删除失败:', e);
        loadItems();
      }
    }
  };

  const openFolder = () => resourceService.openFolder(instanceId, resType).catch(console.error);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return { items, isLoading, toggleItem, deleteItem, openFolder, formatSize };
};