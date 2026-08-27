import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  DownloadCloud,
  Filter,
  FolderInput,
  FolderOpen,
  History,
  MoreHorizontal,
  RefreshCw,
  Search,
  Wand2,
  X
} from 'lucide-react';

import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../../ui/primitives/OreInput';
import {
  MOD_LIST_HEADER_CLASSES,
  type ModListStats,
  type ModListTheme,
  type ModQuickFilter,
  type ModQuickFilterOption
} from '../../modListShared';

export interface ModListHeaderProps {
  stats: ModListStats;
  isBatchMode?: boolean;
  searchQuery: string;
  searchPlaceholder: string;
  quickFilter: ModQuickFilter;
  filterOptions: ModQuickFilterOption[];
  onHeaderArrowPress: (direction: string) => boolean;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onBatchEnable?: () => void;
  onBatchDisable?: () => void;
  onBatchDelete?: () => void;
  onBatchFavorite?: () => void;
  onExitBatchMode?: () => void;
  onOpenModMetadataSettings?: () => void;
  onReidentifyAllMods?: () => void | Promise<void>;
  isReidentifyingAll?: boolean;
  onCheckModUpdates: () => void;
  isCheckingModUpdates: boolean;
  isUpdatingAny?: boolean;
  onUpdateAllMods?: () => void;
  onQuickFilterChange: (filter: ModQuickFilter) => void;
  listTheme: ModListTheme;
  onThemeChange?: (theme: ModListTheme) => void;
  // Top bar props (merged from ModPanelTopBar)
  isTopBarCollapsed?: boolean;
  snapshotState?: 'idle' | 'snapshotting' | 'rolling_back';
  snapshotProgressPhase?: string | null;
  onCreateSnapshot?: () => void | Promise<void>;
  onOpenHistory: () => void | Promise<void>;
  onOpenModFolder: () => void | Promise<void>;
  onAnalyzeCleanup: () => void;
  onOpenDownload: () => void;
  onTopBarCollapseChange?: (collapsed: boolean) => void;
}

const getFilterIcon = (filter: ModQuickFilter) => {
  if (filter === 'enabled') return <CheckCircle2 size={13} />;
  if (filter === 'disabled') return <CircleOff size={13} />;
  if (filter === 'updates') return <ArrowUpCircle size={13} />;
  if ((filter as string) === 'external') return <FolderInput size={13} />;
  return <Filter size={13} />;
};

export const ModListHeader: React.FC<ModListHeaderProps> = ({
  stats,
  searchQuery,
  searchPlaceholder,
  quickFilter,
  filterOptions,
  onHeaderArrowPress,
  onSearchQueryChange,
  onClearSearch,
  onOpenModMetadataSettings,
  onReidentifyAllMods,
  isReidentifyingAll,
  onCheckModUpdates,
  isCheckingModUpdates,
  isUpdatingAny,
  onUpdateAllMods,
  onQuickFilterChange,
  listTheme,
  onOpenHistory,
  onOpenModFolder,
  onAnalyzeCleanup,
  onOpenDownload
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMoreMenuOpen]);

  const isLightTheme = listTheme === 'light';
  const toolbarClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#D0D1D4] text-[#111214] shadow-[inset_0_-0.25rem_0_#A9ABAE,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.74)]'
    : 'border-[2px] border-[#1E1E1F] bg-[#161A22] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
  const filterActiveClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#90A6D6] text-[#111214] shadow-[inset_0_-0.1875rem_0_#61749C,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.66)]'
    : 'border-[2px] border-[#1E1E1F] bg-[#17345F] text-[#F3F6FC] shadow-[inset_0_-2px_0_#0D203C]';
  const filterInactiveClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#DDE0E3] text-[#313233] hover:bg-[#F2F2F2] hover:text-[#111214] shadow-[inset_0_-2px_0_#A9ABAE]'
    : 'border-[2px] border-[#1E1E1F] bg-[#171B23] text-[#8B93A7] hover:border-[#313A4D] hover:bg-[#232937] hover:text-[#DCE3F1] shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)]';

  return (
    <section className={`mx-2 mb-1.5 border-[2px] p-2 ${toolbarClass}`} aria-label="模组操作工具栏">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* 左侧：快速筛选 + 搜索框 */}
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {/* 快速筛选按钮组 */}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="模组筛选">
            {filterOptions.map((option) => {
              const isActive = option.id === quickFilter;
              return (
                <button
                  key={option.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onQuickFilterChange(option.id)}
                  className={`inline-flex h-9 items-center gap-1.5 border-[2px] px-2.5 font-minecraft text-[11px] font-bold uppercase transition-colors ${isActive ? filterActiveClass : filterInactiveClass}`}
                >
                  {getFilterIcon(option.id)}
                  <span>{option.label}</span>
                  <span className="font-minecraft text-[10px] font-bold opacity-75">{option.count}</span>
                </button>
              );
            })}
          </div>

          {/* 搜索栏 */}
          <div className="flex min-w-[12rem] max-w-sm flex-1 items-center gap-1">
            <OreInput
              focusKey="mod-search-input"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange(event.target.value)}
              onArrowPress={onHeaderArrowPress}
              placeholder={searchPlaceholder}
              height="36px"
              containerClassName={`min-w-0 flex-1 ${isLightTheme ? '[&.ring-white]:!ring-[#1D4D13]' : ''}`}
              className={isLightTheme
                ? '!border-[#1E1E1F] !bg-[#F2F2F2] !text-[#111214] placeholder:!text-[#60636A] hover:!bg-white focus:!border-[#1E1E1F] active:!bg-[#E4E5E7] font-minecraft text-[12px]'
                : 'font-minecraft text-[12px]'
              }
              prefixNode={<Search size={14} className={isLightTheme ? 'text-[#313233]' : undefined} />}
            />
            {searchQuery && (
              <OreButton
                focusKey="mod-search-clear"
                variant="secondary"
                size="auto"
                onClick={onClearSearch}
                onArrowPress={onHeaderArrowPress}
                className={`${MOD_LIST_HEADER_CLASSES.oreButton} !min-w-8 !px-2`}
                title="清空搜索"
              >
                <X size={13} />
              </OreButton>
            )}
          </div>
        </div>

        {/* 右侧操作按钮组：文件夹、更多(历史/清理/重新拉取)、检查更新、一键更新、下载 MOD */}
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          <OreButton
            focusKey="mod-btn-folder"
            variant="secondary"
            size="auto"
            onClick={onOpenModFolder}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
          >
            <FolderOpen size={13} className="mr-1.5" />
            文件夹
          </OreButton>

          {/* 二级菜单：历史快照、清理名称、重新拉取 */}
          <div className="relative" ref={moreMenuRef}>
            <OreButton
              focusKey="mod-btn-more-menu"
              variant="secondary"
              size="auto"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              onArrowPress={onHeaderArrowPress}
              className={MOD_LIST_HEADER_CLASSES.oreButton}
              title="更多操作"
            >
              <MoreHorizontal size={13} className="mr-1.5" />
              更多
              <ChevronDown size={12} className={`ml-1 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </OreButton>

            <AnimatePresence>
              {isMoreMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.95, y: -4 }}
                  animate={{ opacity: 1, scaleY: 1, y: 0 }}
                  exit={{ opacity: 0, scaleY: 0.95, y: -4, transition: { duration: 0.1 } }}
                  className={`absolute right-0 top-full z-50 mt-1.5 min-w-[10.5rem] border-[2px] border-[#1E1E1F] p-1 shadow-[0_8px_20px_rgba(0,0,0,0.45)] ${
                    isLightTheme
                      ? 'bg-[#DDE0E3] shadow-[inset_1px_1px_0_rgba(255,255,255,0.7)]'
                      : 'bg-[#232937] shadow-[inset_1px_1px_0_rgba(255,255,255,0.06)]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenHistory();
                    }}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 font-minecraft text-xs font-bold transition-colors ${
                      isLightTheme
                        ? 'text-[#111214] hover:bg-[#F2F2F2]'
                        : 'text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white'
                    }`}
                  >
                    <History size={14} className="text-[#7AA2FF]" />
                    历史快照
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onAnalyzeCleanup();
                    }}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 font-minecraft text-xs font-bold transition-colors ${
                      isLightTheme
                        ? 'text-[#111214] hover:bg-[#F2F2F2]'
                        : 'text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white'
                    }`}
                  >
                    <Wand2 size={14} className="text-[#E5B54E]" />
                    清理名称
                  </button>

                  <button
                    type="button"
                    disabled={isReidentifyingAll}
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      (onReidentifyAllMods || onOpenModMetadataSettings)?.();
                    }}
                    className={`flex w-full items-center gap-2 px-2.5 py-1.5 font-minecraft text-xs font-bold transition-colors ${
                      isLightTheme
                        ? 'text-[#111214] hover:bg-[#F2F2F2]'
                        : 'text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white'
                    } ${isReidentifyingAll ? 'opacity-50' : ''}`}
                  >
                    <RefreshCw size={14} className={`text-ore-green ${isReidentifyingAll ? 'animate-spin' : ''}`} />
                    重新拉取
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 检查更新 (位于 下载 MOD 左侧) */}
          <OreButton
            focusKey="mod-btn-check-updates"
            variant="purple"
            size="auto"
            disabled={isCheckingModUpdates || isUpdatingAny}
            onClick={onCheckModUpdates}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
          >
            <RefreshCw size={13} className={`mr-1.5 ${isCheckingModUpdates ? 'animate-spin' : ''}`} />
            {isCheckingModUpdates ? '检查中...' : '检查更新'}
          </OreButton>

          {stats.updates > 0 && (
            <OreButton
              focusKey="mod-btn-update-all"
              variant="primary"
              size="auto"
              disabled={isCheckingModUpdates || isUpdatingAny}
              onClick={onUpdateAllMods}
              onArrowPress={onHeaderArrowPress}
              className={MOD_LIST_HEADER_CLASSES.oreButton}
            >
              <ArrowUpCircle size={13} className="mr-1.5" />
              一键更新 ({stats.updates})
            </OreButton>
          )}

          {/* 下载 MOD */}
          <OreButton
            focusKey="mod-btn-download"
            variant="primary"
            size="auto"
            onClick={onOpenDownload}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
          >
            <DownloadCloud size={13} className="mr-1.5" />
            下载 MOD
          </OreButton>
        </div>
      </div>
    </section>
  );
};
