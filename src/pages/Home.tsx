// /src/pages/Home.tsx
import React, { Suspense, lazy, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHome } from '../hooks/pages/Home/useHome';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useLauncherStore } from '../store/useLauncherStore'; 

import { PlayStats } from '../features/home/components/PlayStats';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';
import { InstanceSelectModal } from '../features/home/components/InstanceSelectModal';
import { OreButton } from '../ui/primitives/OreButton';

const SkinViewerPlaceholder = lazy(() =>
  import('../features/home/components/SkinViewerPlaceholder').then((module) => ({
    default: module.SkinViewerPlaceholder,
  })),
);

const Home: React.FC = () => {
  // ✅ 修复 1：移除 playTime 和 lastPlayed 解构，只保留 handleLaunch
  const { handleLaunch } = useHome();
  const { t } = useTranslation();
  const { instances } = useInstances();
  
  const selectedInstanceId = useLauncherStore(state => state.selectedInstanceId);
  const setSelectedInstanceId = useLauncherStore(state => state.setSelectedInstanceId);
  const setActiveTab = useLauncherStore(state => state.setActiveTab);

  const [isModalOpen, setIsModalOpen] = useState(false);

  // 1. 确定当前应该显示的实例 ID
  const currentId = selectedInstanceId || (instances.length > 0 ? instances[0].id : '');
  
  // ✅ 修复 2：获取完整的当前实例对象，从中提取所有需要的展示数据
  const currentInstance = instances.find(i => i.id === currentId);
  const currentInstanceName = currentInstance?.name || t('home.selectInstance');
  const playTime = currentInstance?.playTime || 0;
  const lastPlayed = currentInstance?.lastPlayed || t('home.neverPlayed');

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
      <div className="absolute right-4 md:right-8 lg:right-12 bottom-6 w-[25vw] min-w-[180px] max-w-[320px] flex flex-col items-center gap-3 z-20">
        <Suspense fallback={null}>
          <SkinViewerPlaceholder className="relative w-full h-[50vh] min-h-[300px] max-h-[500px] flex items-center justify-center cursor-grab active:cursor-grabbing" />
        </Suspense>
        <OreButton
          focusKey="btn-wardrobe"
          variant="secondary"
          size="auto"
          className="!h-11 !w-full !min-w-0"
          onClick={() => setActiveTab('wardrobe')}
          autoScroll={false}
        >
          更衣室
        </OreButton>
      </div>

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo instanceId={currentId || null} />
      </div>

      <div className="absolute bottom-[13vh] left-1/2 -translate-x-1/2 w-full flex justify-center z-20 pointer-events-none">
        <LaunchControls 
          instanceId={currentId} 
          instanceName={currentInstanceName}
          onLaunch={(isGamepad) => handleLaunch(currentId, isGamepad)} 
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
