import React, { useEffect, useState } from 'react';

import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { type ModSortOrder, type ModSortType } from '../../../../../hooks/useModManager';
import type { ModMeta } from '../../../../../logic/modService';
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
import { useModListController } from '../../hooks/useModListController';

export interface ModListProps {
  mods: ModMeta[];
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
  onExitBatchMode: () => void;
  onCheckModUpdates: () => void;
  isCheckingModUpdates: boolean;
  emptyMessage?: string;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
  onTopBarCollapseChange?: (collapsed: boolean) => void;
}

export const ModList: React.FC<ModListProps> = ({
  mods,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onUpgradeMod,
  onSelectMod,
  onDeleteMod,
  isBatchMode,
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
  onExitBatchMode,
  onCheckModUpdates,
  isCheckingModUpdates,
  emptyMessage = '当前没有可用模组。',
  onNavigateOut,
  onTopBarCollapseChange
}) => {
  const [listTheme, setListTheme] = useState<ModListTheme>('dark');
  const controller = useModListController({
    mods,
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

  useEffect(() => {
    if (
      controller.state.showInitialLoading ||
      controller.state.showEmptyState ||
      controller.state.showFilteredEmptyState
    ) {
      onTopBarCollapseChange?.(false);
    }
  }, [
    controller.state.showEmptyState,
    controller.state.showFilteredEmptyState,
    controller.state.showInitialLoading,
    onTopBarCollapseChange
  ]);

  return (
    <div
      data-mod-list-theme={listTheme}
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden text-[1.0625rem] transition-colors ${
        listTheme === 'light' ? 'text-[#111214]' : 'text-white'
      }`}
      style={{ fontFamily: 'var(--ore-global-font, "Minecraft"), "NotoSans Bold", "Noto Sans SC", sans-serif' }}
    >
      <ModListOverlay visible={controller.state.showSyncingOverlay} />

      <ModListHeader
        stats={controller.state.stats}
        isBatchMode={isBatchMode}
        searchQuery={searchQuery}
        searchPlaceholder={searchPlaceholder}
        quickFilter={controller.state.quickFilter}
        filterOptions={controller.state.filterOptions}
        viewMode={controller.state.viewMode}
        onHeaderArrowPress={onHeaderArrowPress}
        onSearchQueryChange={onSearchQueryChange}
        onClearSearch={onClearSearch}
        onBatchEnable={onBatchEnable}
        onBatchDisable={onBatchDisable}
        onBatchDelete={onBatchDelete}
        onExitBatchMode={onExitBatchMode}
        onCheckModUpdates={onCheckModUpdates}
        isCheckingModUpdates={isCheckingModUpdates}
        onQuickFilterChange={controller.controls.onQuickFilterChange}
        onViewModeChange={controller.controls.onViewModeChange}
        listTheme={listTheme}
        onThemeChange={setListTheme}
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
        className="relative pt-[2px] min-h-[18rem] flex-1 overflow-hidden px-2 pb-1"
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

        {controller.state.showInitialLoading ? (
          <ModListEmptyState variant="loading" listTheme={listTheme} />
        ) : controller.state.showEmptyState ? (
          <ModListEmptyState variant="empty" emptyMessage={emptyMessage} listTheme={listTheme} />
        ) : controller.state.showFilteredEmptyState ? (
          <ModListEmptyState variant="filtered" listTheme={listTheme} />
        ) : (
          <ModAccordionVirtualList
            renderEntries={controller.state.renderEntries}
            listTheme={listTheme}
            onTopStateChange={(atTop) => {
              onTopBarCollapseChange?.(!atTop);
            }}
            onRangeChanged={controller.controls.onRangeChanged}
            getGroupHeaderFocusKey={controller.focus.getGroupHeaderFocusKey}
            onToggleGroup={controller.controls.onToggleGroup}
            onGroupArrowPress={controller.focus.handleRowArrow}
            getRowProps={controller.getRowProps}
          />
        )}
      </FocusBoundary>
    </div>
  );
};
