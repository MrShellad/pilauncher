// /src/pages/Home.tsx
import React from 'react';
import { useHome } from '../hooks/pages/Home/useHome';
import { PlayStats } from '../features/home/components/PlayStats';
import { SkinViewerPlaceholder } from '../features/home/components/SkinViewerPlaceholder';
import { HeroLogo } from '../features/home/components/HeroLogo';
import { LaunchControls } from '../features/home/components/LaunchControls';

export const Home: React.FC = () => {
  const {
    instanceName,
    playTime,
    lastPlayed,
    handleLaunch,
    handleOpenSettings,
    handleSelectInstance
  } = useHome();

  return (
    // 父容器使用 relative，作为所有绝对定位子元素的参考系
    <div className="w-full h-full relative">
      
      {/* 1. 左下角：游玩统计 (内部已自带 absolute left-8 bottom-12) */}
      <PlayStats playTime={playTime} lastPlayed={lastPlayed} />

      {/* 2. 右下角：3D 皮肤 (内部已自带 absolute right-12 bottom-12) */}
      <SkinViewerPlaceholder />

      {/* ================= 改动区域 ================= */}

      {/* 3. 顶部正中：大 Logo */}
      {/* top-16 保证它距离顶部导航栏有一个固定且完美的间距 */}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
        <HeroLogo />
      </div>

      {/* 4. 底部正中：控制区 */}
      {/* bottom-12 保证它与左右两侧的组件在同一水平线上对齐 */}
      <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full flex justify-center z-20">
        <LaunchControls 
          instanceName={instanceName}
          onLaunch={handleLaunch}
          onSettings={handleOpenSettings}
          onSelectInstance={handleSelectInstance}
        />
      </div>

    </div>
  );
};