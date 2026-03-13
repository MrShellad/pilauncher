// /src/hooks/pages/Instances/useInstances.ts
import { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { open } from '@tauri-apps/plugin-dialog';
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
import defaultImg3 from '../../../assets/instances/default-3.png';

const DEFAULT_IMAGES = [defaultImg1, defaultImg2, defaultImg3];

export const useInstances = () => {
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const setActiveTab = useLauncherStore(state => state.setActiveTab);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);
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
  const handleAddFolder = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: true,
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];

      const result: any = await invoke('import_local_instances_folders', { paths });

      if (result.added === 0) {
        alert('未在选择的文件夹中找到有效的实例配置 (instance.json)。');
        return;
      }

      const missing = result.missing || [];
      if (missing.length > 0) {
        // Collect missing text
        const text = missing.map((m: any) => `Minecraft ${m.mc_version} (${m.loader_type} ${m.loader_version})`).join('\n');
        const doDownload = window.confirm(`成功添加 ${result.added} 个实例。\n\n但发现以下实例缺少本地运行环境：\n${text}\n\n是否立即调用下载管理开始补全缺失的运行环境？`);
        
        if (doDownload) {
          setActiveTab('home');
          useDownloadStore.getState().setPopupOpen(true);
          await invoke('download_missing_runtimes', { missingList: missing });
        }
      } else {
        alert(`成功添加了 ${result.added} 个实例，且本地环境均满足！`);
      }

      // 重新拉取列表
      const fetchInstances: () => Promise<void> = async () => {
        try {
          const data: any[] = await invoke('get_all_instances');
          const formattedInstances = data.map(item => {
            let finalCoverUrl = '';
            if (item.cover_path) {
              finalCoverUrl = convertFileSrc(item.cover_path);
            } else {
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
          console.error("刷新实例列表失败:", error);
        }
      };
      
      await fetchInstances();
      
    } catch (err) {
      console.error("添加文件夹失败:", err);
      alert(`添加实例文件夹失败: ${err}`);
    }
  };
  const handleEdit = (id: string) => {
    // 存入当前点击的 ID
    setSelectedInstanceId(id);
    // 触发页面切换动画，跳往详情页！
    setActiveTab('instance-detail');
  };
  const handleCardClick = (id: string) => {
    // 这里的 onClick (比如点封面) 通常是直接启动游戏或者也进详情，这里先复用进详情
    setSelectedInstanceId(id);
    setActiveTab('instance-detail');
  };

  return {
    instances,
    handleCreate,
    handleImport,
    handleAddFolder,
    handleEdit,
    handleCardClick
  };
};