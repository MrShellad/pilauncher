// /src/pages/Home.tsx
import React, { useState } from 'react';
import { useHome } from '../hooks/pages/Home/useHome';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useLauncherStore } from '../store/useLauncherStore'; // ✅ 引入全局 Store

import { PlayStats } from '../features/home/components/PlayStats';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';
import { InstanceSelectModal } from '../features/home/components/InstanceSelectModal';

const Home: React.FC = () => {
  const { playTime, lastPlayed, handleLaunch } = useHome();
  const { instances } = useInstances();
  
  // ✅ 接入全局 Store：获取当前选中的实例 ID 和路由切换方法
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. 确定当前应该显示的实例（如果有全局选中的就用全局，没有就默认列表第一个）
  const currentId = selectedInstanceId || (instances.length > 0 ? instances[0].id : '');
  const currentInstanceName = instances.find(i => i.id === currentId)?.name || "选择实例";

  // 2. 弹窗中点击实例的逻辑
  const handleCardClick = (id: string) => {
    setSelectedInstanceId(id);
    setIsModalOpen(false); 
  };

  // 3. 点击“设置”按钮，携带当前实例 ID，直接跨页跳转到详情页！
  const handleSettingsClick = () => {
    if (currentId) {
      setSelectedInstanceId(currentId);
      setActiveTab('instance-detail'); // 确保这里的命名与你侧边栏路由的定义一致
    }
  };

  return (
    <div className="w-full h-full relative">
      <PlayStats playTime={playTime} lastPlayed={lastPlayed} />
      <SkinViewerPlaceholder />

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo />
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full flex justify-center z-20">
        <LaunchControls 
          instanceId={currentId} // ✅ 核心修复 1：把当前高亮的 ID 传给控制组件
          instanceName={currentInstanceName}
          
          // ✅ 核心修复 2：极其重要！必须把 currentId 传给 handleLaunch！
          // 否则后端将不知道你要启动哪个实例，导致启动失败。
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