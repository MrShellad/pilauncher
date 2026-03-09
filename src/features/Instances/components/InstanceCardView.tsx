// src/features/Instances/components/InstanceCardView.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Play, Settings, Loader2 } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { useGameLaunch } from '../../../hooks/useGameLaunch';

import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreMotionTokens } from '../../../style/tokens/motion'; 

// ✅ 1. 引入你的超级输入驱动
import { useInputAction } from '../../../ui/focus/InputDriver';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

// ✅ 2. 新增：无头事件监听组件
// 它负责窃听全局的 ACTION_Y 指令，但只在当前卡片被聚焦时触发路由跳转
const CardFocusHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({ focused, onAction }) => {
  // 使用 Ref 避免闭包陷阱或引发不必要的重复绑定
  const actionRef = useRef(onAction);
  useEffect(() => { actionRef.current = onAction; }, [onAction]);

  useInputAction('ACTION_Y', useCallback(() => {
    if (focused) {
      actionRef.current();
    }
  }, [focused]));

  return null;
};

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit }) => {
  const { isLaunching, launchGame } = useGameLaunch();

  return (
    <FocusItem focusKey={`card-play-${instance.id}`} onEnter={() => launchGame(instance.id)}>
      {({ ref, focused }) => (
        <>
          {/* ✅ 3. 将窃听器挂载到这里，接收 focused 状态 */}
          <CardFocusHandler focused={focused} onAction={onClick} />
          
          <motion.div
            ref={ref}
            tabIndex={-1}
            onClick={() => launchGame(instance.id)}
            // 保留原生键盘支持，作为鼠标/纯键盘模式下的兜底
            onKeyDown={(e) => {
              if (e.key.toLowerCase() === 'y') {
                e.stopPropagation();
                onClick();
              }
            }}
            initial="rest"
            animate={focused ? "hover" : "rest"}
            whileHover="hover"
            className={`
              relative flex flex-col w-[260px] md:w-[280px] rounded-[4px] cursor-pointer select-none group
              transition-all duration-200 transform-gpu
              border-[4px] ${focused ? 'border-white shadow-[0_0_30px_rgba(255,255,255,0.2)] z-50' : 'border-transparent shadow-lg'}
            `}
          >
            <div className="flex flex-col h-full bg-[#141415] border-[3px] border-black border-b-[6px] rounded-[2px] overflow-hidden">
              
              <div className="relative w-full aspect-video bg-[#0A0A0C] overflow-hidden border-b-[3px] border-black">
                {instance.coverUrl ? (
                  <motion.img
                    src={instance.coverUrl}
                    alt={instance.name}
                    variants={OreMotionTokens.cardCoverScale as Variants}
                    className="w-full h-full object-cover origin-center"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-gray-700 font-minecraft uppercase tracking-widest">No Cover</div>
                )}

                <div className={`absolute inset-0 transition-colors duration-300 pointer-events-none ${focused ? 'bg-black/10' : 'bg-black/50 group-hover:bg-black/30'}`} />

                <div className="absolute top-2 right-2 z-30 flex items-center">
                  {focused ? (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-sm border-[2px] border-[#EAB308]/50 shadow-xl pointer-events-none">
                      <div className="w-[18px] h-[18px] rounded-full bg-[#EAB308] flex items-center justify-center text-[10px] font-black text-black leading-none pb-[1px] shadow-[0_0_8px_rgba(234,179,8,0.5)]">Y</div>
                      <span className="text-[10px] text-white font-minecraft font-bold tracking-widest uppercase">详情</span>
                    </motion.div>
                  ) : (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onEdit(); }} 
                      className="opacity-0 group-hover:opacity-100 p-2 bg-black/60 hover:bg-[#3C8527] rounded-sm border-[2px] border-transparent hover:border-black text-gray-300 hover:text-white backdrop-blur-sm transition-all duration-200 outline-none shadow-md" 
                      title="编辑配置"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                </div>
              </div>

              <div className="w-full bg-[#1A1A1C] p-2 border-b-[3px] border-black">
                <OreButton
                  variant="primary"
                  size="full"
                  className={`!h-[44px] shadow-inner transition-all duration-300 ${focused ? 'brightness-110' : ''}`}
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    launchGame(instance.id); 
                  }}
                  tabIndex={-1}
                >
                  {isLaunching ? <Loader2 size={18} className="animate-spin mr-2" /> : <Play size={18} fill="currentColor" className="mr-2" />}
                  {isLaunching ? '启动中...' : '开始游戏'}
                </OreButton>
              </div>

              <div className="flex flex-col px-4 py-3 bg-[#141415] flex-1 justify-center">
                <span className="text-white font-minecraft text-lg truncate drop-shadow-md tracking-wide">
                  {instance.name}
                </span>
                
                <div className="flex items-center text-gray-500 font-minecraft text-[11px] mt-1.5 space-x-2 truncate">
                  <span className="bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                    {instance.version}
                  </span>
                  
                  {instance.loader && instance.loader !== 'Vanilla' && (
                    <span className="bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                      {instance.loader}
                    </span>
                  )}
                  
                  {instance.playTime > 0 && (
                    <>
                      <span className="opacity-30">|</span>
                      <span>{(instance.playTime / 60).toFixed(1)}H</span>
                    </>
                  )}
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </FocusItem>
  );
};