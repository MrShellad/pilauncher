// /src/features/InstanceDetail/components/sidebar/InstanceHeroSidebar.tsx
import React, { useState } from 'react';
import { Play, FolderOpen, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { useGameLaunch } from '../../../../hooks/useGameLaunch';
import { useAccountStore } from '../../../../store/useAccountStore';
import { useInputMode } from '../../../../ui/focus/FocusProvider';
import { NoAccountModal } from '../../../../ui/components/NoAccountModal';
import type { InstanceDetailData, DetailTab } from '../../../../hooks/pages/InstanceDetail/useInstanceDetail';
import defaultCoverUrl from '../../../../assets/instances/default-3.png';

interface InstanceHeroSidebarProps {
  data: InstanceDetailData;
  activeTab: DetailTab;
  onSelectTab: (tab: DetailTab) => void;
  onOpenFolder?: () => void;
  tabs: { id: DetailTab; label: string; icon: LucideIcon }[];
}

export const InstanceHeroSidebar: React.FC<InstanceHeroSidebarProps> = ({
  data,
  activeTab,
  onSelectTab,
  onOpenFolder,
  tabs,
}) => {
  const { t } = useTranslation();
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);

  const { isLaunching, launchGame } = useGameLaunch();
  const inputMode = useInputMode();

  const coverImage = data.coverUrl || defaultCoverUrl;
  const versionString = data.version || data.description?.match(/1\.\d+\.\d+/)?.[0] || '1.20.1';
  const loaderString = data.loader || 'Vanilla';

  const handlePlayClick = (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation();
    const { accounts, activeAccountId } = useAccountStore.getState();
    const currentAccount = accounts.find((a) => a.uuid === activeAccountId);

    if (!currentAccount) {
      setShowNoAccountModal(true);
      return;
    }

    launchGame(data.id, inputMode === 'controller', e);
  };

  return (
    <>
      <aside className="flex h-full w-full flex-col border-r-[2px] border-[#1E1E1F] bg-[#313233] p-3 select-none overflow-y-auto custom-scrollbar shadow-[inset_-2px_0_rgba(0,0,0,0.3)]">
        {/* =========================================================================
            1. 实例形象卡片 (Hero Card 16:9 + 实例名称置于封面底部)
            ========================================================================= */}
        <div className="relative mb-2.5 w-full aspect-video flex-shrink-0 overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141415] shadow-[inset_0_2px_rgba(255,255,255,0.1),inset_0_-2px_rgba(0,0,0,0.6)]">
          <img
            src={coverImage}
            alt={data.name}
            className="h-full w-full object-cover"
          />

          {/* 顶部/右上角 Loader & Version 徽章 */}
          <div className="absolute right-1.5 top-1.5 flex items-center gap-1 border-[1px] border-[#1E1E1F] bg-[#1E1E1F]/90 px-1.5 py-0.5 font-minecraft text-[10px] font-bold text-white shadow-sm">
            <span className="text-[#3C8527] uppercase">{loaderString}</span>
            <span className="text-[#D0D1D4]">{versionString}</span>
          </div>

          {/* 底部遮罩渐变与实例名称 */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-[#101010]/95 via-[#101010]/70 to-transparent px-2.5 pt-6 pb-2">
            <h2
              className="font-minecraft text-sm lg:text-[15px] font-bold text-white tracking-wide truncate ore-text-shadow leading-snug"
              title={data.name}
            >
              {data.name}
            </h2>
          </div>
        </div>

        {/* =========================================================================
            2. 全局启动与快捷操作动作区 (强化高度与水平/垂直视觉居中)
            ========================================================================= */}
        <div className="mb-3 flex flex-col gap-2.5 flex-shrink-0">
          {/* PLAY 主启动按钮 */}
          <FocusItem
            focusKey="sidebar-btn-play"
            onEnter={handlePlayClick}
          >
            {({ ref, focused, tabIndex }) => (
              <button
                ref={ref as any}
                type="button"
                tabIndex={tabIndex}
                onClick={handlePlayClick}
                disabled={isLaunching}
                className={`relative flex h-[54px] w-full items-center justify-center border-[2px] border-[#1E1E1F] bg-[#3C8527] px-4 pb-1 transition-none cursor-pointer outline-none shadow-[inset_0_-4px_#1D4D13,inset_2px_2px_rgba(255,255,255,0.3),inset_-2px_-6px_rgba(255,255,255,0.2)] hover:bg-[#4A9E2D] active:bg-[#255517] active:pt-1 active:pb-0 active:shadow-[inset_2px_2px_rgba(0,0,0,0.4)] ${
                  focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''
                } ${isLaunching ? 'opacity-80 cursor-wait' : ''}`}
              >
                <div className="flex items-center justify-center gap-2.5">
                  <Play size={20} className="fill-white shrink-0" />
                  <span className="font-minecraft text-base font-bold uppercase tracking-normal text-white ore-text-shadow leading-none">
                    {isLaunching
                      ? t('instanceDetail.launching', '启动中...')
                      : t('instanceDetail.play', '启动游戏')}
                  </span>
                </div>
              </button>
            )}
          </FocusItem>

          {/* 打开目录按钮 */}
          {onOpenFolder && (
            <FocusItem
              focusKey="sidebar-btn-open-folder"
              onEnter={onOpenFolder}
            >
              {({ ref, focused, tabIndex }) => (
                <button
                  ref={ref as any}
                  type="button"
                  tabIndex={tabIndex}
                  onClick={onOpenFolder}
                  className={`relative flex h-[46px] w-full items-center justify-center border-[2px] border-[#1E1E1F] bg-[#D0D1D4] px-4 pb-1 transition-none cursor-pointer outline-none shadow-[inset_0_-4px_#58585A,inset_2px_2px_rgba(255,255,255,0.6),inset_-2px_-6px_rgba(255,255,255,0.4)] hover:bg-white active:bg-[#8C8D90] active:pt-1 active:pb-0 active:shadow-[inset_2px_2px_rgba(0,0,0,0.3)] ${
                    focused ? 'outline outline-2 outline-white outline-offset-1 z-10' : ''
                  }`}
                >
                  <div className="flex items-center justify-center gap-2.5">
                    <FolderOpen size={18} className="text-black shrink-0" />
                    <span className="font-minecraft text-sm font-bold uppercase tracking-normal text-black leading-none">
                      {t('instanceDetail.openFolder', '打开实例目录')}
                    </span>
                  </div>
                </button>
              )}
            </FocusItem>
          )}
        </div>

        {/* =========================================================================
            3. 垂直功能导航树 (像素对齐优化: 实体框体内嵌 + 方形图标槽 + 紧凑对齐)
            ========================================================================= */}
        <nav
          className="flex flex-1 flex-col min-h-0 w-full border-[2px] border-[#1E1E1F] bg-[#242425] shadow-[inset_0_2px_rgba(0,0,0,0.3)] divide-y-[2px] divide-[#1E1E1F] overflow-hidden"
          aria-label="实例配置导航"
        >
          {tabs.map((tab) => {
            const isCurrent = activeTab === tab.id;
            const Icon = tab.icon;

            const iconColors: Record<string, string> = {
              basic: '#C8995C', // 齿轮/常规 棕褐
              java: '#58B2DC', // 咖啡/Java 蓝青
              mods: '#67B346', // 方块/MOD 亮绿
              resourcepacks: '#E0A33A', // 箱子/资源包 矿石黄
              shaders: '#4EB8DE', // 图像/光影 青蓝
              saves: '#5EBA46', // 文件夹/存档 鲜绿
              export: '#E8B834', // 下载/导出 金黄
            };

            return (
              <FocusItem
                key={tab.id}
                focusKey={`sidebar-tab-${tab.id}`}
                onEnter={() => onSelectTab(tab.id)}
              >
                {({ ref, focused, tabIndex }) => (
                  <button
                    ref={ref as any}
                    type="button"
                    tabIndex={tabIndex}
                    onClick={() => onSelectTab(tab.id)}
                    className={`relative flex h-[46px] w-full items-center gap-3 px-3 font-minecraft text-xs lg:text-[13px] font-bold tracking-wide text-left transition-none cursor-pointer outline-none select-none ${
                      isCurrent
                        ? 'bg-[#48494A] text-white shadow-[inset_3px_0_0_#3C8527,inset_0_1px_0_rgba(255,255,255,0.15),inset_0_-1px_0_rgba(0,0,0,0.25)]'
                        : 'bg-[#2B2B2C] text-[#C6C6C8] hover:bg-[#38383A] hover:text-white'
                    } ${
                      focused ? 'outline outline-2 outline-white outline-offset-[-2px] z-10' : ''
                    }`}
                  >
                    {/* 像素化深色图标盒体 */}
                    <div className="flex h-[28px] w-[28px] items-center justify-center border-[2px] border-[#1E1E1F] bg-[#18181A] shadow-[inset_1px_1px_rgba(255,255,255,0.08)] flex-shrink-0">
                      <Icon
                        size={15}
                        style={{ color: iconColors[tab.id] || '#FFFFFF' }}
                      />
                    </div>

                    <span className="truncate flex-1 ore-text-shadow">
                      {t(`instanceDetail.tabs.${tab.id}`, tab.label)}
                    </span>
                  </button>
                )}
              </FocusItem>
            );
          })}
        </nav>
      </aside>

      <NoAccountModal
        isOpen={showNoAccountModal}
        onClose={() => setShowNoAccountModal(false)}
      />
    </>
  );
};
