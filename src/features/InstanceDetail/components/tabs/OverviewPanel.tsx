// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface OverviewPanelProps {
  data: InstanceDetailData;
  currentImageIndex: number;
  onPlay: () => void;
  onOpenFolder?: () => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data,
  currentImageIndex,
  onPlay,
  onOpenFolder,
}) => {
  const fallbackImages = ['/src/assets/instances/default-3.png'];
  const imagesToShow = data.screenshots && data.screenshots.length > 0 ? data.screenshots : fallbackImages;
  const currentImage = imagesToShow[currentImageIndex % imagesToShow.length] || data.coverUrl;

  return (
    // ✅ 修复核心：增加 overflow-x-hidden，剪裁掉两侧超出边界的“隐形保险杠”
    <div className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1E1E1F] relative">
      
      <FocusItem focusKey="overview-guard-top" onFocus={() => setFocus('overview-btn-folder')}>
        {({ ref }) => (
          <div ref={ref as any} className="relative w-full h-[280px] bg-black overflow-hidden flex-shrink-0 outline-none">
            <AnimatePresence initial={false}>
              <motion.img
                key={currentImage}
                src={currentImage}
                alt="Hero Banner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2C] to-transparent opacity-60 pointer-events-none" />
          </div>
        )}
      </FocusItem>

      <div className="flex items-center justify-between px-6 md:px-12 py-5 bg-[#2A2A2C] border-b-[3px] border-[#18181B] flex-shrink-0 z-10 shadow-sm relative">
        
        <FocusItem focusKey="overview-guard-left" onFocus={() => setFocus('overview-btn-folder')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 -left-[100px] w-[100px] h-full outline-none pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        <h1 className="text-2xl md:text-3xl text-white font-minecraft ore-text-shadow truncate pr-4">{data.name}</h1>
        
        <div className="flex items-center space-x-3 relative">
          <OreButton
            focusKey="overview-btn-folder"
            variant="secondary"
            size="lg"
            onClick={onOpenFolder || (() => alert('需要传入 onOpenFolder 才能打开目录'))}
          >
            <FolderOpen size={18} className="mr-2" /> 实例目录
          </OreButton>

          <OreButton
            focusKey="overview-btn-play"
            variant="primary"
            size="lg"
            onClick={onPlay}
            className="min-w-[120px] md:min-w-[180px]"
          >
            开始游戏
          </OreButton>

          <FocusItem focusKey="overview-guard-right" onFocus={() => setFocus('overview-btn-play')}>
            {({ ref }) => <div ref={ref as any} className="absolute top-0 -right-[100px] w-[100px] h-full outline-none pointer-events-none" tabIndex={-1} />}
          </FocusItem>
        </div>
      </div>

      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          <SettingsSection title="说明">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">游戏版本</div>
                <div className="text-white text-lg font-bold">{data.version}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">加载器</div>
                <div className="text-ore-green text-lg font-bold capitalize">{data.loader}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">游戏时长</div>
                <div className="text-white text-lg font-bold">{data.playTime || '0 小时'}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">最后游玩</div>
                <div className="text-white text-lg font-bold truncate">{data.lastPlayed || '从未'}</div>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
};