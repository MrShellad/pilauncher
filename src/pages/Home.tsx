// /src/pages/Home.tsx
import React, { useState } from 'react';
import { useHome } from '../hooks/pages/Home/useHome';

// ✅ 引入 useInstances 获取真实数据
import { useInstances } from '../hooks/pages/Instances/useInstances';

import { PlayStats } from '../features/home/components/PlayStats';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';

// ✅ 只需引入 Modal，不需要再引入 MOCK_INSTANCES 了
import { InstanceSelectModal } from '../features/home/components/InstanceSelectModal';

const Home: React.FC = () => {
  const {
    instanceName, // 这个作为后备默认名称
    playTime,
    lastPlayed,
    handleLaunch,
    handleOpenSettings,
  } = useHome();

  // 获取真实实例数据
  const { instances } = useInstances();

  // 弹窗与选中状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(''); 

  // 处理实例卡片点击
  const handleCardClick = (id: string) => {
    setSelectedId(id);
    setIsModalOpen(false); 
    // TODO: 调用 useHome 或全局 Store 的方法，把选中的 ID 存入全局配置
  };

  // ✅ 动态获取当前选中的真实实例名称
  // 如果找到了选中实例就用它的名字，否则回退到 useHome 提供的默认名字
  const currentInstanceName = instances.find(i => i.id === selectedId)?.name || instanceName;

  return (
    <div className="w-full h-full relative">
      
      <PlayStats playTime={playTime} lastPlayed={lastPlayed} />
      <SkinViewerPlaceholder />

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo />
      </div>

      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full flex justify-center z-20">
        <LaunchControls 
          instanceName={currentInstanceName}
          onLaunch={handleLaunch}
          onSettings={handleOpenSettings}
          onSelectInstance={() => setIsModalOpen(true)} 
        />
      </div>

      {/* 独立的实例选择弹窗组件 */}
      <InstanceSelectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedId={selectedId}
        onSelect={handleCardClick}
      />

    </div>
  );
};

export default Home;