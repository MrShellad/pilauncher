// /src/hooks/pages/InstanceDetail/useInstanceDetail.ts
import { useState, useEffect } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { open, ask } from '@tauri-apps/plugin-dialog';

export type DetailTab = 'overview' | 'basic' | 'java' | 'saves' | 'mods' | 'resourcepacks' | 'shaders' | 'export';

export interface InstanceDetailData {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  screenshots: string[]; 
}

export const useInstanceDetail = (instanceId: string) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [data, setData] = useState<InstanceDetailData | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  // 新增：向 UI 层暴露全局的初始化加载状态
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. 全局数据拉取（包含真实名称与绝对路径封面）
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsInitializing(true);
        const realData = await invoke<any>('get_instance_detail', { id: instanceId });
        
        let coverUrl = '';
        if (realData.cover_absolute_path) {
          coverUrl = `${convertFileSrc(realData.cover_absolute_path)}?t=${Date.now()}`;
        }

        setData({
          id: instanceId,
          name: realData.name || instanceId,
          description: realData.description || '这个实例还没有添加任何描述...',
          coverUrl: coverUrl,
          screenshots: [
            'https://images.unsplash.com/photo-1627856013091-fed6e4e048c1?w=800&q=80',
            'https://images.unsplash.com/photo-1607513837770-49272336db8a?w=800&q=80',
          ]
        });
      } catch (e) {
        console.error("获取实例详情失败:", e);
      } finally {
        setIsInitializing(false);
      }
    };
    fetchDetail();
  }, [instanceId]);

  // 2. 幻灯片逻辑
  useEffect(() => {
    if (!data || data.screenshots.length <= 1 || activeTab !== 'overview') return;
    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % data.screenshots.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [data, activeTab]);

  const handlePlay = () => console.log(`启动实例: ${data?.name}`);

  // ================= 核心业务逻辑层 (供 UI 组件调用) =================

  const handleUpdateName = async (newName: string) => {
    await invoke('rename_instance', { id: instanceId, newName });
    setData(prev => prev ? { ...prev, name: newName } : null);
  };

  const handleUpdateCover = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      title: '选择实例封面图'
    });

    if (selected && typeof selected === 'string') {
      const newAbsPath = await invoke<string>('change_instance_cover', { id: instanceId, imagePath: selected });
      const assetUrl = `${convertFileSrc(newAbsPath)}?t=${Date.now()}`;
      setData(prev => prev ? { ...prev, coverUrl: assetUrl } : null);
    } else {
      // 抛出特定的错误，让 UI 知道是用户主动取消，而不是报错
      throw new Error("USER_CANCELED");
    }
  };

  const handleVerifyFiles = async () => {
    console.log(`调用 Rust 校验并补全实例 ${instanceId} 的文件`);
  };

  const handleDeleteInstance = async (): Promise<boolean> => {
    const confirmed = await ask(`确定要彻底删除该实例吗？\n该操作不可逆转，所有存档和 MOD 将被永久清除！`, {
      title: '危险操作确认',
      kind: 'warning',
    });

    if (confirmed) {
      await invoke('delete_instance', { id: instanceId });
      return true; // 告知外部：已成功删除
    }
    return false;
  };

  return {
    activeTab,
    setActiveTab,
    data,
    isInitializing,
    currentImageIndex,
    handlePlay,
    handleUpdateName,
    handleUpdateCover,
    handleVerifyFiles,
    handleDeleteInstance
  };
};