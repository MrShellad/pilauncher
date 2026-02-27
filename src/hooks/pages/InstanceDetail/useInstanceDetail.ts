// /src/hooks/pages/InstanceDetail/useInstanceDetail.ts
import { useState, useEffect } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

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

  // 1. 模拟获取数据
  useEffect(() => {
    setData({
      id: instanceId,
      name: 'Mob Maze (演示实例)',
      description: '进入这座遍布巨型生物、陷阱与合作谜题的超大迷宫！...',
      coverUrl: 'https://images.unsplash.com/photo-1607513837770-49272336db8a?w=800&q=80',
      screenshots: [
        'https://images.unsplash.com/photo-1627856013091-fed6e4e048c1?w=800&q=80',
        'https://images.unsplash.com/photo-1607513837770-49272336db8a?w=800&q=80',
      ]
    });
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

  // ================= 新增：基础设置相关操作 =================

  // 更新名称
  const handleUpdateName = async (newName: string) => {
    setData(prev => prev ? { ...prev, name: newName } : null);
    console.log(`[Mock] 调用 Rust 更新实例 ${instanceId} 名称为: ${newName}`);
    // TODO: invoke('update_instance_name', { id: instanceId, newName })
  };

  // 更换封面
  const handleUpdateCover = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
      });
      if (selected && typeof selected === 'string') {
        const newUrl = convertFileSrc(selected);
        setData(prev => prev ? { ...prev, coverUrl: newUrl } : null);
        console.log(`[Mock] 调用 Rust 将 ${selected} 复制为封面`);
        // TODO: invoke('update_instance_cover', { id: instanceId, sourcePath: selected })
      }
    } catch (e) {
      console.error("封面选择失败:", e);
    }
  };

  // 补全文件
  const handleVerifyFiles = async () => {
    console.log(`[Mock] 调用 Rust 校验并补全实例 ${instanceId} 的文件`);
  };

  // 删除实例
  const handleDeleteInstance = async () => {
    // 实际项目中这里应该有个二次确认弹窗
    console.log(`[Mock] 调用 Rust 彻底删除实例 ${instanceId}`);
    // TODO: invoke('delete_instance', { id: instanceId })，成功后跳转回主页
  };

  return {
    activeTab,
    setActiveTab,
    data,
    currentImageIndex,
    handlePlay,
    handleUpdateName,
    handleUpdateCover,
    handleVerifyFiles,
    handleDeleteInstance
  };
};