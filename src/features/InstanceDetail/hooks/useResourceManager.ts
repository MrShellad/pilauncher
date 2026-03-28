// /src/features/InstanceDetail/hooks/useResourceManager.ts
import { useCallback, useEffect, useState } from 'react';

import { resourceService, type ResourceItem, type ResourceType } from '../logic/resourceService';

export const useResourceManager = (instanceId: string, resType: ResourceType) => {
  const [items, setItems] = useState<ResourceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadItems = useCallback(async () => {
    setIsLoading(true);

    try {
      const data = await resourceService.list(instanceId, resType);
      setItems(data);

      if (resType === 'resourcePack') {
        data.forEach(async (item) => {
          try {
            const iconPath = await resourceService.extractResourcepackIcon(instanceId, item.fileName);
            if (!iconPath) return;

            setItems((prev) =>
              prev.map((current) =>
                current.fileName === item.fileName
                  ? { ...current, iconAbsolutePath: iconPath }
                  : current
              )
            );
          } catch {
            // Ignore icon extraction failures and keep the list responsive.
          }
        });
      }
    } catch (error) {
      console.error(`加载 ${resType} 失败:`, error);
    } finally {
      setIsLoading(false);
    }
  }, [instanceId, resType]);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  const toggleItem = async (fileName: string, currentEnabled: boolean) => {
    try {
      setItems((prev) =>
        prev.map((item) =>
          item.fileName === fileName
            ? {
                ...item,
                isEnabled: !currentEnabled,
                fileName: currentEnabled
                  ? `${fileName}.disabled`
                  : fileName.replace('.disabled', ''),
              }
            : item
        )
      );

      await resourceService.toggle(instanceId, resType, fileName, !currentEnabled);
    } catch (error) {
      console.error('状态切换失败:', error);
      void loadItems();
    }
  };

  const deleteItem = async (fileName: string) => {
    try {
      setItems((prev) => prev.filter((item) => item.fileName !== fileName));
      await resourceService.delete(instanceId, resType, fileName);
    } catch (error) {
      console.error('删除失败:', error);
      void loadItems();
    }
  };

  const openFolder = () => resourceService.openFolder(instanceId, resType).catch(console.error);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return { items, isLoading, toggleItem, deleteItem, openFolder, formatSize };
};
