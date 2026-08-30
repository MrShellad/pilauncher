import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  CircleOff,
  DownloadCloud,
  FolderInput,
  FolderOpen,
  History,
  Layers,
  MoreHorizontal,
  RefreshCw,
  Search,
  Wand2,
  X
} from 'lucide-react';

import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../../ui/primitives/OreInput';
import { OreSegmentedControl, type TabItem } from '../../../../../../../ui/primitives/OreSegmentedControl';
import {
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
  return <Layers size={13} />;
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

  const filterTabs: TabItem[] = filterOptions.map((opt) => ({
    id: opt.id,
    label: `${opt.label} (${opt.count})`,
    icon: getFilterIcon(opt.id)
  }));

  return (
    <header className="mx-2 mb-2 flex flex-col gap-2 select-none border-[2px] border-[#1E1E1F] bg-[#2A2B2C] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-2px_0_rgba(0,0,0,0.35)]" aria-label="模组操作工具栏">
      {/* 顶部主操作栏：左侧快速筛选分类 + 右侧功能按钮组 (高度严格锁定 36px) */}
      <div className="flex items-center justify-between gap-3">
        {/* 左侧：精简分段控件 (与按钮等高 36px) */}
        <div className="flex items-center min-w-0">
          <OreSegmentedControl
            tabs={filterTabs}
            activeTab={quickFilter}
            onChange={(id) => onQuickFilterChange(id as ModQuickFilter)}
            focusKeyPrefix="mod-filter-tab"
            onArrowPress={onHeaderArrowPress}
            style={{
              '--seg-height': '2.25rem',
              '--seg-min-width': '0px',
              '--seg-px': '0.875rem',
              '--seg-font-size': '0.8125rem'
            } as any}
          />
        </div>

        {/* 右侧：高度对齐的操作按钮组 */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          {/* 文件夹 */}
          <OreButton
            focusKey="mod-btn-folder"
            variant="secondary"
            size="sm"
            onClick={onOpenModFolder}
            onArrowPress={onHeaderArrowPress}
            className="!h-9 !min-h-9"
          >
            <FolderOpen size={14} className="mr-1.5" />
            文件夹
          </OreButton>

          {/* 更多菜单 (历史快照、清理名称、重新识别) */}
          <div className="relative" ref={moreMenuRef}>
            <OreButton
              focusKey="mod-btn-more-menu"
              variant="secondary"
              size="sm"
              onClick={() => setIsMoreMenuOpen((prev) => !prev)}
              onArrowPress={onHeaderArrowPress}
              className="!h-9 !min-h-9"
            >
              <MoreHorizontal size={14} className="mr-1.5" />
              更多
              <ChevronDown size={12} className={`ml-1 transition-transform ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </OreButton>

            <AnimatePresence>
              {isMoreMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, scaleY: 0.95, y: -4 }}
                  animate={{ opacity: 1, scaleY: 1, y: 0 }}
                  exit={{ opacity: 0, scaleY: 0.95, y: -4, transition: { duration: 0.1 } }}
                  className="absolute right-0 top-full z-50 mt-1.5 min-w-[11rem] border-[2px] border-[#1E1E1F] bg-[#232937] p-1 shadow-[0_8px_20px_rgba(0,0,0,0.55),inset_1px_1px_0_rgba(255,255,255,0.06)]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      onOpenHistory();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 font-minecraft text-xs font-bold text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white transition-colors"
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
                    className="flex w-full items-center gap-2.5 px-3 py-2 font-minecraft text-xs font-bold text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white transition-colors"
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
                    className={`flex w-full items-center gap-2.5 px-3 py-2 font-minecraft text-xs font-bold text-[#C7D2E6] hover:bg-[#2B3447] hover:text-white transition-colors ${
                      isReidentifyingAll ? 'opacity-50' : ''
                    }`}
                  >
                    <RefreshCw size={14} className={`text-ore-green ${isReidentifyingAll ? 'animate-spin' : ''}`} />
                    重新识别
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 检查更新 */}
          <OreButton
            focusKey="mod-btn-check-updates"
            variant="purple"
            size="sm"
            disabled={isCheckingModUpdates || isUpdatingAny}
            onClick={onCheckModUpdates}
            onArrowPress={onHeaderArrowPress}
            className="!h-9 !min-h-9"
          >
            <RefreshCw size={14} className={`mr-1.5 ${isCheckingModUpdates ? 'animate-spin' : ''}`} />
            {isCheckingModUpdates ? '检查中...' : '检查更新'}
          </OreButton>

          {/* 一键更新 (仅在有可用更新时展示) */}
          {stats.updates > 0 && (
            <OreButton
              focusKey="mod-btn-update-all"
              variant="primary"
              size="sm"
              disabled={isCheckingModUpdates || isUpdatingAny}
              onClick={onUpdateAllMods}
              onArrowPress={onHeaderArrowPress}
              className="!h-9 !min-h-9"
            >
              <ArrowUpCircle size={14} className="mr-1.5" />
              一键更新 ({stats.updates})
            </OreButton>
          )}

          {/* 下载 MOD */}
          <OreButton
            focusKey="mod-btn-download"
            variant="primary"
            size="sm"
            onClick={onOpenDownload}
            onArrowPress={onHeaderArrowPress}
            className="!h-9 !min-h-9 font-bold"
          >
            <DownloadCloud size={14} className="mr-1.5" />
            下载 MOD
          </OreButton>
        </div>
      </div>

      {/* 次级操作栏：搜索栏 (集成放大镜 + 清空X) + 右侧数据统计 */}
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <OreInput
            focusKey="mod-search-input"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onArrowPress={onHeaderArrowPress}
            placeholder={searchPlaceholder}
            height="36px"
            containerClassName="w-full"
            className="font-minecraft text-xs"
            prefixNode={<Search size={14} className={isLightTheme ? 'text-[#313233]' : 'text-[#8B93A7]'} />}
            suffixNode={searchQuery ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={onClearSearch}
                className="flex h-5 w-5 items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={13} />
              </button>
            ) : null}
          />
        </div>

        {/* 统计指标 */}
        <div className="shrink-0 flex items-center gap-2 font-minecraft text-xs text-[#8B93A7] px-1 select-none">
          <span>共 <strong className="text-white font-bold">{stats.total}</strong> 个模组</span>
          <span>•</span>
          <span>已启用 <strong className="text-[#57D38C] font-bold">{stats.enabled}</strong></span>
          {stats.disabled > 0 && (
            <>
              <span>•</span>
              <span>已禁用 <strong className="text-gray-400 font-bold">{stats.disabled}</strong></span>
            </>
          )}
          {stats.updates > 0 && (
            <>
              <span>•</span>
              <span>可更新 <strong className="text-[#FFA940] font-bold">{stats.updates}</strong></span>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
