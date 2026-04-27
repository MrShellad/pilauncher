import React from 'react';
import { Blocks, Loader2, RefreshCw } from 'lucide-react';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import type { ModMeta } from '../../../logic/modService';
import {
  LIST_ENTRY_FOCUS_KEY,
  LIST_GUARD_BOTTOM,
  LIST_GUARD_LEFT,
  LIST_GUARD_RIGHT,
  LIST_GUARD_TOP
} from './modListShared';
import { ModRowItem } from './ModRowItem';
import { useModListController } from './useModListController';

export interface ModListProps {
  mods: ModMeta[];
  isLoading: boolean;
  selectedMods: Set<string>;
  onToggleSelection: (fileName: string) => void;
  onToggleMod: (fileName: string, currentEnabled: boolean) => void;
  onSelectMod: (mod: ModMeta) => void;
  onDeleteMod: (fileName: string) => void;
  emptyMessage?: string;
  onNavigateOut?: (direction: 'up' | 'down') => boolean;
}

export const ModList: React.FC<ModListProps> = ({
  mods,
  isLoading,
  selectedMods,
  onToggleSelection,
  onToggleMod,
  onSelectMod,
  onDeleteMod,
  emptyMessage = '当前没有可用模组。',
  onNavigateOut
}) => {
  const controller = useModListController({
    mods,
    isLoading,
    selectedMods,
    onToggleSelection,
    onToggleMod,
    onSelectMod,
    onDeleteMod,
    onNavigateOut
  });

  if (controller.state.showInitialLoading) {
    return (
      <div className="flex justify-center px-4 py-12">
        <div
          className="flex items-center gap-3 border-[2px] px-4 py-3 font-minecraft text-sm text-[var(--ore-downloadDetail-labelText)]"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <Loader2 size={18} className="animate-spin text-ore-green" />
          正在加载模组...
        </div>
      </div>
    );
  }

  if (controller.state.showEmptyState) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div
          className="w-full max-w-xl rounded-sm border-[2px] px-6 py-10 text-center"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-sm border-[2px] text-[var(--ore-downloadDetail-labelText)]"
            style={{
              backgroundColor: 'var(--ore-downloadDetail-base)',
              borderColor: 'var(--ore-downloadDetail-divider)',
              boxShadow: 'var(--ore-downloadDetail-sectionInset)'
            }}
          >
            <Blocks size={22} />
          </div>
          <h3 className="font-minecraft text-base text-white">模组列表为空</h3>
          <p className="mt-2 text-sm text-[var(--ore-downloadDetail-labelText)]">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {controller.state.showSyncingOverlay && (
        <div
          className="absolute top-0 right-6 z-50 flex items-center rounded-b-md border-x-[2px] border-b-[2px] px-3 py-1.5 shadow-lg"
          style={{
            backgroundColor: 'var(--ore-downloadDetail-surface)',
            borderColor: 'var(--ore-downloadDetail-divider)',
            boxShadow: 'var(--ore-downloadDetail-sectionShadow)'
          }}
        >
          <RefreshCw size={14} className="mr-2 animate-spin text-ore-green" />
          <span className="text-xs font-minecraft text-[var(--ore-downloadDetail-labelText)]">正在同步模组...</span>
        </div>
      )}

      <FocusBoundary
        id="mod-list-grid"
        trapFocus={controller.focus.trapFocus}
        onEscape={controller.focus.handleCancelHierarchy}
        defaultFocusKey={controller.focus.defaultFocusKey}
        className="flex min-h-0 flex-1 flex-col space-y-1.5 overflow-y-auto custom-scrollbar px-2 pb-4"
      >
        <FocusItem focusKey={LIST_GUARD_TOP} onFocus={() => controller.focus.restoreSafeFocus('first')}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute top-0 left-0 h-px w-full opacity-0"
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
              className="pointer-events-none absolute top-0 left-0 h-full w-px opacity-0"
              tabIndex={-1}
            />
          )}
        </FocusItem>

        <FocusItem focusKey={LIST_GUARD_RIGHT} onFocus={() => controller.focus.restoreSafeFocus()}>
          {({ ref }) => (
            <div
              ref={ref as React.RefObject<HTMLDivElement>}
              className="pointer-events-none absolute top-0 right-0 h-full w-px opacity-0"
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

        {controller.state.visibleMods.map((mod) => (
          <ModRowItem
            key={mod.fileName}
            {...controller.getRowProps(mod)}
          />
        ))}

        {controller.incremental.hasMore && (
          <div
            ref={controller.incremental.sentinelRef}
            className="flex items-center justify-center gap-2 py-4 text-xs font-minecraft"
            style={{ color: 'var(--ore-downloadDetail-labelText)' }}
          >
            已显示 {Math.min(controller.incremental.visibleCount, mods.length)} / {mods.length}，滚动加载更多...
          </div>
        )}
      </FocusBoundary>
    </div>
  );
};
