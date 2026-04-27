import React from 'react';
import {
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  DownloadCloud,
  FileText,
  FolderOpen,
  History,
  Loader2,
  Power,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Type,
  Wand2,
  X
} from 'lucide-react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { type ModSortOrder, type ModSortType } from '../../../hooks/useModManager';

export interface ModPanelTopBarProps {
  isBatchMode: boolean;
  selectedCount: number;
  isAllSelected: boolean;
  searchQuery: string;
  searchPlaceholder: string;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  snapshotProgressPhase: string | null;
  onArrowPress: (direction: string) => boolean;
  onCreateSnapshot: () => void | Promise<void>;
  onOpenHistory: () => void | Promise<void>;
  onOpenModFolder: () => void | Promise<void>;
  onAnalyzeCleanup: () => void;
  onOpenDownload: () => void;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onSelectAll: () => void;
  onSortClick: (type: ModSortType) => void;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchDelete: () => void;
  onExitBatchMode: () => void;
}

const SortDirectionIcon: React.FC<{ active: boolean; sortOrder: ModSortOrder }> = ({ active, sortOrder }) => {
  if (!active) {
    return null;
  }

  return sortOrder === 'asc'
    ? <ChevronUp size={14} className="ml-1" />
    : <ChevronDown size={14} className="ml-1" />;
};

export const ModPanelTopBar: React.FC<ModPanelTopBarProps> = ({
  isBatchMode,
  selectedCount,
  isAllSelected,
  searchQuery,
  searchPlaceholder,
  sortType,
  sortOrder,
  snapshotState,
  snapshotProgressPhase,
  onArrowPress,
  onCreateSnapshot,
  onOpenHistory,
  onOpenModFolder,
  onAnalyzeCleanup,
  onOpenDownload,
  onSearchQueryChange,
  onClearSearch,
  onSelectAll,
  onSortClick,
  onBatchEnable,
  onBatchDisable,
  onBatchDelete,
  onExitBatchMode
}) => {
  const snapshotLabel = snapshotState === 'snapshotting'
    ? (snapshotProgressPhase || '创建中...')
    : '创建快照';

  return (
    <>
      <div className="mb-4 flex items-center justify-between border-2 border-[#2A2A2C] bg-[#18181B] p-4">
        <div>
          <h3 className="flex items-center font-minecraft text-white">
            <History size={18} className="mr-2 text-ore-green" />
            模组快照
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <OreButton
            focusKey="mod-btn-snapshot"
            variant="primary"
            size="auto"
            disabled={snapshotState !== 'idle'}
            onClick={onCreateSnapshot}
            onArrowPress={onArrowPress}
            className="!h-10 !min-h-10"
          >
            {snapshotState === 'snapshotting' ? (
              <Loader2 className="mr-2 animate-spin" size={16} />
            ) : (
              <History size={16} className="mr-2" />
            )}
            {snapshotLabel}
          </OreButton>

          <OreButton
            focusKey="mod-btn-history"
            size="auto"
            variant="secondary"
            onClick={onOpenHistory}
            onArrowPress={onArrowPress}
            className="!h-10 !min-h-10"
          >
            <RefreshCw size={16} className="mr-2" />
            历史快照
          </OreButton>

          <div className="mx-1 h-6 w-px bg-white/15" />

          <OreButton
            focusKey="mod-btn-folder"
            variant="secondary"
            size="auto"
            onClick={onOpenModFolder}
            onArrowPress={onArrowPress}
            className="!h-10 !min-h-10"
          >
            <FolderOpen size={16} className="mr-2" />
            打开文件夹
          </OreButton>

          <div className="mx-1 h-6 w-px bg-white/15" />

          <OreButton
            focusKey="mod-btn-cleanup"
            variant="secondary"
            size="auto"
            onClick={onAnalyzeCleanup}
            onArrowPress={onArrowPress}
            className="!h-10 !min-h-10"
          >
            <Wand2 size={16} className="mr-2" />
            清理名称
          </OreButton>

          <OreButton
            focusKey="mod-btn-download"
            variant="primary"
            size="auto"
            onClick={onOpenDownload}
            onArrowPress={onArrowPress}
            className="!h-10 !min-h-10"
          >
            <DownloadCloud size={16} className="mr-2" />
            下载 MOD
          </OreButton>
        </div>
      </div>

      <div className="mb-3 flex h-[52px] items-center justify-between gap-3 px-2 transition-all">
        {isBatchMode ? (
          <div className="flex h-full w-full items-center justify-between rounded border-2 border-ore-green/30 bg-ore-green/10 px-3 animate-in fade-in slide-in-from-top-1">
            <div className="flex items-center gap-3">
              <FocusItem
                focusKey="mod-btn-batch-select"
                onEnter={onSelectAll}
                onArrowPress={onArrowPress}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={onSelectAll}
                    className={`flex h-10 cursor-pointer items-center px-2 font-minecraft text-sm text-white transition-all decoration-ore-green underline-offset-4 hover:text-ore-green hover:underline focus:outline-none ${focused ? 'rounded bg-[#2A2A2C] ring-2 ring-white scale-105' : ''}`}
                  >
                    <CheckSquare size={16} className="mr-1.5 text-ore-green" />
                    已选择 {selectedCount} 项
                  </button>
                )}
              </FocusItem>

              <div className="mx-1 h-4 w-px bg-white/20" />

              <OreButton
                focusKey="mod-btn-batch-enable"
                size="auto"
                variant="secondary"
                onClick={onBatchEnable}
                onArrowPress={onArrowPress}
                className="!h-10 !min-h-10"
              >
                <Power size={14} className="mr-1.5" />
                启用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-disable"
                size="auto"
                variant="secondary"
                onClick={onBatchDisable}
                onArrowPress={onArrowPress}
                className="!h-10 !min-h-10"
              >
                <Power size={14} className="mr-1.5 opacity-50" />
                禁用
              </OreButton>

              <OreButton
                focusKey="mod-btn-batch-delete"
                size="auto"
                variant="danger"
                onClick={onBatchDelete}
                onArrowPress={onArrowPress}
                className="!h-10 !min-h-10"
              >
                <Trash2 size={14} className="mr-1.5" />
                删除
              </OreButton>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
              <div className="max-w-xs flex-1">
                <OreInput
                  focusKey="mod-search-input"
                  value={searchQuery}
                  onChange={(event) => onSearchQueryChange(event.target.value)}
                  onArrowPress={onArrowPress}
                  placeholder={searchPlaceholder}
                  containerClassName="w-full"
                  prefixNode={<Search size={16} />}
                />
              </div>

              <OreButton
                focusKey="mod-btn-batch-exit"
                size="auto"
                variant="secondary"
                onClick={onExitBatchMode}
                onArrowPress={onArrowPress}
                className="!h-10 !min-h-10 flex-shrink-0"
              >
                <X size={16} className="mr-1.5" />
                退出多选
              </OreButton>
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <FocusItem
              focusKey="mod-btn-select-all"
              onEnter={onSelectAll}
              onArrowPress={onArrowPress}
            >
              {({ ref, focused }) => (
                <button
                  ref={ref as React.RefObject<HTMLButtonElement>}
                  onClick={onSelectAll}
                  className={`mr-1 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center text-gray-400 transition-colors hover:text-white focus:outline-none ${focused ? 'z-20 rounded bg-[#2A2A2C] ring-2 ring-white scale-110 shadow-lg' : ''}`}
                  title={isAllSelected ? '取消全选' : '全选'}
                >
                  {isAllSelected ? <CheckSquare size={18} className="text-ore-green" /> : <Square size={18} />}
                </button>
              )}
            </FocusItem>

            <div className="relative z-10 flex h-10 flex-shrink-0 border-2 border-[#1E1E1F] bg-[#141415] p-0.5 shadow-inner">
              <FocusItem
                focusKey="mod-btn-sort-time"
                onEnter={() => onSortClick('time')}
                onArrowPress={onArrowPress}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => onSortClick('time')}
                    className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'time' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 ring-2 ring-white scale-105 shadow-lg' : ''}`}
                  >
                    <Clock size={14} className="mr-1.5" />
                    更新时间
                    <SortDirectionIcon active={sortType === 'time'} sortOrder={sortOrder} />
                  </button>
                )}
              </FocusItem>

              <FocusItem
                focusKey="mod-btn-sort-name"
                onEnter={() => onSortClick('name')}
                onArrowPress={onArrowPress}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => onSortClick('name')}
                    className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'name' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 ring-2 ring-white scale-105 shadow-lg' : ''}`}
                  >
                    <Type size={14} className="mr-1.5" />
                    名称
                    <SortDirectionIcon active={sortType === 'name'} sortOrder={sortOrder} />
                  </button>
                )}
              </FocusItem>

              <FocusItem
                focusKey="mod-btn-sort-filename"
                onEnter={() => onSortClick('fileName')}
                onArrowPress={onArrowPress}
              >
                {({ ref, focused }) => (
                  <button
                    ref={ref as React.RefObject<HTMLButtonElement>}
                    onClick={() => onSortClick('fileName')}
                    className={`flex h-full items-center px-3 font-minecraft text-sm outline-none transition-all ${sortType === 'fileName' ? 'bg-[#2A2A2C] text-white shadow-md' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'} ${focused ? 'z-20 ring-2 ring-white scale-105 shadow-lg' : ''}`}
                  >
                    <FileText size={14} className="mr-1.5" />
                    文件名
                    <SortDirectionIcon active={sortType === 'fileName'} sortOrder={sortOrder} />
                  </button>
                )}
              </FocusItem>
            </div>

            <div className="min-w-[15rem] flex-1">
              <OreInput
                focusKey="mod-search-input"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onArrowPress={onArrowPress}
                placeholder={searchPlaceholder}
                containerClassName="w-full"
                prefixNode={<Search size={16} />}
              />
            </div>

            {searchQuery && (
              <OreButton
                focusKey="mod-search-clear"
                variant="secondary"
                size="auto"
                onClick={onClearSearch}
                onArrowPress={onArrowPress}
                className="!h-10 !min-h-10 min-w-[6rem] flex-shrink-0"
              >
                <X size={16} className="mr-2" />
                清空
              </OreButton>
            )}
          </div>
        )}
      </div>
    </>
  );
};
