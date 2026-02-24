// /src/hooks/pages/Instances/useInstances.ts
import { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useLauncherStore } from '../../../store/useLauncherStore';
export interface InstanceItem {
  id: string;
  name: string;
  version: string;
  loader: string;
  playTime: number;
  lastPlayed: string;
  coverUrl: string; // 前端最终可以直接 src={coverUrl} 的地址
}

// 假设你在 src/assets/instances 目录下放了 3 张默认图
import defaultImg1 from '../../../assets/instances/default-1.jpg';
import defaultImg2 from '../../../assets/instances/default-2.jpg';
import defaultImg3 from '../../../assets/instances/default-3.jpg';

const DEFAULT_IMAGES = [defaultImg1, defaultImg2, defaultImg3];

export const useInstances = () => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  // 1. 从后端拉取数据
  useEffect(() => {
    const fetchInstances = async () => {
      try {
        // 调用 Rust 层的 get_all_instances
        const data: any[] = await invoke('get_all_instances');
        
        // 映射并处理封面路径
        const formattedInstances = data.map(item => {
          let finalCoverUrl = '';

          if (item.cover_path) {
            // 如果 Rust 找到了本地图片，用 convertFileSrc 转换成 asset:// 协议
            finalCoverUrl = convertFileSrc(item.cover_path);
          } else {
            // 如果没找到，随机分配一张前端资源库的图片
            // 利用实例 ID 的哈希值取模，保证同一个实例每次刷新的默认图固定
            const hash = item.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
            finalCoverUrl = DEFAULT_IMAGES[hash % DEFAULT_IMAGES.length];
          }

          return {
            id: item.id,
            name: item.name,
            version: item.version,
            loader: item.loader,
            playTime: item.play_time,
            lastPlayed: item.last_played,
            coverUrl: finalCoverUrl
          };
        });

        setInstances(formattedInstances);
      } catch (error) {
        console.error("加载实例列表失败:", error);
      }
    };

    fetchInstances();
  }, []);
  const handleCreate = () => {
    setActiveTab('new-instance');
  };
  const handleImport = () => console.log('触发: 导入实例');
  const handleAddFolder = () => console.log('触发: 添加文件夹');
  const handleEdit = (id: string) => console.log('触发: 编辑实例', id);
  const handleCardClick = (id: string) => console.log('触发: 选中实例', id);

  return {
    instances,
    handleCreate,
    handleImport,
    handleAddFolder,
    handleEdit,
    handleCardClick
  };
};