// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen } from 'lucide-react'; // ✅ 引入文件夹图标
import { OreButton } from '../../../../ui/primitives/OreButton';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';

// 引入设置卡片区块组件以统一视觉风格
import { SettingsSection } from '../../../../ui/layout/SettingsSection';

interface OverviewPanelProps {
  data: InstanceDetailData;
  currentImageIndex: number;
  onPlay: () => void;
  onOpenFolder?: () => void; // ✅ 新增：打开目录的回调
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({ data, currentImageIndex, onPlay, onOpenFolder }) => {
  // ✅ 核心修复：如果 screenshots 存在且不为空，使用原截图；否则去读取默认的 assets 目录图。
  // 注意：请根据你 src/assets/instances/ 目录下真实的图片名称修改下面的数组内容
  const fallbackImages = [
    '/src/assets/instances/default-3.png'
  ];
  
  const imagesToShow = data.screenshots && data.screenshots.length > 0 
    ? data.screenshots 
    : fallbackImages;

  // 使用取模安全地获取当前索引，防止越界
  const currentImage = imagesToShow[currentImageIndex % imagesToShow.length] || data.coverUrl;

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto custom-scrollbar bg-[#1E1E1F]">
      
      {/* ================= 1. 顶部头图 (保留无缝通栏风格) ================= */}
      <div className="relative w-full h-[280px] bg-black overflow-hidden flex-shrink-0">
        <AnimatePresence initial={false}>
          <motion.img
            key={currentImage} // 依赖 currentImage 触发渐变动画
            src={currentImage}
            alt="Hero Banner"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              // ✅ 终极兜底：如果 assets 下的默认图也不存在/写错名字，退回使用实例的 Cover 封面图
              const target = e.target as HTMLImageElement;
              if (target.src !== data.coverUrl) {
                target.src = data.coverUrl || '';
              }
            }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2C] to-transparent opacity-60 pointer-events-none" />
      </div>

      {/* ================= 2. 标题与操作栏 ================= */}
      <div className="flex items-center justify-between px-6 md:px-12 py-5 bg-[#2A2A2C] border-b-[3px] border-[#18181B] flex-shrink-0 z-10 shadow-sm">
        <h1 className="text-2xl md:text-3xl text-white font-minecraft ore-text-shadow truncate pr-4">
          {data.name}
        </h1>
        <div className="flex items-center space-x-3">
          {/* ✅ 新增：打开实例目录按钮 */}
          <OreButton 
            variant="secondary" 
            size="lg" 
            onClick={onOpenFolder || (() => alert('需要父组件传入 onOpenFolder 才能打开目录'))}
          >
            <FolderOpen size={18} className="mr-2" /> 实例目录
          </OreButton>
          
          <OreButton variant="primary" size="lg" onClick={onPlay} className="min-w-[120px] md:min-w-[180px]">
            开始游戏
          </OreButton>
        </div>
      </div>

      {/* ================= 3. 下方模块化信息区 ================= */}
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          
          <SettingsSection title="说明">
            <div className="p-6">
              <p className="text-base text-[#A0A0A0] leading-relaxed font-minecraft tracking-wide">
                {data.description || '该实例没有提供详细说明。'}
              </p>
            </div>
          </SettingsSection>

          {/* ✅ 已移除“活动”条目，让版面更清爽 */}

        </div>
      </div>
      
    </div>
  );
};