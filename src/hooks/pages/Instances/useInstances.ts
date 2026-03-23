// /src/hooks/pages/Instances/useInstances.ts
import { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { useLauncherStore } from '../../../store/useLauncherStore';
import { useDownloadStore } from '../../../store/useDownloadStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
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
  // 处理第三方实例导入
  const handleAddThirdPartyFolder = async (path: string) => {
    try {
      // 1. 调用后端解析并注册
      const missingOpt: any = await invoke('import_third_party_instance', { path });

      // 2. 将此路径加入 settings.json 以供前端后续管理
      const { settings, updateGeneralSetting } = useSettingsStore.getState();
      const currentDirs = settings.general.thirdPartyDirs || [];
      if (!currentDirs.includes(path)) {
        updateGeneralSetting('thirdPartyDirs', [...currentDirs, path]);
      }

      // 3. 处理缺失的运行环境补充
      if (missingOpt) {
        const doDownload = window.confirm(
          `成功添加第三方实例！\n\n但发现缺少本地运行环境：\nMinecraft ${missingOpt.mc_version} (${missingOpt.loader_type} ${missingOpt.loader_version})\n\n是否立即调用下载管理开始补全缺失的运行环境？`
        );
        if (doDownload) {
          setActiveTab('home');
          useDownloadStore.getState().setPopupOpen(true);
          await invoke('download_missing_runtimes', { missingList: [missingOpt] });
        }
      } else {
        alert('成功导入实例！本地环境皆已满足。');
      }

      // 4. 重新拉取列表
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
      console.error("导入第三方实例失败:", err);
      alert(`导入第三方实例失败: \n${err}`);
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
    handleAddThirdPartyFolder,
    handleEdit,
    handleCardClick
  };
};