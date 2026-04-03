// src/features/Instances/components/InstanceCardView.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Play, Settings, Loader2 } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { useGameLaunch } from '../../../hooks/useGameLaunch';

import { OreButton } from '../../../ui/primitives/OreButton';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreMotionTokens } from '../../../style/tokens/motion';
import { ControlHint } from '../../../ui/components/ControlHint';
import { useAccountStore } from '../../../store/useAccountStore';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';

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
  const [showNoAccountModal, setShowNoAccountModal] = React.useState(false);
  const inputMode = useInputMode();

  const handlePlayClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    launchGame(instance.id, inputMode === 'controller', e);
  };

  return (
    <>
    <FocusItem focusKey={`card-play-${instance.id}`} onEnter={() => handlePlayClick()}>
      {({ ref, focused }) => (
        <>
          {/* ✅ 3. 将窃听器挂载到这里，接收 focused 状态 */}
          <CardFocusHandler focused={focused} onAction={onClick} />

          <motion.div
            ref={ref}
            tabIndex={-1}
            onClick={handlePlayClick}
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
              relative flex h-[clamp(17rem,38vh,23.5rem)] min-w-[17.5rem] w-[clamp(17.5rem,20vw,24rem)] flex-col rounded-[0.25rem] cursor-pointer select-none group
              transition-all duration-200 transform-gpu
              border-[0.25rem] ${focused ? 'border-white shadow-[0_0_1.5rem_rgba(255,255,255,0.22)] z-50' : 'border-transparent shadow-[0_0.5rem_1rem_rgba(0,0,0,0.35)]'}
            `}
          >
            <div className="flex h-full flex-col overflow-hidden rounded-[0.125rem] border-[0.1875rem] border-[#111214] border-b-[0.375rem] bg-[#202226]">

              <div className="relative w-full aspect-video overflow-hidden border-b-[0.1875rem] border-black bg-[#111214]">
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

                <div className="absolute top-2 right-2 z-30 flex items-center">
                  {focused ? (
                    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-none flex items-center gap-1.5 rounded-sm border-[0.125rem] border-[#EAB308]/50 bg-black/80 px-2.5 py-1.5 shadow-xl backdrop-blur-md">
                      <div className="flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-[#EAB308] pb-[0.0625rem] text-[0.625rem] font-black leading-none text-black shadow-[0_0_0.5rem_rgba(234,179,8,0.5)]">Y</div>
                      <span className="font-minecraft text-[0.625rem] font-bold uppercase tracking-widest text-white">详情</span>
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

              <div className="flex w-full justify-center border-b-[0.1875rem] border-black bg-[#2A2D31] p-[clamp(0.5rem,0.9vh,0.85rem)]">
                <OreButton
                  variant="primary"
                  size="auto"
                  className="!h-[clamp(2.9rem,3.8vh,4.3rem)] !w-[clamp(11.5rem,78%,17rem)] !min-w-[clamp(11.5rem,78%,17rem)] !px-[clamp(0.75rem,1.1vw,1.25rem)] !text-[length:clamp(0.95rem,0.9rem+0.35vw,1.15rem)] !tracking-[0.035em] brightness-105 transition-all duration-300"
                  onClick={handlePlayClick}
                  tabIndex={-1}
                >
                  {isLaunching ? (
                    <Loader2 size={18} className="mr-2 animate-spin" />
                  ) : focused ? (
                    <ControlHint label="A" variant="face" tone="green" className="mr-2 -ml-1 scale-[0.82]" />
                  ) : (
                    <Play size={18} fill="currentColor" className="mr-2" />
                  )}
                  {isLaunching ? '启动中...' : '开始游戏'}
                </OreButton>
              </div>

              <div className="flex flex-1 flex-col justify-center bg-[#2B2E33] px-[clamp(0.75rem,1vw,1rem)] py-[clamp(0.5rem,0.9vh,0.8rem)]">
                <span className="truncate font-minecraft text-[length:clamp(0.9rem,0.82rem+0.36vw,1.1rem)] tracking-wide text-white drop-shadow-md">
                  {instance.name}
                </span>

                <div className="mt-1.5 flex items-center space-x-2 truncate font-minecraft text-[length:clamp(0.625rem,0.58rem+0.22vw,0.78rem)] text-gray-300">
                  <span className="bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                    {instance.version}
                  </span>

                  {instance.loader && instance.loader !== 'Vanilla' && (
                    <span className="flex items-center gap-1 bg-black/50 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/5 shadow-inner">
                      <img 
                        src={new URL(`../../../assets/icons/tags/loaders/${instance.loader.toLowerCase()}.svg`, import.meta.url).href}
                        alt={instance.loader}
                        className="w-3 h-3 opacity-80 invert brightness-0"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
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
    <NoAccountModal
      isOpen={showNoAccountModal}
      onClose={() => setShowNoAccountModal(false)}
    />
    </>
  );
};
