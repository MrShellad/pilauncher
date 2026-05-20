// /src/pages/Home.tsx
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHome } from '../hooks/pages/Home/useHome';
import { useInstances } from '../hooks/pages/Instances/useInstances';
import { useLauncherStore } from '../store/useLauncherStore';

import { PlayStats } from '../features/home/components/PlayStats';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';
import { InstanceSelectModal } from '../features/home/components/InstanceSelectModal';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { OreButton } from '../ui/primitives/OreButton';

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
    <div
      className="
        relative h-full w-full
        [--home-action-h:clamp(3rem,4.7vh,5.25rem)]
        [--home-action-font:clamp(1rem,2vh,1.875rem)]
        [--home-action-icon:clamp(1.25rem,1.55vw,2rem)]
        [--home-action-gap:clamp(0.75rem,1vw,1.5rem)]
        [--home-hero-action-h:clamp(3.75rem,6.5vh,6.875rem)]
        [--home-hero-action-font:clamp(1.25rem,2.35vh,2.375rem)]
        [--home-side-button:clamp(3rem,5.8vh,5rem)]
        [--home-side-font:clamp(1rem,1.25vw,1.75rem)]
        [--home-side-icon:clamp(1.45rem,1.65vw,2.25rem)]
        [--home-panel-edge:clamp(1rem,2.3vw,4rem)]
        [--home-skin-w:clamp(12rem,25vw,27rem)]
        [--home-skin-h:clamp(18.75rem,50vh,40rem)]
      "
    >
      {/* ✅ 修复 3：将提取出的数据传给 PlayStats */}
      <PlayStats instanceId={currentId} playTime={playTime} lastPlayed={lastPlayed} />
      <div className="absolute bottom-[clamp(1rem,3vh,3rem)] right-[var(--home-panel-edge)] z-20 flex w-[var(--home-skin-w)] flex-col items-center gap-[clamp(0.75rem,1.4vh,1.5rem)]">
        <SkinViewerPlaceholder className="relative flex h-[var(--home-skin-h)] w-full cursor-grab items-center justify-center active:cursor-grabbing" />
        <OreButton
          focusKey="btn-wardrobe"
          variant="secondary"
          size="auto"
          className="!h-[var(--home-action-h)] !w-full !min-w-0 !px-[clamp(1rem,1.4vw,2rem)] !text-[length:var(--home-action-font)] !text-[#111214] [&_svg]:!text-[#111214]"
          onClick={() => setActiveTab('wardrobe')}
          autoScroll={false}
        >
          更衣室
        </OreButton>
      </div>

      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo instanceId={currentId || null} />
      </div>

      <div className="pointer-events-none absolute bottom-[clamp(5.5rem,13vh,12rem)] left-1/2 z-20 flex w-full -translate-x-1/2 justify-center">
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
