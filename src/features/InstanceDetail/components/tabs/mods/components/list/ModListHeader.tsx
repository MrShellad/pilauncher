import React from 'react';
import {
  ArrowUpCircle,
  ChevronDown,
  CheckCircle2,
  CircleOff,
  DownloadCloud,
  Filter,
  FolderInput,
  FolderOpen,
  History,
  LayoutList,
  Loader2,
  Moon,
  Power,
  RefreshCw,
  Rows3,
  Search,
  Sun,
  Trash2,
  Wand2,
  X,
  Star
} from 'lucide-react';

import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../../ui/primitives/OreInput';
import {
  MOD_LIST_HEADER_CLASSES,
  type ModListStats,
  type ModListTheme,
  type ModListViewMode,
  type ModQuickFilter,
  type ModQuickFilterOption
} from '../../modListShared';

export interface ModListHeaderProps {
  stats: ModListStats;
  isBatchMode: boolean;
  searchQuery: string;
  searchPlaceholder: string;
  quickFilter: ModQuickFilter;
  filterOptions: ModQuickFilterOption[];
  viewMode: ModListViewMode;
  onHeaderArrowPress: (direction: string) => boolean;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchDelete: () => void;
  onBatchFavorite: () => void;
  onExitBatchMode: () => void;
  onOpenModMetadataSettings?: () => void;
  onReidentifyAllMods?: () => void | Promise<void>;
  isReidentifyingAll?: boolean;
  onCheckModUpdates: () => void;
  isCheckingModUpdates: boolean;
  isUpdatingAny?: boolean;
  onUpdateAllMods?: () => void;
  onQuickFilterChange: (filter: ModQuickFilter) => void;
  onViewModeChange: (viewMode: ModListViewMode) => void;
  listTheme: ModListTheme;
  onThemeChange: (theme: ModListTheme) => void;
  // Top bar props (merged from ModPanelTopBar)
  isTopBarCollapsed?: boolean;
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  snapshotProgressPhase: string | null;
  onCreateSnapshot: () => void | Promise<void>;
  onOpenHistory: () => void | Promise<void>;
  onOpenModFolder: () => void | Promise<void>;
  onAnalyzeCleanup: () => void;
  onOpenDownload: () => void;
  onTopBarCollapseChange?: (collapsed: boolean) => void;
}

const VIEW_MODE_OPTIONS: Array<{
  id: ModListViewMode;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'standard', label: '标准', icon: <LayoutList size={14} /> },
  { id: 'compact', label: '紧凑', icon: <Rows3 size={14} /> }
];

const getFilterIcon = (filter: ModQuickFilter) => {
  if (filter === 'enabled') return <CheckCircle2 size={13} />;
  if (filter === 'disabled') return <CircleOff size={13} />;
  if (filter === 'updates') return <ArrowUpCircle size={13} />;
  if ((filter as string) === 'external') return <FolderInput size={13} />;
  return <Filter size={13} />;
};

export const ModListHeader: React.FC<ModListHeaderProps> = ({
  stats,
  isBatchMode,
  searchQuery,
  searchPlaceholder,
  quickFilter,
  filterOptions,
  viewMode,
  onHeaderArrowPress,
  onSearchQueryChange,
  onClearSearch,
  onBatchEnable,
  onBatchDisable,
  onBatchDelete,
  onBatchFavorite,
  onOpenModMetadataSettings,
  onReidentifyAllMods,
  isReidentifyingAll,
  onCheckModUpdates,
  isCheckingModUpdates,
  isUpdatingAny,
  onUpdateAllMods,
  onQuickFilterChange,
  onViewModeChange,
  listTheme,
  onThemeChange,
  snapshotState,
  snapshotProgressPhase,
  onCreateSnapshot,
  onOpenHistory,
  onOpenModFolder,
  onAnalyzeCleanup,
  onOpenDownload,
  isTopBarCollapsed = false,
  onTopBarCollapseChange
}) => {
  const snapshotLabel = snapshotState === 'snapshotting'
    ? (snapshotProgressPhase || '创建中...')
    : '创建快照';
  const isLightTheme = listTheme === 'light';
  const toolbarClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#D0D1D4] text-[#111214] shadow-[inset_0_-0.25rem_0_#A9ABAE,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.74)]'
    : 'border-[2px] border-[#1E1E1F] bg-[#161A22] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
  const segmentClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#B8BBC2] shadow-[inset_0_-0.1875rem_0_#8C8D90]'
    : 'border-[#1E1E1F] bg-[#232937]';
  const activeSegmentClass = isLightTheme
    ? 'bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-0.1875rem_0_#B8BBC2,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.8)]'
    : 'bg-[#262D3D] text-[#DCE3F1]';
  const inactiveSegmentClass = isLightTheme
    ? 'text-[#313233] hover:bg-[#E4E5E7] hover:text-[#111214]'
    : 'text-[#8B93A7] hover:bg-[#222734] hover:text-[#DCE3F1]';
  const filterActiveClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#90A6D6] text-[#111214] shadow-[inset_0_-0.1875rem_0_#61749C,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.66)]'
    : 'border-[2px] border-[#1E1E1F] bg-[#17345F] text-[#F3F6FC] shadow-[inset_0_-2px_0_#0D203C]';
  const filterInactiveClass = isLightTheme
    ? 'border-[2px] border-[#1E1E1F] bg-[#DDE0E3] text-[#313233] hover:bg-[#F2F2F2] hover:text-[#111214] shadow-[inset_0_-2px_0_#A9ABAE]'
    : 'border-[2px] border-[#1E1E1F] bg-[#171B23] text-[#8B93A7] hover:border-[#313A4D] hover:bg-[#232937] hover:text-[#DCE3F1] shadow-[inset_0_-2px_0_rgba(0,0,0,0.3)]';

  if (isTopBarCollapsed) {
    return (
      <section className={`mx-2 mb-1.5 flex min-h-9 items-center justify-between gap-3 border-[2px] px-3 py-1 ${toolbarClass}`} aria-label="本地 MOD 工具栏（已收起）">
        <div className="flex min-w-0 items-center gap-2">
          <LayoutList size={16} className="shrink-0 text-[#7AA2FF]" />
          <span className={`truncate font-minecraft text-[13px] font-bold ${isLightTheme ? 'text-[#111214]' : 'text-white'}`}>本地 MOD</span>
          <span className={`shrink-0 font-minecraft text-[11px] ${isLightTheme ? 'text-[#4A4C50]' : 'text-[#8D96A8]'}`}>
            {stats.visible}/{stats.total}
          </span>
          {stats.updates > 0 && (
            <span className="shrink-0 font-minecraft text-[11px] font-bold text-[#57D38C]">{stats.updates} 个可更新</span>
          )}
        </div>
        <OreButton
          focusKey="mod-toolbar-expand"
          variant="secondary"
          size="auto"
          onClick={() => onTopBarCollapseChange?.(false)}
          onArrowPress={onHeaderArrowPress}
          className="!h-7 !min-h-7 !min-w-7 !w-7 !px-0"
          title="展开工具栏"
          aria-label="展开工具栏"
        >
          <ChevronDown size={14} />
        </OreButton>
      </section>
    );
  }

  return (
    <section className={`mx-2 mb-1.5 border-[2px] p-2.5 ${toolbarClass}`} aria-label="本地 MOD 工具栏">
      <header className="flex flex-wrap items-start justify-between gap-2.5 border-b border-current/10 pb-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className={`flex items-center font-minecraft text-[14px] font-bold ${isLightTheme ? 'text-[#111214]' : 'text-white'}`}>
              <LayoutList size={16} className="mr-2 text-[#7AA2FF]" />
              本地 MOD
            </h3>
            <div className={`flex items-center gap-2 font-minecraft text-[11px] ${isLightTheme ? 'text-[#4A4C50]' : 'text-[#8D96A8]'}`}>
              <span>共 {stats.total} 个</span>
              {stats.visible !== stats.total && <span>显示 {stats.visible} 个</span>}
              {stats.updates > 0 && <span className="font-bold text-[#57D38C]">{stats.updates} 个可更新</span>}
            </div>
          </div>
          <p className={`mt-0.5 font-minecraft text-[11px] ${isLightTheme ? 'text-[#60636A]' : 'text-[#7E879A]'}`}>
            搜索、筛选并维护当前实例的模组文件
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          <OreButton
            focusKey="mod-btn-snapshot"
            variant="secondary"
            size="auto"
            disabled={snapshotState !== 'idle'}
            onClick={onCreateSnapshot}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
          >
            {snapshotState === 'snapshotting' ? <Loader2 className="mr-1.5 animate-spin" size={13} /> : <History size={13} className="mr-1.5" />}
            {snapshotLabel}
          </OreButton>
          <OreButton
            focusKey="mod-btn-history"
            size="auto"
            variant="secondary"
            onClick={onOpenHistory}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
          >
            <RefreshCw size={13} className="mr-1.5" />
            历史
          </OreButton>
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
      </header>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2">
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

        <div className={`${MOD_LIST_HEADER_CLASSES.segmentGroup} ${segmentClass}`} aria-label="列表视图">
          {VIEW_MODE_OPTIONS.map((option) => {
            const isActive = option.id === viewMode;
            return (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                title={`${option.label}视图`}
                onClick={() => onViewModeChange(option.id)}
                className={`inline-flex h-full min-w-14 items-center justify-center gap-1 px-2.5 font-minecraft text-[11px] font-bold uppercase transition-colors ${isActive ? activeSegmentClass : inactiveSegmentClass}`}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1 border-l border-current/10 pl-2">
          <OreButton focusKey="mod-btn-cleanup" variant="secondary" size="auto" onClick={onAnalyzeCleanup} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
            <Wand2 size={13} className="mr-1.5" />清理名称
          </OreButton>
          <OreButton
            focusKey="mod-btn-reidentify"
            variant="secondary"
            size="auto"
            onClick={onReidentifyAllMods || onOpenModMetadataSettings}
            disabled={isReidentifyingAll}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
            title="一键重新从 Modrinth / CurseForge 双平台拉取并识别所有模组元数据与图标"
          >
            <RefreshCw size={13} className={`mr-1.5 ${isReidentifyingAll ? 'animate-spin text-ore-green' : ''}`} />
            {isReidentifyingAll ? '正在拉取...' : '重新拉取'}
          </OreButton>
          <OreButton focusKey="mod-btn-theme-toggle" variant="secondary" size="auto" onClick={() => onThemeChange(isLightTheme ? 'dark' : 'light')} onArrowPress={onHeaderArrowPress} className={`${MOD_LIST_HEADER_CLASSES.oreButton} !min-w-8 !px-2`} title={isLightTheme ? '切换到暗色列表' : '切换到亮色列表'}>
            {isLightTheme ? <Moon size={13} /> : <Sun size={13} />}
          </OreButton>
        </div>
      </div>

      <div className="mt-2.5 flex min-h-[2.25rem] flex-wrap items-center justify-between gap-2 border-t border-current/10 pt-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="模组筛选">
          {filterOptions.map((option) => {
            const isActive = option.id === quickFilter;
            return (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                onClick={() => onQuickFilterChange(option.id)}
                className={`inline-flex min-h-8 items-center gap-1.5 border-[2px] px-2.5 font-minecraft text-[11px] font-bold uppercase transition-colors ${isActive ? filterActiveClass : filterInactiveClass}`}
              >
                {getFilterIcon(option.id)}
                <span>{option.label}</span>
                <span className="font-minecraft text-[10px] font-bold opacity-75">{option.count}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {isBatchMode && (
            <div className={`flex flex-wrap items-center gap-1.5 border-[2px] px-2 py-1 ${isLightTheme ? 'border-[#1E1E1F] bg-[#DDE0E3]' : 'border-[#1E1E1F] bg-[#1A1F29]'}`}>
              <span className={`px-1 font-minecraft text-[11px] font-bold ${isLightTheme ? 'text-[#313233]' : 'text-[#B8C2D9]'}`}>批量操作</span>
              <OreButton focusKey="mod-btn-batch-enable" size="auto" variant="secondary" onClick={onBatchEnable} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
                <Power size={13} className="mr-1" />启用
              </OreButton>
              <OreButton focusKey="mod-btn-batch-disable" size="auto" variant="secondary" onClick={onBatchDisable} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
                <Power size={13} className="mr-1 opacity-50" />禁用
              </OreButton>
              <OreButton focusKey="mod-btn-batch-favorite" size="auto" variant="secondary" onClick={onBatchFavorite} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
                <Star size={13} className="mr-1" />收藏
              </OreButton>
              <OreButton focusKey="mod-btn-batch-delete" size="auto" variant="danger" onClick={onBatchDelete} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
                <Trash2 size={13} className="mr-1" />删除
              </OreButton>
            </div>
          )}

          <OreButton focusKey="mod-btn-check-updates" variant="purple" size="auto" disabled={isCheckingModUpdates || isUpdatingAny} onClick={onCheckModUpdates} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
            <RefreshCw size={13} className={`mr-1.5 ${isCheckingModUpdates ? 'animate-spin' : ''}`} />
            {isCheckingModUpdates ? '检查中...' : '检查更新'}
          </OreButton>
          {stats.updates > 0 && (
            <OreButton focusKey="mod-btn-update-all" variant="primary" size="auto" disabled={isCheckingModUpdates || isUpdatingAny} onClick={onUpdateAllMods} onArrowPress={onHeaderArrowPress} className={MOD_LIST_HEADER_CLASSES.oreButton}>
              <ArrowUpCircle size={13} className="mr-1.5" />一键更新 ({stats.updates})
            </OreButton>
          )}
        </div>
      </div>
    </section>
  );
};
