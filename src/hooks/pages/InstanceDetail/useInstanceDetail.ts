// /src/hooks/pages/InstanceDetail/useInstanceDetail.ts
import { useState, useEffect } from 'react';

// 导航菜单枚举
export type DetailTab = 'overview' | 'basic' | 'java' | 'saves' | 'mods' | 'resourcepacks' | 'shaders' | 'export';

export interface InstanceDetailData {
  id: string;
  name: string;
  description: string;
  coverUrl: string;
  screenshots: string[]; // 游戏截图路径数组
}

export const useInstanceDetail = (instanceId: string) => {
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [data, setData] = useState<InstanceDetailData | null>(null);
  
  // 幻灯片当前索引
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // 1. 模拟从后端获取实例详情 (后续可替换为 invoke)
  useEffect(() => {
    // TODO: 替换为实际的后端调用
    const fetchDetail = async () => {
      setData({
        id: instanceId,
        name: 'Mob Maze (演示实例)',
        description: '进入这座遍布巨型生物、陷阱与合作谜题的超大迷宫！与队友携手搜集战利品、解锁强大能力，在时间耗尽前奋力求生。你能否成功逃出迷宫？',
        coverUrl: 'https://images.unsplash.com/photo-1607513837770-49272336db8a?w=800&q=80', // 占位封面图
        screenshots: [
          'https://images.unsplash.com/photo-1627856013091-fed6e4e048c1?w=800&q=80', // 占位截图1
          'https://images.unsplash.com/photo-1607513837770-49272336db8a?w=800&q=80', // 占位截图2
        ]
      });
    };
    fetchDetail();
  }, [instanceId]);

  // 2. 幻灯片轮播逻辑 (仅在有截图且处于概览页时运行)
  useEffect(() => {
    if (!data || data.screenshots.length <= 1 || activeTab !== 'overview') return;

    const timer = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % data.screenshots.length);
    }, 4000); // 每4秒切换一张

    return () => clearInterval(timer);
  }, [data, activeTab]);

  const handlePlay = () => {
    console.log(`准备启动实例: ${data?.name}`);
    // TODO: 调用后端启动逻辑
  };

  return {
    activeTab,
    setActiveTab,
    data,
    currentImageIndex,
    handlePlay
  };
};