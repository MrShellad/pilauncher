// src/features/Instances/components/InstanceCardView.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, type Variants, AnimatePresence } from 'framer-motion';
import { Settings, Loader2, Menu } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { useGameLaunch } from '../../../hooks/useGameLaunch';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreMotionTokens } from '../../../style/tokens/motion';
import { useAccountStore } from '../../../store/useAccountStore';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';
import { useTranslation } from 'react-i18next';
import { formatPlayTime } from '../../../utils/formatters';

// ✅ 1. 引入你的超级输入驱动
import { useInputAction } from '../../../ui/focus/InputDriver';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

// ✅ 2. 新增：无头事件监听组件
// 它负责窃听全局的 MENU 指令，但只在当前卡片被聚焦时触发路由跳转
const CardFocusHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({ focused, onAction }) => {
  // 使用 Ref 避免闭包陷阱或引发不必要的重复绑定
  const actionRef = useRef(onAction);
  useEffect(() => { actionRef.current = onAction; }, [onAction]);

  useInputAction('MENU', useCallback(() => {
    if (focused) {
      actionRef.current();
    }
  }, [focused]));

  return null;
};

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit }) => {
  const { isLaunching, launchGame } = useGameLaunch();
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const inputMode = useInputMode();
  const { t } = useTranslation();

  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 600);
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setShowTooltip(false);
  };

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
        {({ ref, focused }) => {
          useEffect(() => {
            if (focused) {
              tooltipTimeoutRef.current = setTimeout(() => {
                setShowTooltip(true);
              }, 600);
            } else {
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
              setShowTooltip(false);
            }
            return () => {
              if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
            };
          }, [focused]);

          return (
            <>
              <CardFocusHandler focused={focused} onAction={onClick} />

              <motion.div
                ref={ref}
                layoutId={`instance-container-${instance.id}`}
                tabIndex={-1}
                onClick={handlePlayClick}
                // 保留原生键盘支持，作为鼠标/纯键盘模式下的兜底
                onKeyDown={(e) => {
                  if (e.key.toLowerCase() === 'm' || e.key === 'ContextMenu') {
                    e.stopPropagation();
                    onClick();
                  }
                }}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                initial="rest"
                animate={focused ? "hover" : "rest"}
                whileHover="hover"
                className={`
                  relative flex h-[16.5rem] min-w-[19.5rem] w-[clamp(19.5rem,21vw,25rem)] flex-col rounded-[0.25rem] cursor-pointer select-none group
                  transition-all duration-200
                  border-[0.25rem] ${focused ? 'border-white shadow-[0_0_1.5rem_rgba(255,255,255,0.22)] z-50' : 'border-transparent shadow-[0_0.5rem_1rem_rgba(0,0,0,0.35)]'}
                `}
              >
                <AnimatePresence>
                  {showTooltip && (
                    <motion.div
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-[100] w-[90%] max-w-[280px] bg-black/95 text-[#EAB308] border-2 border-white px-3 py-2 text-[1.05rem] font-minecraft shadow-2xl pointer-events-none text-center break-words"
                    >
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-x-[6px] border-t-[6px] border-x-transparent border-t-white" />
                      {instance.name}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex h-full flex-col overflow-hidden rounded-[0.125rem] border-[0.1875rem] border-[#111214] border-b-[0.375rem] bg-[#202226]">

                  <div className="relative w-full h-[61.8%] overflow-hidden border-b-[0.1875rem] border-black bg-[#111214]">
                    {instance.coverUrl ? (
                      <motion.img
                        src={instance.coverUrl}
                        alt={instance.name}
                        layoutId={`instance-cover-${instance.id}`}
                        variants={OreMotionTokens.cardCoverScale as Variants}
                        className="w-full h-full object-cover origin-center"
                        style={{
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                          willChange: 'transform',
                        }}
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[1.05rem] text-gray-700 font-minecraft uppercase tracking-widest">
                        {t('instanceCard.noCover', 'No Cover')}
                      </div>
                    )}

                    {isLaunching && (
                      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75">
                        <Loader2 size={32} className="animate-spin text-[#3C8527] mb-2" />
                        <span className="font-minecraft text-[1.05rem] font-bold uppercase tracking-widest text-[#3C8527] drop-shadow-md">
                          {t('instanceCard.launching', 'Launching...')}
                        </span>
                      </div>
                    )}

                    {/* Version and Loader in head bottom-left */}
                    <div className="absolute bottom-2 left-2 z-30 flex items-center space-x-1.5 pointer-events-none">
                      <span className="bg-black/75 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/10 shadow-md font-minecraft text-[clamp(1.01rem,1.02vw,1.05rem)] flex-shrink-0">
                        {instance.version}
                      </span>

                      {instance.loader && instance.loader !== 'Vanilla' && (
                        <span className="flex items-center gap-1 bg-black/75 px-1.5 py-0.5 rounded-sm text-gray-300 border border-white/10 shadow-md font-minecraft text-[clamp(1.01rem,1.02vw,1.05rem)] flex-shrink-0">
                          <img 
                            src={new URL(`../../../assets/icons/tags/loaders/${instance.loader.toLowerCase()}.svg`, import.meta.url).href}
                            alt={instance.loader}
                            className="w-3.5 h-3.5 opacity-80 invert brightness-0"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          {instance.loader}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2 z-30 flex items-center">
                      {focused && !isLaunching ? (
                        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="pointer-events-none flex items-center gap-1.5 rounded-sm border-[0.125rem] border-[#EAB308]/50 bg-black/90 px-2.5 py-1.5 shadow-xl">
                          <div className="flex h-[1.125rem] w-[1.125rem] items-center justify-center rounded-full bg-[#EAB308] text-[0.625rem] font-black leading-none text-black shadow-[0_0_0.5rem_rgba(234,179,8,0.5)]">
                            <Menu size={11} strokeWidth={2.5} />
                          </div>
                          <span className="font-minecraft text-[1.05rem] font-bold uppercase tracking-widest text-white">
                            {t('instanceCard.details', 'Details')}
                          </span>
                        </motion.div>
                      ) : !isLaunching && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onEdit(); }}
                          className="opacity-0 group-hover:opacity-100 p-2 bg-black/75 hover:bg-[#3C8527] rounded-sm border-[2px] border-transparent hover:border-black text-gray-300 hover:text-white transition-all duration-200 outline-none shadow-md"
                          title="编辑配置"
                        >
                          <Settings size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="h-[38.2%] flex flex-col justify-center bg-[#2B2E33] px-4 py-2.5">
                    <motion.span
                      layoutId={`instance-title-${instance.id}`}
                      className={`truncate font-minecraft text-[clamp(1.15rem,1.2vw,1.35rem)] leading-normal tracking-wide transition-colors duration-200 ore-text-shadow ${
                        focused ? 'text-[#EAB308]' : 'text-white'
                      }`}
                    >
                      {instance.name}
                    </motion.span>

                    {instance.playTime > 0 && (
                      <div className="mt-1 flex items-center min-w-0 truncate font-minecraft text-[clamp(1.01rem,1.02vw,1.05rem)] leading-normal text-gray-400 opacity-75">
                        <span className="truncate">{formatPlayTime(instance.playTime, t)}</span>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            </>
          );
        }}
      </FocusItem>
      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />
    </>
  );
};
