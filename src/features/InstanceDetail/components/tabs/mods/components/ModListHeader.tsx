import React from 'react';
import {
  ArrowUpCircle,
  CheckCircle2,
  CircleOff,
  Filter,
  FolderInput,
  LayoutList,
  Power,
  Rows3,
  Search,
  Trash2,
  X
} from 'lucide-react';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import {
  MOD_LIST_HEADER_CLASSES,
  type ModListStats,
  type ModListViewMode,
  type ModQuickFilter,
  type ModQuickFilterOption
} from '../modListShared';

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
  onExitBatchMode: () => void;
  onQuickFilterChange: (filter: ModQuickFilter) => void;
  onViewModeChange: (viewMode: ModListViewMode) => void;
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
  if (filter === 'external') return <FolderInput size={13} />;
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
  onExitBatchMode,
  onQuickFilterChange,
  onViewModeChange
}) => {
  return (
    <div className="mx-2 mb-1.5 border border-white/[0.08] bg-[#151517] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="font-minecraft text-sm text-white">ModList</span>
          <span className="font-mono text-xs text-[#9EA1A8]">
            {stats.visible} / {stats.total}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
          <span className="text-[#8C8D90]">启用 {stats.enabled}</span>
          <span className="text-[#8C8D90]">禁用 {stats.disabled}</span>
          <span className={stats.updates > 0 ? 'text-[#F0C86B]' : 'text-[#8C8D90]'}>
            更新 {stats.updates}
          </span>
        </div>
      </div>

      <div className="mt-2 flex w-full flex-wrap items-center gap-x-2 gap-y-2">
        <div className="flex min-w-[14rem] flex-1 items-center gap-2">
          <OreInput
            focusKey="mod-search-input"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            onArrowPress={onHeaderArrowPress}
            placeholder={searchPlaceholder}
            height="40px"
            containerClassName="min-w-0 flex-1"
            prefixNode={<Search size={16} />}
          />

          {searchQuery && (
            <OreButton
              focusKey="mod-search-clear"
              variant="secondary"
              size="auto"
              onClick={onClearSearch}
              onArrowPress={onHeaderArrowPress}
              className={`${MOD_LIST_HEADER_CLASSES.oreButton} !min-w-10 !px-2`}
              title="清空搜索"
            >
              <X size={15} />
            </OreButton>
          )}
        </div>

        <div className={`${MOD_LIST_HEADER_CLASSES.segmentGroup} justify-start xl:justify-end`}>
          {VIEW_MODE_OPTIONS.map((option) => {
            const isActive = option.id === viewMode;

            return (
              <button
                key={option.id}
                type="button"
                tabIndex={-1}
                title={`${option.label}视图`}
                onClick={() => onViewModeChange(option.id)}
                className={`inline-flex h-full min-w-16 items-center justify-center gap-1.5 px-3 text-xs transition-colors ${
                  isActive
                    ? 'bg-[#D0D1D4] text-[#111111]'
                    : 'text-[#9EA1A8] hover:bg-white/[0.06] hover:text-white'
                }`}
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
                className={`inline-flex min-h-10 items-center gap-1.5 border px-3 text-xs transition-colors ${
                  isActive
                    ? 'border-[#6CC349]/70 bg-[#1D4D13]/60 text-white'
                    : 'border-white/[0.08] bg-white/[0.03] text-[#A5A7AD] hover:border-white/20 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {getFilterIcon(option.id)}
                <span>{option.label}</span>
                <span className="font-mono text-[0.625rem] opacity-70">{option.count}</span>
              </button>
            );
          })}
        </div>

        {isBatchMode ? (
          <div className="flex shrink-0 animate-in flex-wrap items-center gap-2 border border-ore-green/30 bg-ore-green/10 px-2 py-0.5 fade-in slide-in-from-top-1">
            <OreButton
              focusKey="mod-btn-batch-enable"
              size="auto"
              variant="secondary"
              onClick={onBatchEnable}
              onArrowPress={onHeaderArrowPress}
              className={MOD_LIST_HEADER_CLASSES.oreButton}
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
            >
              <Trash2 size={14} className="mr-1.5" />
              删除
            </OreButton>

            <OreButton
              focusKey="mod-btn-batch-exit"
              size="auto"
              variant="secondary"
              onClick={onExitBatchMode}
              onArrowPress={onHeaderArrowPress}
              className={`${MOD_LIST_HEADER_CLASSES.oreButton} shrink-0`}
            >
              <X size={15} className="mr-1.5" />
              退出多选
            </OreButton>
          </div>
        ) : (
          <div className="hidden xl:block" />
        )}
      </div>
    </div>
  );
};
