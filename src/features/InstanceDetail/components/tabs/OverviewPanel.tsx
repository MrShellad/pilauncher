// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { OreButton } from '../../../../ui/primitives/OreButton';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

// 引入设置卡片区块组件以统一视觉风格
import { SettingsSection } from '../../../../ui/layout/SettingsSection';

interface OverviewPanelProps {
  data: InstanceDetailData;
  currentImageIndex: number;
  onPlay: () => void;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ data, currentImageIndex, onPlay }) => {
  const imagesToShow = data.screenshots.length > 0 ? data.screenshots : [data.coverUrl];
  const currentImage = imagesToShow[currentImageIndex] || data.coverUrl;

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#1E1E1F]">
      
      {/* ================= 1. 顶部头图 (保留无缝通栏风格) ================= */}
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
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2C] to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* ================= 2. 标题与操作栏 ================= */}
      <div className="flex items-center justify-between px-6 md:px-12 py-5 bg-[#2A2A2C] border-b-[3px] border-[#18181B] flex-shrink-0 z-10 shadow-sm">
        <h1 className="text-2xl md:text-3xl text-white font-minecraft ore-text-shadow truncate pr-4">
          {data.name}
        </h1>
        <OreButton variant="primary" size="lg" onClick={onPlay} className="min-w-[180px]">
          游戏
        </OreButton>
      </div>

      {/* ================= 3. 下方模块化信息区 (复用 SettingsSection) ================= */}
      {/* 加入最大宽度和内边距，使排版阅读体验极佳 */}
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          
          <SettingsSection title="说明">
            <div className="p-6">
              <p className="text-base text-[#A0A0A0] leading-relaxed font-minecraft tracking-wide">
                {data.description || '该实例没有提供详细说明。'}
              </p>
            </div>
          </SettingsSection>

          <SettingsSection title="活动">
            <div className="p-6">
              <p className="text-base text-[#A0A0A0] leading-relaxed font-minecraft tracking-wide">
                暂无近期活动。
              </p>
            </div>
          </SettingsSection>

        </div>
      </div>
      
    </div>
  );
};