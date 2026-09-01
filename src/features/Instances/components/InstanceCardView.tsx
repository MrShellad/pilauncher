// src/features/Instances/components/InstanceCardView.tsx
import React, { useRef, useEffect, useCallback, useState } from 'react';
import { motion, type Variants } from 'motion/react';
import { Settings, Loader2, Play, Clock, Calendar, Star, Menu } from 'lucide-react';
import type { InstanceItem } from '../../../hooks/pages/Instances/useInstances';
import { useGameLaunch } from '../../../hooks/useGameLaunch';

import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreTooltip } from '../../../ui/primitives/OreTooltip';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreMotionTokens } from '../../../style/tokens/motion';
import { useAccountStore } from '../../../store/useAccountStore';
import { useInputMode } from '../../../ui/focus/FocusProvider';
import { useScreenDensity, type ScreenDensity } from '../../../hooks/ui/useScreenDensity';
import { NoAccountModal } from '../../../ui/components/NoAccountModal';
import { useTranslation } from 'react-i18next';
import { formatPlayTime, formatRelativeTime } from '../../../utils/formatters';
import { useInputAction } from '../../../ui/focus/InputDriver';

export type CardSizeTier = 'sm' | 'md' | 'lg';

interface InstanceCardViewProps {
  instance: InstanceItem;
  onClick: () => void;
  onEdit: () => void;
  tier?: CardSizeTier;
}

const getTierFromDensity = (density: ScreenDensity): CardSizeTier => {
  if (density === 'compact' || density === 'deck') return 'sm';
  if (density === 'wide' || density === 'tv') return 'lg';
  return 'md';
};

const getLoaderBadgeConfig = (loader?: string) => {
  const l = (loader || 'vanilla').toLowerCase();
  switch (l) {
    case 'fabric':
      return {
        bg: 'bg-[#1B7FE2]',
        border: 'border-[#0F5BB5]',
        text: 'text-white',
        label: 'Fabric'
      };
    case 'forge':
      return {
        bg: 'bg-[#D48806]',
        border: 'border-[#AD6800]',
        text: 'text-white',
        label: 'Forge'
      };
    case 'neoforge':
      return {
        bg: 'bg-[#D93636]',
        border: 'border-[#A81D1D]',
        text: 'text-white',
        label: 'NeoForge'
      };
    case 'quilt':
      return {
        bg: 'bg-[#7C3AED]',
        border: 'border-[#5B21B6]',
        text: 'text-white',
        label: 'Quilt'
      };
    case 'vanilla':
    default:
      return {
        bg: 'bg-[#3C8527]',
        border: 'border-[#1E4D13]',
        text: 'text-white',
        label: 'Vanilla'
      };
  }
};

const CardFocusHandler: React.FC<{ focused: boolean; onAction: () => void }> = ({ focused, onAction }) => {
  const actionRef = useRef(onAction);
  useEffect(() => { actionRef.current = onAction; }, [onAction]);

  useInputAction('MENU', useCallback(() => {
    if (focused) {
      actionRef.current();
    }
  }, [focused]));

  return null;
};

export const InstanceCardView: React.FC<InstanceCardViewProps> = ({ instance, onClick, onEdit, tier: propTier }) => {
  const density = useScreenDensity();
  const activeTier = propTier || getTierFromDensity(density);

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

  const loaderConfig = getLoaderBadgeConfig(instance.loader);
  const isCustomLoader = instance.loader && instance.loader.toLowerCase() !== 'vanilla';

  // 📐 依据三个固定尺寸档位配置精确宽高与排版 (符合常规设计规范与易读性)
  const sizeStyles = {
    sm: {
      card: 'w-[288px] h-[254px]',
      cover: 'h-[158px]',
      title: 'text-sm',
      badge: 'text-xs px-2 py-0.5',
      badgeIcon: 'h-3 w-3',
      btn: '!h-8.5 !px-4 text-xs',
      btnIcon: 14,
      headerBtn: 'h-7 w-7',
      headerIcon: 13,
      meta: 'text-xs',
      metaIcon: 13,
      padding: 'p-3',
    },
    md: {
      card: 'w-[336px] h-[286px]',
      cover: 'h-[180px]',
      title: 'text-base',
      badge: 'text-xs px-2.5 py-0.5',
      badgeIcon: 'h-3.5 w-3.5',
      btn: '!h-9 !px-4.5 text-xs',
      btnIcon: 15,
      headerBtn: 'h-8 w-8',
      headerIcon: 15,
      meta: 'text-xs',
      metaIcon: 14,
      padding: 'p-3.5',
    },
    lg: {
      card: 'w-[400px] h-[340px]',
      cover: 'h-[216px]',
      title: 'text-lg',
      badge: 'text-sm px-3 py-1',
      badgeIcon: 'h-4 w-4',
      btn: '!h-11 !px-6 text-sm',
      btnIcon: 18,
      headerBtn: 'h-9 w-9',
      headerIcon: 16,
      meta: 'text-sm',
      metaIcon: 16,
      padding: 'p-4',
    },
  }[activeTier];

  return (
    <>
      <FocusItem focusKey={`card-play-${instance.id}`} onEnter={() => handlePlayClick()}>
        {({ ref, focused, tabIndex }) => {
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

              <OreTooltip
                content={instance.name}
                placement="top"
                align="center"
                visible={showTooltip}
                portal={true}
              >
                <motion.div
                  ref={ref}
                  role="listitem"
                  aria-label={`${instance.name} - Minecraft ${instance.version} ${instance.loader || 'Vanilla'}`}
                  layoutId={`instance-container-${instance.id}`}
                  layout
                  tabIndex={tabIndex}
                  onClick={handlePlayClick}
                  onKeyDown={(e) => {
                    if (e.key.toLowerCase() === 'm' || e.key === 'ContextMenu') {
                      e.stopPropagation();
                      onClick();
                    }
                  }}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  initial="rest"
                  animate={focused ? 'hover' : 'rest'}
                  whileHover="hover"
                  className={`
                    relative flex flex-col flex-none select-none cursor-pointer group
                    border-[2px] border-b-[4px] border-[#1E1E1F] bg-[#3B3C3D]
                    shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]
                    transition-all duration-150
                    active:translate-y-[1px] active:border-b-[2px]
                    ${sizeStyles.card}
                    ${focused ? 'outline outline-[3px] outline-white outline-offset-1 z-20 shadow-[0_0_16px_rgba(255,255,255,0.25)]' : ''}
                  `}
                >
                  {/* ================= 上部：固定尺寸封面与 Badge 徽章区 ================= */}
                  <div className={`relative w-full ${sizeStyles.cover} shrink-0 overflow-hidden bg-[#1E1E1F] border-b-[2px] border-[#1E1E1F]`}>
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
                      <div className="flex h-full w-full items-center justify-center font-minecraft text-xs font-bold uppercase tracking-widest text-[#6C6D70]">
                        {t('instanceCard.noCover', 'NO COVER')}
                      </div>
                    )}

                    {/* 启动中遮罩状态 */}
                    {isLaunching && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 font-minecraft">
                        <Loader2 size={activeTier === 'lg' ? 36 : 28} className="animate-spin text-[#6CC349] mb-1.5" />
                        <span className={`${sizeStyles.title} font-bold uppercase tracking-wider text-[#6CC349] ore-text-shadow`}>
                          {t('instanceCard.launching', '正在启动...')}
                        </span>
                      </div>
                    )}

                    {/* 悬停/聚焦快捷启动按钮 */}
                    {!isLaunching && (
                      <motion.div
                        variants={OreMotionTokens.cardOverlayFade as Variants}
                        className="absolute inset-0 z-20 flex items-center justify-center bg-black/45 pointer-events-none"
                      >
                        <motion.div variants={OreMotionTokens.cardButtonSlide as Variants}>
                          <OreButton
                            variant="primary"
                            size={activeTier === 'lg' ? 'md' : 'sm'}
                            className={`shadow-[0_4px_12px_rgba(0,0,0,0.5)] ${sizeStyles.btn} font-minecraft font-bold`}
                            tabIndex={-1}
                          >
                            <Play size={sizeStyles.btnIcon} fill="currentColor" className="mr-1.5" />
                            {t('home.launchGame', '启动游戏')}
                          </OreButton>
                        </motion.div>
                      </motion.div>
                    )}

                    {/* 左上角：版本号与 Loader 专属品牌高饱和度徽章 */}
                    <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 pointer-events-none font-minecraft">
                      <span className={`border-[2px] border-[#1E1E1F] bg-[#1E2024]/90 ${sizeStyles.badge} font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] ore-text-shadow`}>
                        {instance.version}
                      </span>

                      {isCustomLoader && (
                        <span className={`flex items-center gap-1 border-[2px] border-[#1E1E1F] ${loaderConfig.bg} ${sizeStyles.badge} font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] ore-text-shadow`}>
                          <img
                            src={new URL(`../../../assets/icons/tags/loaders/${instance.loader.toLowerCase()}.svg`, import.meta.url).href}
                            alt={instance.loader}
                            className={`${sizeStyles.badgeIcon} brightness-0 invert`}
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                          <span>{loaderConfig.label}</span>
                        </span>
                      )}
                    </div>

                    {/* 右上角：收藏星标 / 快捷详情 / 手柄提示 */}
                    <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
                      {instance.isFavorite && (
                        <div
                          className={`flex ${sizeStyles.headerBtn} items-center justify-center border-[2px] border-[#1E1E1F] bg-[#1E2024]/90 text-[#FFA940] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`}
                          title="已收藏"
                        >
                          <Star size={sizeStyles.headerIcon} fill="currentColor" />
                        </div>
                      )}

                      {focused && !isLaunching ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#1E2024]/95 px-2 py-0.5 font-minecraft ${sizeStyles.meta} font-bold text-[#FFA940] shadow-md pointer-events-none`}
                        >
                          <Menu size={sizeStyles.headerIcon} strokeWidth={2.5} />
                          <span>{t('instanceCard.details', '详情 (M)')}</span>
                        </motion.div>
                      ) : !isLaunching && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEdit(); }}
                          className={`flex ${sizeStyles.headerBtn} items-center justify-center border-[2px] border-[#1E1E1F] bg-[#1E2024]/90 text-[#D0D1D4] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[#48494A] hover:text-white`}
                          title="编辑实例配置"
                        >
                          <Settings size={sizeStyles.headerIcon} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ================= 下部：主标题与元数据区域 ================= */}
                  <div className={`flex flex-1 flex-col justify-between bg-[#2B2C2D] ${sizeStyles.padding} font-minecraft`}>
                    {/* 实例主标题 */}
                    <motion.span
                      layoutId={`instance-title-${instance.id}`}
                      className={`truncate ${sizeStyles.title} font-bold tracking-wide ore-text-shadow transition-colors duration-150 ${
                        focused ? 'text-[#FFA940]' : 'text-white'
                      }`}
                    >
                      {instance.name}
                    </motion.span>

                    {/* 副信息：游玩时长与最后游玩时间 */}
                    <div className={`flex items-center justify-between ${sizeStyles.meta} text-[#A0A1A4] pt-1.5 border-t-[1px] border-white/5`}>
                      <div className="flex items-center gap-1.5 truncate">
                        <Clock size={sizeStyles.metaIcon} className="shrink-0 text-[#8CB3FF]" />
                        <span className="truncate">
                          {instance.playTime > 0
                            ? formatPlayTime(instance.playTime, t)
                            : t('home.neverPlayed', { defaultValue: '0h' })}
                        </span>
                      </div>

                      {instance.lastPlayed && (
                        <div className="flex items-center gap-1 shrink-0 text-[#D0D1D4]">
                          <Calendar size={sizeStyles.metaIcon} className="shrink-0 text-[#A0A1A4]" />
                          <span>{formatRelativeTime(instance.lastPlayed, t)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              </OreTooltip>
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

export default InstanceCardView;
