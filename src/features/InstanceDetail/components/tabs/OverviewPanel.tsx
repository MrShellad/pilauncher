// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Play, ImagePlus, Clock, Calendar } from 'lucide-react';
import { getButtonIcon, getButtonLabel } from '../../../../ui/icons/SocialIcons';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { SettingsSection } from '../../../../ui/layout/SettingsSection';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import type { InstanceDetailData } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';
import { useGameLaunch } from '../../../../hooks/useGameLaunch';
import { useAccountStore } from '../../../../store/useAccountStore';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { NoAccountModal } from '../../../../ui/components/NoAccountModal';
import defaultCoverUrl from '../../../../assets/instances/default-3.png';

interface OverviewPanelProps {
  data: InstanceDetailData;
  currentImageIndex: number;
  /** 当前实例自定义 HeroLogo 的 asset:// URL，null 表示无 */
  heroLogoUrl?: string | null;
  onOpenFolder?: () => void;
  /** 触发选图 -> 更新 herologo */
  onUpdateHeroLogo?: () => Promise<void>;
}

export const OverviewPanel: React.FC<OverviewPanelProps> = ({
  data,
  currentImageIndex,
  heroLogoUrl,
  onOpenFolder,
  onUpdateHeroLogo,
}) => {
  const [logoHovered, setLogoHovered] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);

  const { isLaunching, launchGame } = useGameLaunch();
  const inputMode = useInputMode();

  const fallbackImages = [defaultCoverUrl];
  const imagesToShow = data.screenshots && data.screenshots.length > 0 ? data.screenshots : fallbackImages;
  const currentImage = imagesToShow[currentImageIndex % imagesToShow.length] || data.coverUrl;

  const handlePlayClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find(a => a.uuid === activeAccountId);

    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    launchGame(data.id, inputMode === 'controller', e);
  };

  const handleLogoClick = async () => {
    if (!onUpdateHeroLogo || logoLoading) return;
    try {
      setLogoLoading(true);
      await onUpdateHeroLogo();
    } catch {
      // 用户取消或报错，静默处理
    } finally {
      setLogoLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-ore-gray-border relative">

      {/* ==========================================
          Banner 区域（截图/封面轮播）
          ========================================== */}
      <FocusItem focusKey="overview-guard-top" onFocus={() => setFocus('overview-btn-folder')}>
        {({ ref }) => (
          <div ref={ref as any} className="relative w-full h-[280px] bg-black overflow-hidden flex-shrink-0 outline-none">
            <AnimatePresence initial={false}>
              <motion.img
                key={currentImage}
                src={currentImage}
                alt="Hero Banner"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeInOut' }}
                className="absolute inset-0 w-full h-full object-cover"
              />
            </AnimatePresence>

            {/* 底部渐变遮罩 — 使用令牌色值 */}
            <div className="absolute inset-0 bg-gradient-to-t from-ore-nav-active via-transparent to-transparent opacity-80 pointer-events-none" />

            {/* ====================================================
                HeroLogo 编辑区 — 悬浮在 Banner 左下角
                ==================================================== */}
            <div
              className={`
                absolute bottom-4 left-6
                w-[500px] h-[100px]
                flex items-center justify-center
                cursor-pointer select-none
                overflow-hidden
                transition-all duration-200
                group
                ${logoLoading ? 'opacity-60 pointer-events-none' : ''}
              `}
              onClick={handleLogoClick}
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
              title="点击更换 Hero Logo"
            >
              {/* Logo 本体 */}
              {heroLogoUrl ? (
                <img
                  src={heroLogoUrl}
                  alt="Hero Logo"
                  className="w-full h-full object-contain drop-shadow-2xl transition-all duration-200"
                  style={{ filter: logoHovered ? 'brightness(0.5)' : 'brightness(1)' }}
                />
              ) : (
                /* 无 Logo 时的占位框 — 遵循 OreUI 虚线边框 */
                <div
                  className={`
                    w-full h-full border-2 border-dashed
                    flex flex-col items-center justify-center gap-1
                    transition-all duration-200
                    ${logoHovered
                      ? 'border-white/60 bg-black/50'
                      : 'border-white/20 bg-black/25'
                    }
                  `}
                >
                  <ImagePlus
                    size={20}
                    className={`transition-colors duration-200 ${logoHovered ? 'text-ore-text' : 'text-ore-text-muted opacity-50'}`}
                  />
                  <span className={`text-xs font-minecraft transition-colors duration-200 ${logoHovered ? 'text-ore-text' : 'text-ore-text-muted opacity-50'}`}>
                    添加 Hero Logo
                  </span>
                </div>
              )}

              {/* 悬浮时 Logo 已有图时，叠加半透明编辑提示 */}
              {heroLogoUrl && (
                <AnimatePresence>
                  {logoHovered && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-1 pointer-events-none"
                    >
                      <ImagePlus size={20} className="text-ore-text drop-shadow" />
                      <span className="text-xs font-minecraft text-ore-text drop-shadow">更换 Logo</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </div>
        )}
      </FocusItem>

      {/* ==========================================
          操作栏：实例名 + 开始游戏按钮 + 最后游玩日期
          ========================================== */}
      <div className="flex items-center justify-between px-6 md:px-12 py-4 bg-ore-nav-active border-b-2 border-ore-gray-border flex-shrink-0 z-10 relative"
        style={{ boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.06)' }}
      >

        {/* 左侧越界保护 */}
        <FocusItem focusKey="overview-guard-left" onFocus={() => setFocus('overview-btn-folder')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 -left-[100px] w-[100px] h-full outline-none pointer-events-none" tabIndex={-1} />}
        </FocusItem>

        {/* 左侧：开始游戏 + 实例目录 */}
        <div className="flex items-center space-x-3">
          <OreButton
            focusKey="overview-btn-play"
            variant="primary"
            size="lg"
            onClick={handlePlayClick}
            className="min-w-[140px] flex items-center gap-2"
          >
            <Play size={16} fill="currentColor" />
            {isLaunching ? '启动中...' : '开始游戏'}
          </OreButton>

          <OreButton
            focusKey="overview-btn-folder"
            variant="secondary"
            size="lg"
            onClick={onOpenFolder || (() => alert('需要传入 onOpenFolder 才能打开目录'))}
          >
            <FolderOpen size={18} className="mr-2" /> 实例目录
          </OreButton>
        </div>

        {/* 右侧：实例名 + 最后游玩日期 */}
        <div className="flex flex-col items-end overflow-hidden pl-4">
          <h1 className="text-xl md:text-2xl text-ore-text font-minecraft ore-text-shadow truncate max-w-[420px]">
            {data.name}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            {data.playTime && (
              <div className="flex items-center gap-1 text-ore-text-muted text-xs font-minecraft">
                <Clock size={12} />
                <span>{data.playTime}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-ore-text-muted text-xs font-minecraft">
              <Calendar size={12} />
              <span>{data.lastPlayed || '从未游玩'}</span>
            </div>
          </div>
        </div>

        {/* 右侧越界保护 */}
        <FocusItem focusKey="overview-guard-right" onFocus={() => setFocus('overview-btn-play')}>
          {({ ref }) => <div ref={ref as any} className="absolute top-0 -right-[100px] w-[100px] h-full outline-none pointer-events-none" tabIndex={-1} />}
        </FocusItem>
      </div>

      {/* ==========================================
          内容区
          ========================================== */}
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">

          {/* 自定义链接管理 */}
          {data.customButtons && data.customButtons.length > 0 && (
            <SettingsSection title="自定义链接">
              {/* ─── OreUI link-block 网格 ─────────────────────────── */}
              <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                {data.customButtons.map((btn, idx) => {
                  const IconComp = getButtonIcon(btn.type);
                  const displayLabel = btn.label || getButtonLabel(btn.type);
                  return (
                    <OreLinkBlock
                      key={idx}
                      icon={<IconComp size={22} />}
                      label={displayLabel}
                      onClick={() => window.open(btn.url, '_blank')}
                    />
                  );
                })}
              </div>
            </SettingsSection>
          )}

        </div>
      </div>

      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />
    </div>
  );
};

/* ============================================================
   OreLinkBlock — 遵循 ore-ui.css link-block 规范的链接卡片
   特性：
   · 2px 实色边框(#58585A) + 悬浮变亮(#6D6D6E)
   · 内高光 box-shadow（3D 浮雕感）
   · 悬浮时扫光动画（模拟 link-block::before/after 闪光）
   · 完全无圆角（像素风格）
   ============================================================ */
interface OreLinkBlockProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}

const OreLinkBlock: React.FC<OreLinkBlockProps> = ({ icon, label, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="relative flex flex-col items-center justify-center gap-2 py-5 px-3 cursor-pointer overflow-hidden select-none outline-none transition-colors duration-150"
      style={{
        /* 边框：正常 #58585A，悬浮 #6D6D6E */
        border: `2px solid ${hovered ? '#6D6D6E' : '#58585A'}`,
        backgroundColor: hovered ? '#58585A' : '#48494A',
        /* 内高光：顶左亮光 + 底右阴影，营造 3D 浮雕感 */
        boxShadow: hovered
          ? 'inset 2px 2px rgba(255,255,255,0.15), inset -2px -2px rgba(0,0,0,0.2)'
          : 'inset 2px 2px rgba(255,255,255,0.08), inset -2px -2px rgba(0,0,0,0.15)',
      }}
    >
      {/* 扫光动画层 — 模拟 ore-ui.css link-block::before 闪光 */}
      <AnimatePresence>
        {hovered && (
          <>
            <motion.span
              key="thick-flash"
              initial={{ left: '-150%' }}
              animate={{ left: '150%' }}
              exit={{ left: '150%' }}
              transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
              className="absolute top-0 h-full pointer-events-none z-10"
              style={{
                width: '15px',
                background: 'rgba(255,255,255,0.5)',
                transform: 'skewX(-45deg)',
              }}
            />
            <motion.span
              key="thin-flash"
              initial={{ left: '-150%' }}
              animate={{ left: '150%' }}
              exit={{ left: '150%' }}
              transition={{ duration: 0.55, delay: 0.01, ease: [0.4, 0, 0.2, 1] }}
              className="absolute top-0 h-full pointer-events-none z-[9]"
              style={{
                width: '6px',
                background: 'rgba(255,255,255,0.4)',
                transform: 'skewX(-45deg)',
              }}
            />
          </>
        )}
      </AnimatePresence>

      {/* 图标 */}
      <span
        className="flex-shrink-0 transition-colors duration-150 relative z-20"
        style={{ color: hovered ? '#FFFFFF' : '#B1B2B5' }}
      >
        {icon}
      </span>

      {/* 标签文字 */}
      <span
        className="font-minecraft text-sm truncate w-full text-center leading-tight relative z-20 ore-text-shadow transition-colors duration-150"
        style={{ color: hovered ? '#FFFFFF' : '#D0D1D4' }}
      >
        {label}
      </span>
    </div>
  );
};