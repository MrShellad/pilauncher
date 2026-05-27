import React from 'react';
import {
  ArrowUpCircle,
  CheckCircle2,
  CircleOff,
  Filter,
  FolderInput,
  LayoutList,
  Moon,
  Power,
  RefreshCw,
  Rows3,
  Search,
  Sun,
  Trash2,
  X,
  Settings2,
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
  onOpenModMetadataSettings: () => void;
  onCheckModUpdates: () => void;
  isCheckingModUpdates: boolean;
  onQuickFilterChange: (filter: ModQuickFilter) => void;
  onViewModeChange: (viewMode: ModListViewMode) => void;
  listTheme: ModListTheme;
  onThemeChange: (theme: ModListTheme) => void;
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

const LIST_CONTROL_TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '1.0625rem',
  fontWeight: 'normal'
};

export const ModListHeader: React.FC<ModListHeaderProps> = ({
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
  onExitBatchMode,
  onOpenModMetadataSettings,
  onCheckModUpdates,
  isCheckingModUpdates,
  onQuickFilterChange,
  onViewModeChange,
  listTheme,
  onThemeChange
}) => {
  const isLightTheme = listTheme === 'light';
  const toolbarClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#D0D1D4] text-[#111214] shadow-[inset_0_-0.25rem_0_#A9ABAE,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.74)]'
    : 'border-[#2A3140] bg-[#161A22] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]';
  const segmentClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#B8BBC2] shadow-[inset_0_-0.1875rem_0_#8C8D90]'
    : 'border-[#313A4D] bg-[#232937]';
  const activeSegmentClass = isLightTheme
    ? 'bg-[#F2F2F2] text-[#111214] shadow-[inset_0_-0.1875rem_0_#B8BBC2,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.8)]'
    : 'bg-[#262D3D] text-[#DCE3F1]';
  const inactiveSegmentClass = isLightTheme
    ? 'text-[#313233] hover:bg-[#E4E5E7] hover:text-[#111214]'
    : 'text-[#8B93A7] hover:bg-[#222734] hover:text-[#DCE3F1]';
  const filterActiveClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#90A6D6] text-[#111214] shadow-[inset_0_-0.1875rem_0_#61749C,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.66)]'
    : 'border-[#7AA2FF] bg-[#17345F] text-[#F3F6FC] shadow-[inset_0_0_0_1px_rgba(122,162,255,0.28)]';
  const filterInactiveClass = isLightTheme
    ? 'border-[#1E1E1F] bg-[#DDE0E3] text-[#313233] hover:bg-[#F2F2F2] hover:text-[#111214]'
    : 'border-[#2A3140] bg-[#171B23] text-[#8B93A7] hover:border-[#313A4D] hover:bg-[#232937] hover:text-[#DCE3F1]';

  return (
    <div className={`mx-2 mb-1.5 border px-3 py-2 ${toolbarClass}`}>
      <div className="flex w-full flex-wrap items-center gap-x-2 gap-y-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2">
          <OreInput
            focusKey="mod-search-input"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onArrowPress={onHeaderArrowPress}
            placeholder={searchPlaceholder}
            height="44px"
            containerClassName={`min-w-0 flex-1 ${isLightTheme ? '[&.ring-white]:!ring-[#1D4D13]' : ''}`}
            className={isLightTheme
              ? '!border-[#1E1E1F] !bg-[#F2F2F2] !text-[#111214] placeholder:!text-[#60636A] hover:!bg-white focus:!border-[#1E1E1F] active:!bg-[#E4E5E7]'
              : ''
            }
            style={LIST_CONTROL_TEXT_STYLE}
            prefixNode={<Search size={16} className={isLightTheme ? 'text-[#313233]' : undefined} />}
          />

          {searchQuery && (
            <OreButton
              focusKey="mod-search-clear"
              variant="secondary"
              size="auto"
              onClick={onClearSearch}
              onArrowPress={onHeaderArrowPress}
              className={`${MOD_LIST_HEADER_CLASSES.oreButton} !min-w-10 !px-2`}
              style={LIST_CONTROL_TEXT_STYLE}
              title="清空搜索"
            >
              <X size={15} />
            </OreButton>
          )}
        </div>

        <div className={`${MOD_LIST_HEADER_CLASSES.segmentGroup} ${segmentClass} justify-start xl:justify-end`}>
          {VIEW_MODE_OPTIONS.map((option) => {
            const isActive = option.id === viewMode;

            return (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                title={`${option.label}视图`}
                onClick={() => onViewModeChange(option.id)}
                className={`inline-flex h-full min-w-16 items-center justify-center gap-1.5 px-3 text-[1.0625rem] transition-colors ${isActive ? activeSegmentClass : inactiveSegmentClass}`}
              >
                {option.icon}
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex min-h-[2.625rem] flex-wrap items-center justify-between gap-x-2 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {filterOptions.map((option) => {
            const isActive = option.id === quickFilter;

            return (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                onClick={() => onQuickFilterChange(option.id)}
                className={`inline-flex min-h-10 items-center gap-1.5 border px-3 text-[1.0625rem] transition-colors ${isActive
                    ? filterActiveClass
                    : filterInactiveClass
                  }`}
              >
                {getFilterIcon(option.id)}
                <span>{option.label}</span>
                <span className="text-[1.0625rem] font-semibold opacity-70">{option.count}</span>
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
          <OreButton
            focusKey="mod-btn-theme-toggle"
            variant="secondary"
            size="auto"
            onClick={() => onThemeChange(isLightTheme ? 'dark' : 'light')}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
            style={LIST_CONTROL_TEXT_STYLE}
            title={isLightTheme ? '切换到暗色列表' : '切换到亮色列表'}
          >
            {isLightTheme ? <Moon size={14} className="mr-1.5" /> : <Sun size={14} className="mr-1.5" />}
            {isLightTheme ? '暗色' : '亮色'}
          </OreButton>

          {isBatchMode && (
            <div className="flex shrink-0 animate-in flex-wrap items-center gap-2 fade-in slide-in-from-top-1">
              <OreButton
                focusKey="mod-btn-batch-enable"
                size="auto"
                variant="secondary"
                onClick={onBatchEnable}
                onArrowPress={onHeaderArrowPress}
                className={MOD_LIST_HEADER_CLASSES.oreButton}
                style={LIST_CONTROL_TEXT_STYLE}
              >
                <Power size={14} className="mr-1.5" />
                启用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-disable"
                size="auto"
                variant="secondary"
                onClick={onBatchDisable}
                onArrowPress={onHeaderArrowPress}
                className={MOD_LIST_HEADER_CLASSES.oreButton}
                style={LIST_CONTROL_TEXT_STYLE}
              >
                <Power size={14} className="mr-1.5 opacity-50" />
                禁用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-delete"
                size="auto"
                variant="danger"
                onClick={onBatchDelete}
                onArrowPress={onHeaderArrowPress}
                className={MOD_LIST_HEADER_CLASSES.oreButton}
                style={LIST_CONTROL_TEXT_STYLE}
              >
                <Trash2 size={14} className="mr-1.5" />
                删除
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-favorite"
                size="auto"
                variant="secondary"
                onClick={onBatchFavorite}
                onArrowPress={onHeaderArrowPress}
                className={MOD_LIST_HEADER_CLASSES.oreButton}
                style={LIST_CONTROL_TEXT_STYLE}
              >
                <Star size={14} className="mr-1.5" />
                收藏
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-exit"
                size="auto"
                variant="secondary"
                onClick={onExitBatchMode}
                onArrowPress={onHeaderArrowPress}
                className={`${MOD_LIST_HEADER_CLASSES.oreButton} shrink-0`}
                style={LIST_CONTROL_TEXT_STYLE}
              >
                <X size={15} className="mr-1.5" />
                退出多选
              </OreButton>
            </div>
          )}

          <OreButton
            focusKey="mod-btn-metadata-settings"
            variant="secondary"
            size="auto"
            onClick={onOpenModMetadataSettings}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
            style={LIST_CONTROL_TEXT_STYLE}
            title="MOD 元数据"
          >
            <Settings2 size={14} className="mr-1.5" />
            元数据
          </OreButton>

          <OreButton
            focusKey="mod-btn-check-updates"
            variant="purple"
            size="auto"
            disabled={isCheckingModUpdates}
            onClick={onCheckModUpdates}
            onArrowPress={onHeaderArrowPress}
            className={MOD_LIST_HEADER_CLASSES.oreButton}
            style={LIST_CONTROL_TEXT_STYLE}
          >
            <RefreshCw size={14} className={`mr-1.5 ${isCheckingModUpdates ? 'animate-spin' : ''}`} />
            {isCheckingModUpdates ? '检查中...' : '检查更新'}
          </OreButton>
        </div>
      </div>
    </div>
  );
};
