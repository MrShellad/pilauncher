// /src/features/Instances/components/InstanceCardView.tsx
import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Play, Pencil, Loader2 } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../style/tokens/motion'; 
import { useGameLaunch } from '../../../hooks/useGameLaunch';

// ✅ 引入空间焦点引擎
import { FocusItem } from '../../../ui/focus/FocusItem';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit }) => {
  const { isLaunching, launchGame } = useGameLaunch();

  return (
    <div className="relative flex flex-col w-[260px] bg-[#4B4C50] border-2 border-b-[6px] border-[#1E1E1F] overflow-hidden shadow-lg">
      
      {/* ✅ 修复 1：去除无效的 (e)，直接调用无参闭包 */}
      <FocusItem focusKey={`card-play-${instance.id}`} onEnter={() => launchGame(instance.id)}>
        {({ ref, focused }) => (
          <motion.div 
            ref={ref}
            // 这里保留 e，因为这是真实的鼠标点击事件
            onClick={(e) => launchGame(instance.id, e as any)}
            initial="rest"
            animate={focused ? "hover" : "rest"}
            whileHover="hover"
            className={`relative w-full aspect-video bg-[#141415] overflow-hidden cursor-pointer ${focused ? 'outline outline-[4px] outline-offset-[-4px] outline-ore-green z-20' : ''}`}
          >
            {instance.coverUrl ? (
              <motion.img 
                src={instance.coverUrl} alt={instance.name} variants={OreMotionTokens.cardCoverScale as Variants}
                className="w-full h-full object-cover origin-center" draggable={false}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-ore-text-muted">NO COVER</div>
            )}

            <motion.div variants={OreMotionTokens.cardOverlayFade as Variants} className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
              <motion.div variants={OreMotionTokens.cardButtonSlide as Variants}>
                <OreButton variant="primary" size="md" className="shadow-2xl" disabled={isLaunching} tabIndex={-1}>
                  {isLaunching ? <Loader2 className="animate-spin mr-2" size={18} /> : <Play fill="currentColor" size={18} className="mr-2" />}
                  {isLaunching ? '启动中...' : '启动游戏'}
                </OreButton>
              </motion.div>
            </motion.div>

            <div className="absolute bottom-0 left-0 bg-[#2A2A2C] border-t-2 border-r-2 border-[#1E1E1F] px-2 py-1 flex items-center shadow-sm z-10">
              <span className="text-white text-xs font-minecraft tracking-wide">
                {instance.version} {instance.loader !== 'Vanilla' ? `• ${instance.loader}` : ''}
              </span>
            </div>
          </motion.div>
        )}
      </FocusItem>

      <div className="flex w-full h-[68px] border-t-2 border-[#1E1E1F] relative">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10 pointer-events-none" />
        
        <FocusItem focusKey={`card-detail-${instance.id}`} onEnter={onClick}>
          {({ ref, focused }) => (
            <div 
              ref={ref} onClick={onClick}
              className={`flex-1 flex flex-col justify-center px-3 overflow-hidden cursor-pointer transition-colors ${focused ? 'bg-white/10 outline outline-[3px] outline-offset-[-3px] outline-white z-20' : 'hover:bg-white/5'}`}
            >
              <span className="text-white font-minecraft text-lg truncate drop-shadow-md">{instance.name}</span>
              <div className="flex items-center text-[#A0A0A0] font-minecraft text-xs mt-1 space-x-2 truncate">
                <span>{instance.lastPlayed}</span>
                {instance.playTime > 0 && <><span className="opacity-40">|</span><span>{(instance.playTime / 60).toFixed(1)}h</span></>}
              </div>
            </div>
          )}
        </FocusItem>

        {/* ✅ 修复 2：去除无效的 (e) 及其阻止冒泡逻辑 */}
        <FocusItem focusKey={`card-edit-${instance.id}`} onEnter={() => onEdit()}>
          {({ ref, focused }) => (
            <button
              ref={ref}
              // 鼠标点击依然保留 e.stopPropagation() 以防止误触进入详情页
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              className={`w-[68px] h-full flex-shrink-0 flex items-center justify-center border-l-2 border-[#1E1E1F] transition-colors focus:outline-none relative group/edit ${focused ? 'bg-white/20 outline outline-[3px] outline-offset-[-3px] outline-white z-20' : 'hover:bg-white/10'}`}
              title="编辑配置"
              tabIndex={-1}
            >
              <div className="absolute top-0 left-0 w-[1px] h-full bg-white/10 pointer-events-none" />
              <Pencil size={24} className={`drop-shadow-md transition-colors ${focused ? 'text-ore-green' : 'text-white group-hover/edit:text-ore-green'}`} />
            </button>
          )}
        </FocusItem>
      </div>
    </div>
  );
};