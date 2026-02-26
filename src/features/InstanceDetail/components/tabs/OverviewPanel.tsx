// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

interface OverviewPanelProps {
  data: InstanceDetailData;
  currentImageIndex: number;
  onPlay: () => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ data, currentImageIndex, onPlay }) => {
  // 决定显示的图片：如果有截图就用截图，没有就用封面
  const imagesToShow = data.screenshots.length > 0 ? data.screenshots : [data.coverUrl];
  const currentImage = imagesToShow[currentImageIndex] || data.coverUrl;

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#1E1E1F]">
      
      {/* 1. 顶部头图 (幻灯片) */}
      <div className="relative w-full h-[280px] bg-black overflow-hidden flex-shrink-0">
        <AnimatePresence initial={false}>
          <motion.img
            key={currentImageIndex}
            src={currentImage}
            alt="Hero Banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </AnimatePresence>
        {/* 底部内阴影过渡 */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2C] to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* 2. 标题栏与启动按钮 (高度还原截图) */}
      <div className="flex items-center justify-between px-6 py-4 bg-[#2A2A2C] border-b-[3px] border-[#18181B] flex-shrink-0 z-10 shadow-sm">
        <h1 className="text-2xl text-white font-minecraft ore-text-shadow truncate pr-4">
          {data.name}
        </h1>
        <OreButton variant="primary" size="lg" onClick={onPlay} className="min-w-[180px]">
          游戏
        </OreButton>
      </div>

      {/* 3. 模块化信息区块 */}
      <div className="flex flex-col flex-1 bg-[#2A2A2C]">
        
        {/* 说明区块 */}
        <div className="px-6 py-5 border-b-[3px] border-[#18181B]">
          <h3 className="text-sm text-white font-minecraft mb-3">说明</h3>
          <p className="text-sm text-[#A0A0A0] leading-relaxed font-minecraft tracking-wide">
            {data.description || '该实例没有提供详细说明。'}
          </p>
        </div>

        {/* 占位区块 (如截图中的“活动”) */}
        <div className="px-6 py-5 border-b-[3px] border-[#18181B]">
          <h3 className="text-sm text-white font-minecraft mb-3">活动</h3>
          <p className="text-sm text-[#A0A0A0] font-minecraft">暂无近期活动。</p>
        </div>

      </div>
    </div>
  );
};