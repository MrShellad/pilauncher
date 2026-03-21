// /src/features/InstanceDetail/components/tabs/OverviewPanel.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, Play, ImagePlus, Clock, Calendar } from 'lucide-react';
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
    <div className="w-full h-full flex flex-col overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#1E1E1F] relative">

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

            {/* 底部渐变遮罩 */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#2A2A2C] via-transparent to-transparent opacity-80 pointer-events-none" />

            {/* ====================================================
                HeroLogo 编辑区 — 悬浮在 Banner 左下角
                仿 Steam 游戏封面编辑风格：Logo 图 + 悬浮时显示编辑提示
                ==================================================== */}
            <div
              className={`
                absolute bottom-4 left-6
                w-[500px] h-[100px]
                flex items-center justify-center
                cursor-pointer select-none
                rounded-sm overflow-hidden
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
                /* 无 Logo 时的占位框 */
                <div
                  className={`
                    w-full h-full border-2 border-dashed rounded-sm
                    flex flex-col items-center justify-center gap-1
                    transition-all duration-200
                    ${logoHovered
                      ? 'border-white/70 bg-black/50'
                      : 'border-white/20 bg-black/30'
                    }
                  `}
                >
                  <ImagePlus
                    size={20}
                    className={`transition-colors duration-200 ${logoHovered ? 'text-white' : 'text-white/40'}`}
                  />
                  <span className={`text-xs font-minecraft transition-colors duration-200 ${logoHovered ? 'text-white' : 'text-white/40'}`}>
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
                      <ImagePlus size={20} className="text-white drop-shadow" />
                      <span className="text-xs font-minecraft text-white drop-shadow">更换 Logo</span>
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
          仿 Steam 风格：开始游戏按钮在左侧，右侧是时间信息
          ========================================== */}
      <div className="flex items-center justify-between px-6 md:px-12 py-4 bg-[#2A2A2C] border-b-[3px] border-[#18181B] flex-shrink-0 z-10 shadow-sm relative">

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
          <h1 className="text-xl md:text-2xl text-white font-minecraft ore-text-shadow truncate max-w-[420px]">
            {data.name}
          </h1>
          <div className="flex items-center gap-4 mt-1">
            {data.playTime && (
              <div className="flex items-center gap-1 text-gray-400 text-xs font-minecraft">
                <Clock size={12} />
                <span>{data.playTime}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-gray-400 text-xs font-minecraft">
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
          详情统计卡片区域（说明面板）
          ========================================== */}
      <div className="flex-1 p-6 md:p-8">
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
          <SettingsSection title="说明">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">游戏版本</div>
                <div className="text-white text-lg font-bold">{data.version}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">加载器</div>
                <div className="text-ore-green text-lg font-bold capitalize">{data.loader}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">游戏时长</div>
                <div className="text-white text-lg font-bold">{data.playTime || '0 小时'}</div>
              </div>
              <div className="bg-[#18181B] border-2 border-[#2A2A2C] p-4 rounded-sm shadow-inner">
                <div className="text-gray-500 text-xs font-minecraft mb-1">最后游玩</div>
                <div className="text-white text-lg font-bold truncate">{data.lastPlayed || '从未'}</div>
              </div>
            </div>
          </SettingsSection>
        </div>
      </div>

      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />
    </div>
  );
};