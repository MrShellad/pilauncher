// /src/hooks/pages/InstanceDetail/useResourceManager.ts
import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ask } from '@tauri-apps/plugin-dialog';

// 必须和 Rust 端的 enum 严格对应
export type ResourceType = 'mod' | 'save' | 'shader' | 'resourcePack';

export interface ResourceItem {
  fileName: string;
  isEnabled: boolean;
  isDirectory: boolean;
  fileSize: number;
  modifiedAt: number;
  meta?: any; // 给前端留的扩展口，比如解析出的图片URL
}

export const useResourceManager = (instanceId: string, resType: ResourceType) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await invoke<ResourceItem[]>('list_resources', { id: instanceId, resType });
      setItems(data);
    } catch (error) {
      console.error(`获取 ${resType} 列表失败:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, resType]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  // 启用 / 禁用
  const toggleItem = async (fileName: string, enable: boolean) => {
    try {
      // 乐观更新 UI，杜绝延迟感
      setItems(prev => prev.map(item => 
        item.fileName === fileName ? { ...item, isEnabled: enable, fileName: enable ? fileName.replace('.disabled', '') : `${fileName}.disabled` } : item
      ));
      await invoke('toggle_resource', { id: instanceId, resType, fileName, enable });
    } catch (error) {
      console.error(`切换状态失败:`, error);
      fetchResources(); // 失败则回滚 UI
    }
  };

  // 删除
  const deleteItem = async (fileName: string) => {
    const confirmed = await ask(`确定要删除 "${fileName}" 吗？此操作不可逆！`, { title: '危险确认', kind: 'warning' });
    if (confirmed) {
      try {
        setItems(prev => prev.filter(item => item.fileName !== fileName));
        await invoke('delete_resource', { id: instanceId, resType, fileName });
      } catch (error) {
        console.error(`删除失败:`, error);
        fetchResources();
      }
    }
  };

  // 备份/快照
  const createSnapshot = async (desc: string) => {
    try {
      await invoke('create_resource_snapshot', { id: instanceId, resType, desc });
      return true;
    } catch (error) {
      console.error(`快照创建失败:`, error);
      return false;
    }
  };

  return {
    items,
    isLoading,
    fetchResources,
    toggleItem,
    deleteItem,
    createSnapshot
  };
};