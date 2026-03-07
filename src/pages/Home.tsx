// /src/pages/Home.tsx
import React, { useState } from 'react';
import { useHome } from '../hooks/pages/Home/useHome';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useLauncherStore } from '../store/useLauncherStore'; 

import { PlayStats } from '../features/home/components/PlayStats';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';
import { InstanceSelectModal } from '../features/home/components/InstanceSelectModal';

const Home: React.FC = () => {
  // ✅ 修复 1：移除 playTime 和 lastPlayed 解构，只保留 handleLaunch
  const { handleLaunch } = useHome();
  const { instances } = useInstances();
  
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. 确定当前应该显示的实例 ID
  const currentId = selectedInstanceId || (instances.length > 0 ? instances[0].id : '');
  
  // ✅ 修复 2：获取完整的当前实例对象，从中提取所有需要的展示数据
  const currentInstance = instances.find(i => i.id === currentId);
  const currentInstanceName = currentInstance?.name || "选择实例";
  const playTime = currentInstance?.playTime || 0;
  const lastPlayed = currentInstance?.lastPlayed || "从未进行游戏";

  // 2. 弹窗中点击实例的逻辑
  const handleCardClick = (id: string) => {
    setSelectedInstanceId(id);
    setIsModalOpen(false); 
  };

  // 3. 点击“设置”按钮，携带当前实例 ID，直接跨页跳转到详情页！
  const handleSettingsClick = () => {
    if (currentId) {
      setSelectedInstanceId(currentId);
      setActiveTab('instance-detail'); 
    }
  };

  return (
    <div className="w-full h-full relative">
      {/* ✅ 修复 3：将提取出的数据传给 PlayStats */}
      <PlayStats playTime={playTime} lastPlayed={lastPlayed} />
      <SkinViewerPlaceholder />

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo />
      </div>

      <div className="absolute bottom-[13vh] left-1/2 -translate-x-1/2 w-full flex justify-center z-20">
        <LaunchControls 
          instanceId={currentId} 
          instanceName={currentInstanceName}
          onLaunch={() => handleLaunch(currentId)} 
          onSettings={handleSettingsClick}
          onSelectInstance={() => setIsModalOpen(true)} 
        />
      </div>

      <InstanceSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedId={currentId}
        onSelect={handleCardClick}
      />
    </div>
  );
};

export default Home;