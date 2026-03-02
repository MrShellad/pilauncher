// /src/features/Instances/components/InstanceCardView.tsx
import React from 'react';
import { motion, type Variants } from 'framer-motion'; // ✅ 引入 Variants 类型
import { Play, Pencil, Loader2 } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../style/tokens/motion'; 
// ✅ 引入封装好的启动 Hook
import { useGameLaunch } from '../../../hooks/useGameLaunch';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit }) => {
  // ✅ 一行代码接管所有启动逻辑和状态
  const { isLaunching, launchGame } = useGameLaunch();

  return (
    <motion.div 
      onClick={onClick}
      initial="rest"
      animate="rest"
      whileHover="hover"
      className="relative flex flex-col w-full bg-[#4B4C50] border-2 border-b-[6px] border-[#1E1E1F] cursor-pointer overflow-hidden shadow-lg"
    >
      {/* ================= 上半部分：自适应封面图 ================= */}
      <div className="relative w-full aspect-video bg-[#141415] overflow-hidden">
        {instance.coverUrl ? (
          <motion.img 
            src={instance.coverUrl} 
            alt={instance.name} 
            variants={OreMotionTokens.cardCoverScale as Variants} // ✅ 加上类型断言
            className="w-full h-full object-cover origin-center"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-ore-text-muted">
            NO COVER
          </div>
        )}

        <motion.div 
          variants={OreMotionTokens.cardOverlayFade as Variants} // ✅ 加上类型断言
          className="absolute inset-0 bg-black/40 flex items-center justify-center z-20"
        >
          <motion.div variants={OreMotionTokens.cardButtonSlide as Variants}> {/* ✅ 加上类型断言 */}
            {/* ✅ 直接将 e 传给 launchGame，它会自动处理阻止冒泡 */}
            <OreButton 
              variant="primary" 
              size="md" 
              className="shadow-2xl"
              onClick={(e) => launchGame(instance.id, e)}
              disabled={isLaunching}
            >
              {isLaunching ? (
                <Loader2 className="animate-spin mr-2" size={18} />
              ) : (
                <Play fill="currentColor" size={18} className="mr-2" />
              )}
              {isLaunching ? '启动中...' : '启动游戏'}
            </OreButton>
          </motion.div>
        </motion.div>

        {/* 左下角信息角标 */}
        <div className="absolute bottom-0 left-0 bg-[#2A2A2C] border-t-2 border-r-2 border-[#1E1E1F] px-2 py-1 flex items-center shadow-sm z-10">
          <span className="text-white text-xs font-minecraft tracking-wide">
            {instance.version} {instance.loader !== 'Vanilla' ? `• ${instance.loader}` : ''}
          </span>
        </div>
      </div>

      {/* ================= 下半部分：名称、时间与操作 ================= */}
      <div className="flex w-full h-[68px] border-t-2 border-[#1E1E1F] relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10 pointer-events-none" />
        
        <div className="flex-1 flex flex-col justify-center px-3 overflow-hidden">
          <span className="text-white font-minecraft text-lg truncate drop-shadow-md">
            {instance.name}
          </span>
          <div className="flex items-center text-[#A0A0A0] font-minecraft text-xs mt-1 space-x-2 truncate">
            <span>{instance.lastPlayed}</span>
            {instance.playTime > 0 && (
              <>
                <span className="opacity-40">|</span>
                <span>{(instance.playTime / 60).toFixed(1)}h</span>
              </>
            )}
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="w-[68px] h-full flex-shrink-0 flex items-center justify-center border-l-2 border-[#1E1E1F] hover:bg-white/10 transition-colors focus:outline-none relative"
          title="编辑配置"
        >
          <div className="absolute top-0 left-0 w-[1px] h-full bg-white/10 pointer-events-none" />
          <motion.div variants={OreMotionTokens.cardEditIcon as Variants}> {/* ✅ 加上类型断言 */}
            <Pencil size={24} className="text-white drop-shadow-md" />
          </motion.div>
        </button>
      </div>
    </motion.div>
  );
};