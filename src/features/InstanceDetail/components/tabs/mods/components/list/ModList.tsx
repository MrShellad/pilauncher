import React, { useEffect, useState } from 'react';
import { CheckSquare, Power, Star, Trash2, X } from 'lucide-react';

import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../../../../ui/primitives/OreButton';
import { useSettingsStore } from '../../../../../../../store/useSettingsStore';
import { type ModSortOrder, type ModSortType, type ModUpdateCheckProgress } from '../../../../../hooks/useModManager';
import type { InstanceDependencyHealth, ModMeta } from '../../../../../logic/modService';
import {
  LIST_ENTRY_FOCUS_KEY,
  LIST_GUARD_BOTTOM,
  LIST_GUARD_LEFT,
  LIST_GUARD_RIGHT,
  LIST_GUARD_TOP,
  type ModListTheme
} from '../../modListShared';
import { ModAccordionVirtualList } from './ModAccordionVirtualList';
import { ModListEmptyState } from './ModListEmptyState';
import { ModListGridHeader } from './ModListGridHeader';
import { ModListHeader } from './ModListHeader';
import { ModListOverlay } from './ModListOverlay';
import { ModListSkeleton } from './ModListSkeleton';
import { useModListController } from '../../hooks/useModListController';

export interface ModListProps {
  instanceId?: string;
  mods: ModMeta[];
  dependencyHealth?: InstanceDependencyHealth | null;
  isLoading: boolean;
  selectedMods: Set<string>;
  onToggleSelection: (fileName: string) => void;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onUpgradeMod: (mod: ModMeta) => void;
  onSelectMod: (mod: ModMeta) => void;
  onDeleteMod: (fileName: string) => void;
  isBatchMode: boolean;
  isAllSelected: boolean;
  searchQuery: string;
  searchPlaceholder: string;
  sortType: ModSortType;
  sortOrder: ModSortOrder;
  onHeaderArrowPress: (direction: string) => boolean;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  onSelectAll: () => void;
  onSortClick: (type: ModSortType) => void;
  onBatchEnable: () => void;
  onBatchDisable: () => void;
  onBatchDelete: () => void;
  onBatchFavorite?: () => void;
  onExitBatchMode: () => void;
  onOpenModMetadataSettings?: () => void;
  onReidentifyAllMods?: () => void | Promise<void>;
  isReidentifyingAll?: boolean;
  onCheckModUpdates: () => void;
  onCancelCheckModUpdates?: () => void;
  checkUpdateProgress?: ModUpdateCheckProgress | null;
  onUpdateAllMods?: () => void;
  isCheckingModUpdates: boolean;
  emptyMessage?: string;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
  onTopBarCollapseChange?: (collapsed: boolean) => void;
  isTopBarCollapsed?: boolean;
  // Top bar props (merged from ModPanelTopBar)
  snapshotState: 'idle' | 'snapshotting' | 'rolling_back';
  snapshotProgressPhase: string | null;
  onCreateSnapshot: () => void | Promise<void>;
  onOpenHistory: () => void | Promise<void>;
  onOpenModFolder: () => void | Promise<void>;
  onAnalyzeCleanup: () => void;
  onOpenDownload: () => void;
}

export const ModList: React.FC<ModListProps> = ({
  instanceId,
  mods,
  dependencyHealth,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onUpgradeMod,
  onSelectMod,
  onDeleteMod,
  isBatchMode: _isBatchMode,
  isAllSelected,
  searchQuery,
  searchPlaceholder,
  sortType,
  sortOrder,
  onHeaderArrowPress,
  onSearchQueryChange,
  onClearSearch,
  onSelectAll,
  onSortClick,
  onBatchEnable,
  onBatchDisable,
  onBatchDelete,
  onBatchFavorite,
  onExitBatchMode,
  onOpenModMetadataSettings,
  onReidentifyAllMods,
  isReidentifyingAll,
  onCheckModUpdates,
  onCancelCheckModUpdates,
  checkUpdateProgress,
  onUpdateAllMods,
  isCheckingModUpdates,
  emptyMessage = '当前没有可用模组。',
  onNavigateOut,
  onTopBarCollapseChange: _onTopBarCollapseChange,
  isTopBarCollapsed: _isTopBarCollapsed,
  snapshotState: _snapshotState,
  snapshotProgressPhase: _snapshotProgressPhase,
  onCreateSnapshot: _onCreateSnapshot,
  onOpenHistory,
  onOpenModFolder,
  onAnalyzeCleanup,
  onOpenDownload
}) => {
  const themeSetting = useSettingsStore((state) => state.settings.appearance.theme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'dark';
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const listTheme: ModListTheme = themeSetting === 'system' ? systemTheme : themeSetting === 'light' ? 'light' : 'dark';
  const [hasShownReadyList, setHasShownReadyList] = useState(false);
  const controller = useModListController({
    instanceId,
    mods,
    dependencyHealth,
    searchQuery,
    isLoading,
    selectedMods,
    onToggleSelection,
    onToggleMod,
    onUpgradeMod,
    onSelectMod,
    onDeleteMod,
    onNavigateOut
  });

  const shouldShowSkeleton = !hasShownReadyList && (isLoading || isCheckingModUpdates);
  const showUpdateOverlay = hasShownReadyList && isCheckingModUpdates;
  const showSyncingOverlay = controller.state.showSyncingOverlay || showUpdateOverlay;

  useEffect(() => {
    if (!isLoading && !isCheckingModUpdates && mods.length > 0) {
      setHasShownReadyList(true);
    }
  }, [isCheckingModUpdates, isLoading, mods.length]);

  return (
    <div
      data-mod-list-theme={listTheme}
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden text-[1.0625rem] transition-colors ${
        listTheme === 'light' ? 'text-[#111214]' : 'text-white'
      }`}
      style={{ fontFamily: 'var(--ore-global-font, "Minecraft"), "NotoSans Bold", "Noto Sans SC", sans-serif' }}
    >
      <ModListOverlay
        visible={showSyncingOverlay}
        label={
          checkUpdateProgress?.stageText ||
          (showUpdateOverlay ? '正在检查模组更新...' : '正在同步模组...')
        }
        current={checkUpdateProgress?.current ?? 0}
        total={checkUpdateProgress?.total ?? 0}
        percent={checkUpdateProgress?.percent}
        onCancel={onCancelCheckModUpdates}
        listTheme={listTheme}
        isBatchModeActive={selectedMods.size > 0}
      />

      <ModListHeader
        stats={controller.state.stats}
        searchQuery={searchQuery}
        searchPlaceholder={searchPlaceholder}
        quickFilter={controller.state.quickFilter}
        filterOptions={controller.state.filterOptions}
        onHeaderArrowPress={onHeaderArrowPress}
        onSearchQueryChange={onSearchQueryChange}
        onClearSearch={onClearSearch}
        onOpenModMetadataSettings={onOpenModMetadataSettings}
        onReidentifyAllMods={onReidentifyAllMods}
        isReidentifyingAll={isReidentifyingAll}
        onCheckModUpdates={onCheckModUpdates}
        isCheckingModUpdates={isCheckingModUpdates}
        isUpdatingAny={mods.some((m) => m.isUpdatingMod)}
        onUpdateAllMods={onUpdateAllMods}
        onQuickFilterChange={controller.controls.onQuickFilterChange}
        listTheme={listTheme}
        onOpenHistory={onOpenHistory}
        onOpenModFolder={onOpenModFolder}
        onAnalyzeCleanup={onAnalyzeCleanup}
        onOpenDownload={onOpenDownload}
      />

      <ModListGridHeader
        isAllSelected={isAllSelected}
        selectedCount={selectedMods.size}
        sortType={sortType}
        sortOrder={sortOrder}
        onSelectAll={onSelectAll}
        onSortClick={onSortClick}
        listTheme={listTheme}
      />

      <FocusBoundary
        id="mod-list-grid"
        trapFocus={controller.focus.trapFocus}
        onEscape={controller.focus.handleCancelHierarchy}
        defaultFocusKey={controller.focus.defaultFocusKey}
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1 pt-[2px]"
      >
        <FocusItem focusKey={LIST_GUARD_TOP} onFocus={() => controller.focus.restoreSafeFocus('first')}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute left-0 top-0 h-px w-full opacity-0"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <FocusItem focusKey={LIST_GUARD_BOTTOM} onFocus={() => controller.focus.restoreSafeFocus('last')}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <FocusItem focusKey={LIST_GUARD_LEFT} onFocus={() => controller.focus.restoreSafeFocus()}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute left-0 top-0 h-full w-px opacity-0"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <FocusItem focusKey={LIST_GUARD_RIGHT} onFocus={() => controller.focus.restoreSafeFocus()}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute right-0 top-0 h-full w-px opacity-0"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <FocusItem focusKey={LIST_ENTRY_FOCUS_KEY} onFocus={() => controller.focus.restoreSafeFocus('first')}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none h-px w-full opacity-0"
            />
          )}
        </FocusItem>

        {shouldShowSkeleton || controller.state.showInitialLoading ? (
          <ModListSkeleton listTheme={listTheme} />
        ) : controller.state.showEmptyState ? (
          <ModListEmptyState variant="empty" emptyMessage={emptyMessage} listTheme={listTheme} />
        ) : controller.state.showFilteredEmptyState ? (
          <ModListEmptyState variant="filtered" listTheme={listTheme} />
        ) : (
          <ModAccordionVirtualList
            renderEntries={controller.state.renderEntries}
            listTheme={listTheme}
            onRangeChanged={controller.controls.onRangeChanged}
            getGroupHeaderFocusKey={controller.focus.getGroupHeaderFocusKey}
            onToggleGroup={controller.controls.onToggleGroup}
            onGroupArrowPress={controller.focus.handleRowArrow}
            getRowProps={controller.getRowProps}
          />
        )}
      </FocusBoundary>

      {/* 底部浮动多选操作栏 Overlay (仅在有选中项时弹出) */}
      <div
        className={`pointer-events-none absolute inset-x-0 bottom-5 z-50 flex justify-center px-6 transition-all duration-200 ease-out ${
          selectedMods.size > 0 ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
        }`}
      >
        <div
          className={`flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-3 border-[0.1875rem] border-[#1E1E1F] px-4 py-2.5 transition-all duration-200 ${
            listTheme === 'light'
              ? 'bg-[#D0D1D4] text-[#111214] shadow-[0_1rem_2.25rem_rgba(0,0,0,0.3),inset_0_0.125rem_0_rgba(255,255,255,0.7),inset_0_-0.25rem_0_#A9ABAE]'
              : 'bg-[#313233] text-white shadow-[0_1rem_2.25rem_rgba(0,0,0,0.5),inset_0_0.125rem_0_rgba(255,255,255,0.14),inset_0_-0.25rem_0_rgba(0,0,0,0.28)]'
          } ${
            selectedMods.size > 0 ? 'pointer-events-auto scale-100' : 'pointer-events-none scale-95'
          }`}
        >
          <div className="flex h-9 min-w-[8rem] items-center gap-2.5 border-2 border-[#1E1E1F] bg-[#1E1E1F] px-3 text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
            <CheckSquare size={16} className="text-[#57D38C]" />
            <div className="font-minecraft text-sm leading-none">
              已选择 <span className="text-[#57D38C] font-bold">{selectedMods.size}</span> 项
            </div>
          </div>

          <OreButton
            focusKey="mod-btn-batch-enable"
            variant="secondary"
            size="auto"
            onClick={onBatchEnable}
            className="!h-9"
          >
            <Power size={13} className="mr-1 text-[#57D38C]" />
            全部启用
          </OreButton>

          <OreButton
            focusKey="mod-btn-batch-disable"
            variant="secondary"
            size="auto"
            onClick={onBatchDisable}
            className="!h-9"
          >
            <Power size={13} className="mr-1 opacity-50" />
            全部禁用
          </OreButton>

          {onBatchFavorite && (
            <OreButton
              focusKey="mod-btn-batch-favorite"
              variant="secondary"
              size="auto"
              onClick={onBatchFavorite}
              className="!h-9"
            >
              <Star size={13} className="mr-1 text-[#E5B54E]" />
              收藏
            </OreButton>
          )}

          <OreButton
            focusKey="mod-btn-batch-delete"
            variant="danger"
            size="auto"
            onClick={onBatchDelete}
            className="!h-9"
          >
            <Trash2 size={13} className="mr-1" />
            删除
          </OreButton>

          <OreButton
            focusKey="mod-btn-batch-clear"
            variant="ghost"
            size="auto"
            onClick={onExitBatchMode}
            title="取消选择"
            className={`!h-9 !w-9 !min-w-0 !border-[#1E1E1F] !px-0 shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.32),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.12)] ${
              listTheme === 'light'
                ? '!bg-[#C2C4C9] !text-[#313233] hover:!bg-[#DDE0E3] hover:!text-[#111214]'
                : '!bg-[#48494A] !text-[#D0D1D4] hover:!bg-[#58585A] hover:!text-white'
            }`}
          >
            <X size={16} />
          </OreButton>
        </div>
      </div>
    </div>
  );
};
