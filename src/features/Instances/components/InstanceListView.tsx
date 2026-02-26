// /src/features/Instances/components/InstanceListView.tsx
import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pencil } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { OreMotionTokens } from '../../../style/tokens/motion'; 
// ✅ 引入我们封装好的按钮组件
import { OreButton } from '../../../ui/primitives/OreButton'; 

interface InstanceListViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceListView: React.FC<InstanceListViewProps> = ({ instance, onClick, onEdit }) => {
  return (
    <motion.div 
      onClick={onClick}
      initial="rest"
      animate="rest"
      whileHover="hover"
      // ✅ 1. 去掉了 hover:-translate-y-[2px]，列表现在稳如泰山，只保留厚度和边框
      className="relative flex flex-row w-full h-[88px] bg-[#4B4C50] border-2 border-b-[4px] border-[#1E1E1F] cursor-pointer overflow-hidden shadow-md hover:shadow-lg transition-all duration-200"
    >
      {/* ================= 左侧：封面图 ================= */}
      <div className="relative w-[156px] h-full bg-[#141415] flex-shrink-0 overflow-hidden">
        {instance.coverUrl ? (
          <motion.img 
            src={instance.coverUrl} 
            alt={instance.name} 
            variants={OreMotionTokens.cardCoverScale}
            className="w-full h-full object-cover origin-center"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-ore-text-muted">
            NO COVER
          </div>
        )}

        {/* 悬浮遮罩与游玩按钮：复用 Card 的动画 Token */}
        <motion.div 
          variants={OreMotionTokens.cardOverlayFade}
          className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"
        >
          <motion.div variants={OreMotionTokens.cardButtonSlide}>
            {/* ✅ 2. 统一使用 OreButton，由于列表封面宽度较小，这里采用 size="sm" 以保证比例和谐 */}
            <OreButton variant="primary" size="sm" className="pointer-events-none shadow-xl">
              <Play fill="currentColor" size={14} className="mr-1" />
              游玩
            </OreButton>
          </motion.div>
        </motion.div>

        {/* 底部信息角标 (版本与引导器) */}
        <div className="absolute bottom-0 left-0 bg-[#2A2A2C] border-t-2 border-r-2 border-[#1E1E1F] px-1.5 py-0.5 flex items-center z-10">
          <span className="text-white text-[10px] font-minecraft tracking-wide">
             {instance.version} {instance.loader !== 'Vanilla' ? `• ${instance.loader}` : ''}
          </span>
        </div>
      </div>

      {/* ================= 中部：实例名称与时间信息 ================= */}
      <div className="flex-1 flex flex-col justify-center px-4 border-l-2 border-[#1E1E1F] relative overflow-hidden">
        {/* 顶部内发光高光线 */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10 pointer-events-none" />
        
        <span className="text-white font-minecraft text-xl truncate drop-shadow-md">
          {instance.name}
        </span>
        
        <div className="flex items-center text-[#A0A0A0] font-minecraft text-xs mt-1.5 space-x-2 truncate">
          <span>{instance.lastPlayed}</span>
          {instance.playTime > 0 && (
            <>
              <span className="opacity-40">|</span>
              <span>{(instance.playTime / 60).toFixed(1)}h</span>
            </>
          )}
        </div>
      </div>

      {/* ================= 右侧：编辑按钮 ================= */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onEdit();
        }}
        className="w-[88px] h-full flex-shrink-0 flex items-center justify-center border-l-2 border-[#1E1E1F] hover:bg-white/10 transition-colors focus:outline-none relative group/edit"
        title="编辑配置"
      >
        {/* 左侧内发光线 */}
        <div className="absolute top-0 left-0 w-[1px] h-full bg-white/10 pointer-events-none" />
        
        <motion.div variants={OreMotionTokens.cardEditIcon}>
          <Pencil size={24} className="text-white drop-shadow-md group-hover/edit:text-ore-green transition-colors" />
        </motion.div>
      </button>
    </motion.div>
  );
};