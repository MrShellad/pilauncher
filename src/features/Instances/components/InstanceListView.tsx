// /src/features/Instances/components/InstanceListView.tsx
import React, { useState } from 'react';
import { motion, type Variants } from 'motion/react';
import { Play, Pencil, Loader2 } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { OreMotionTokens } from '../../../style/tokens/motion'; 
import { OreButton } from '../../../ui/primitives/OreButton'; 
import { useGameLaunch } from '../../../hooks/useGameLaunch';
import { useAccountStore } from '../../../store/useAccountStore';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';

// ✅ 引入空间焦点引擎
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useTranslation } from 'react-i18next';
import { formatPlayTime, formatRelativeTime } from '../../../utils/formatters';

interface InstanceListViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
}

export const InstanceListView: React.FC<InstanceListViewProps> = ({ instance, onClick, onEdit }) => {
  const { isLaunching, launchGame } = useGameLaunch();
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const inputMode = useInputMode();
  const { t } = useTranslation();

  const handlePlayClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find((a) => a.uuid === activeAccountId);

    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    launchGame(instance.id, inputMode === 'controller', e);
  };

  return (
    <>
      <motion.div
        role="listitem"
        aria-label={`${instance.name} - Minecraft ${instance.version} ${instance.loader}`}
        layoutId={`instance-container-${instance.id}`}
        layout
        className="relative flex w-full min-h-[88px] flex-none flex-row bg-[#4B4C50] border-2 border-b-[4px] border-[#1E1E1F] overflow-hidden shadow-md"
      >
        <FocusItem focusKey={`list-play-${instance.id}`} onEnter={() => handlePlayClick()}>
          {({ ref, focused, tabIndex }) => (
            <motion.div 
              ref={ref}
              role="button"
              aria-label={`启动 ${instance.name}`}
              tabIndex={tabIndex}
              onClick={handlePlayClick}
              onKeyDown={(e) => {
                if (e.key.toLowerCase() === 'm' || e.key === 'ContextMenu') {
                  e.stopPropagation();
                  onClick();
                }
              }}
              initial="rest"
              animate={focused ? "hover" : "rest"}
              whileHover="hover"
              className={`relative w-[156px] h-full bg-[#141415] flex-shrink-0 overflow-hidden cursor-pointer ${focused ? 'outline outline-[4px] outline-offset-[-4px] outline-ore-green z-20' : ''}`}
            >
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
                <div className="w-full h-full flex items-center justify-center text-[10px] text-ore-text-muted font-minecraft uppercase">
                  {t('instanceCard.noCover', 'NO COVER')}
                </div>
              )}

              {isLaunching ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75">
                  <Loader2 size={24} className="animate-spin text-[#3C8527] mb-1" />
                  <span className="font-minecraft text-xs font-bold uppercase tracking-widest text-[#3C8527] drop-shadow-md">
                    {t('instanceCard.launching', '启动中...')}
                  </span>
                </div>
              ) : (
                <motion.div variants={OreMotionTokens.cardOverlayFade as Variants} className="absolute inset-0 bg-black/40 flex items-center justify-center z-20 pointer-events-none">
                  <motion.div variants={OreMotionTokens.cardButtonSlide as Variants}>
                    <OreButton variant="primary" size="sm" className="shadow-xl" tabIndex={-1}>
                      <Play fill="currentColor" size={14} className="mr-1" />
                      {t('home.launchGame', '启动')}
                    </OreButton>
                  </motion.div>
                </motion.div>
              )}

              <div className="absolute bottom-0 left-0 bg-[#2A2A2C] border-t-2 border-r-2 border-[#1E1E1F] px-1.5 py-0.5 flex items-center z-10 pointer-events-none">
                <span className="text-white text-[10px] font-minecraft tracking-wide">
                   {instance.version} {instance.loader && instance.loader !== 'Vanilla' ? `• ${instance.loader}` : ''}
                </span>
              </div>
            </motion.div>
          )}
        </FocusItem>

        <FocusItem focusKey={`list-detail-${instance.id}`} onEnter={onClick}>
          {({ ref, focused, tabIndex }) => (
            <div 
              ref={ref}
              role="button"
              aria-label={`${instance.name} 详情`}
              tabIndex={tabIndex}
              onClick={onClick}
              className={`flex-1 flex flex-col justify-center px-4 border-l-2 border-[#1E1E1F] relative overflow-hidden cursor-pointer transition-colors ${focused ? 'bg-white/10 outline outline-[3px] outline-offset-[-3px] outline-white z-20' : 'hover:bg-white/5'}`}
            >
              <div className="absolute top-0 left-0 w-full h-[1px] bg-white/10 pointer-events-none" />
              <motion.span
                layoutId={`instance-title-${instance.id}`}
                className="text-white font-minecraft text-xl truncate drop-shadow-md"
              >
                {instance.name}
              </motion.span>
              <div className="flex items-center text-[#A0A0A0] font-minecraft text-xs mt-1.5 space-x-2 truncate">
                <span>{instance.lastPlayed ? formatRelativeTime(instance.lastPlayed, t) : t('home.neverPlayed', { defaultValue: '从未进行游戏' })}</span>
                {instance.playTime > 0 && <><span className="opacity-40">|</span><span>{formatPlayTime(instance.playTime, t)}</span></>}
              </div>
            </div>
          )}
        </FocusItem>

        {/* ✅ 修复 4：去除 (e) 与 stopPropagation */}
        <FocusItem focusKey={`list-edit-${instance.id}`} onEnter={() => onEdit()}>
          {({ ref, focused, tabIndex }) => (
            <button
              ref={ref} onClick={(e) => { e.stopPropagation(); onEdit(); }}
              tabIndex={tabIndex}
              aria-label={`编辑 ${instance.name} 配置`}
              className={`w-[88px] h-full flex-shrink-0 flex items-center justify-center border-l-2 border-[#1E1E1F] transition-colors focus:outline-none relative group/edit ${focused ? 'bg-white/20 outline outline-[3px] outline-offset-[-3px] outline-white z-20' : 'hover:bg-white/10'}`}
              title="编辑配置"
            >
              <div className="absolute top-0 left-0 w-[1px] h-full bg-white/10 pointer-events-none" />
              <Pencil size={24} className={`drop-shadow-md transition-colors ${focused ? 'text-ore-green' : 'text-white group-hover/edit:text-ore-green'}`} />
            </button>
          )}
        </FocusItem>
      </motion.div>
      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />
    </>
  );
};
