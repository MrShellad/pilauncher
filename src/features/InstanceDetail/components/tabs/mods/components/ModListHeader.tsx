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

const LIST_CONTROL_TEXT_STYLE: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '1.0625rem'
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
    <div className="mx-2 mb-1.5 border border-[#2A3140] bg-[#161A22] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-[1.125rem] font-semibold text-[#F3F6FC]">ModList</span>
          <span className="rounded-[6px] border border-[#313A4D] bg-[#232937] px-2 py-0.5 text-[1.0625rem] font-semibold text-[#C7D2E6]">
            {stats.visible} / {stats.total}
          </span>
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 text-[1.0625rem]">
          <span className="text-[#8C8D90]">启用 {stats.enabled}</span>
          <span className="text-[#8C8D90]">禁用 {stats.disabled}</span>
          <span className={stats.updates > 0 ? 'text-[#57D38C]' : 'text-[#8C8D90]'}>
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
            height="44px"
            containerClassName="min-w-0 flex-1"
            style={LIST_CONTROL_TEXT_STYLE}
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
              style={LIST_CONTROL_TEXT_STYLE}
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
                className={`inline-flex h-full min-w-16 items-center justify-center gap-1.5 px-3 text-[1.0625rem] transition-colors ${
                  isActive
                    ? 'bg-[#262D3D] text-[#DCE3F1]'
                    : 'text-[#8B93A7] hover:bg-[#222734] hover:text-[#DCE3F1]'
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
                className={`inline-flex min-h-10 items-center gap-1.5 border px-3 text-[1.0625rem] transition-colors ${
                  isActive
                    ? 'border-[#7AA2FF] bg-[#17345F] text-[#F3F6FC] shadow-[inset_0_0_0_1px_rgba(122,162,255,0.28)]'
                    : 'border-[#2A3140] bg-[#171B23] text-[#8B93A7] hover:border-[#313A4D] hover:bg-[#232937] hover:text-[#DCE3F1]'
                }`}
              >
                {getFilterIcon(option.id)}
                <span>{option.label}</span>
                <span className="text-[1.0625rem] font-semibold opacity-70">{option.count}</span>
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
        ) : (
          <div className="hidden xl:block" />
        )}
      </div>
    </div>
  );
};
