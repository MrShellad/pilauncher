// /src/pages/Home.tsx
import React, { useState } from 'react';
import { useHome } from '../hooks/pages/Home/useHome';
import { PlayStats } from '../features/home/components/PlayStats';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';

// 引入刚刚抽离的弹窗组件及配套的 mock 数据
import { InstanceSelectModal, MOCK_INSTANCES } from '../features/home/components/InstanceSelectModal';

// 【关键修改 1】：去掉这里的 export
const Home: React.FC = () => {
  const {
    instanceName,
    playTime,
    lastPlayed,
    handleLaunch,
    handleOpenSettings,
  } = useHome();

  // 弹窗与选中状态
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('1'); 

  // 处理实例卡片点击
  const handleCardClick = (id: string) => {
    setSelectedId(id);
    setIsModalOpen(false); 
    // TODO: 调用 useHome 返回的方法更新全局实例状态
  };

  // 动态获取当前选中的实例名称
  const currentInstanceName = MOCK_INSTANCES.find(i => i.id === selectedId)?.name || instanceName;

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

// 【关键修改 2】：在文件末尾使用 default 导出
export default Home;