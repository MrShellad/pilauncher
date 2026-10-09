import React from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation } from 'react-i18next';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';

import type { LibraryDensity } from '../data/libraryPageData';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import type { ModSetTrackerItemStatus } from '../stores/useModSetTrackerStore';
import { LibraryItemCard } from './LibraryItemCard';

interface LibraryResourceListProps {
  items: LibraryResourceViewModel[];
  density: LibraryDensity;
  getTrackerStatus?: (item: LibraryResourceViewModel) => ModSetTrackerItemStatus | undefined;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>, item: LibraryResourceViewModel) => void;
  onOpenItem?: (item: LibraryResourceViewModel) => void;
  onItemArrowPress?: (index: number, direction: string) => boolean | void;
  activeContextItemId?: string;
  sortMode?: boolean;
  onMoveItem?: (itemId: string, direction: 'up' | 'down') => void;
  onPlaceItem?: (draggedItemId: string, targetItemId: string) => void;
}

export const LibraryResourceList: React.FC<LibraryResourceListProps> = ({
  items,
  density,
  getTrackerStatus,
  onContextMenu,
  onOpenItem,
  onItemArrowPress,
  activeContextItemId,
  sortMode = false,
  onMoveItem,
  onPlaceItem,
}) => {
  const { t } = useTranslation();
  const itemGapClass = density === 'compact' ? 'pb-3' : 'pb-5';
  const [draggedItemId, setDraggedItemId] = React.useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = React.useState<string | null>(null);

  const parentRef = React.useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => (density === 'compact' ? 120 : 160),
    overscan: 5,
  });

  const focusListIndex = React.useCallback((targetIndex: number, align: 'auto' | 'center' = 'auto') => {
    if (targetIndex < 0 || targetIndex >= items.length) return false;

    const targetFocusKey = `library-resource-${targetIndex}`;
    rowVirtualizer.scrollToIndex(targetIndex, { align });

    window.setTimeout(() => {
      if (doesFocusableExist(targetFocusKey)) {
        setFocus(targetFocusKey);
        return;
      }

      rowVirtualizer.scrollToIndex(targetIndex, { align: 'center' });
      window.setTimeout(() => {
        if (doesFocusableExist(targetFocusKey)) {
          setFocus(targetFocusKey);
        }
      }, 80);
    }, 0);

    return true;
  }, [items.length, rowVirtualizer]);

  const handleItemMoveFocus = React.useCallback((index: number, direction: string) => {
    if (direction === 'up') {
      return focusListIndex(index - 1);
    }

    if (direction === 'down') {
      return focusListIndex(index + 1);
    }

    return false;
  }, [focusListIndex]);

  return (
    <OreOverlayScrollArea
      ref={parentRef}
      className="h-full custom-scrollbar"
      style={{
        height: '100%',
        overscrollBehaviorY: 'contain',
      }}
      role="list"
      aria-label={t('libraryPage.listLabel', '收藏资源列表')}
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const index = virtualRow.index;
          const item = items[index];
          if (!item) return null;

          return (
            <div
              key={virtualRow.key}
              ref={rowVirtualizer.measureElement}
              data-index={index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                role="listitem"
                className={['px-5', index === 0 ? 'pt-5' : '', itemGapClass].join(' ')}
                draggable={sortMode}
                onDragStart={(event) => {
                  if (!sortMode) return;
                  setDraggedItemId(item.id);
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', item.id);
                }}
                onDragOver={(event) => {
                  if (!sortMode || !draggedItemId || draggedItemId === item.id) return;
                  event.preventDefault();
                  setDragOverItemId(item.id);
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDragLeave={() => setDragOverItemId(null)}
                onDrop={(event) => {
                  if (!sortMode) return;
                  event.preventDefault();
                  setDragOverItemId(null);
                  const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
                  setDraggedItemId(null);
                  if (!sourceId || sourceId === item.id) return;
                  onPlaceItem?.(sourceId, item.id);
                }}
                onDragEnd={() => {
                  setDraggedItemId(null);
                  setDragOverItemId(null);
                }}
              >
                <div className={['relative', sortMode ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}>
                  {sortMode && dragOverItemId === item.id && (
                    <div className="absolute inset-x-0 -top-2.5 h-1 border-2 border-dashed border-[var(--ore-color-border-warning-subtle)] bg-[var(--ore-color-background-warning-subtle)]/30 z-30 pointer-events-none" />
                  )}
                  {sortMode && (
                    <div className="absolute right-3 top-3 z-30 flex h-9 items-center gap-1 border-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-panel)] px-1.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3),0_4px_10px_rgba(0,0,0,0.28)]">
                      <div className="flex h-7 min-w-8 items-center justify-center gap-1 px-1 font-minecraft text-xs text-[var(--ore-color-text-secondary-soft)]">
                        <GripVertical className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
                        {index + 1}
                      </div>
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onMoveItem?.(item.id, 'up');
                        }}
                        className="flex h-7 w-7 items-center justify-center border-2 border-[var(--ore-color-border-primary-strong)] bg-[var(--ore-color-background-surface-raised)] text-[var(--ore-color-text-secondary-strong)] disabled:cursor-not-allowed disabled:opacity-35 hover:border-white hover:text-white"
                        title={t('libraryPage.sortMode.moveUp')}
                      >
                        <ArrowUp className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        disabled={index >= items.length - 1}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onMoveItem?.(item.id, 'down');
                        }}
                        className="flex h-7 w-7 items-center justify-center border-2 border-[var(--ore-color-border-primary-strong)] bg-[var(--ore-color-background-surface-raised)] text-[var(--ore-color-text-secondary-strong)] disabled:cursor-not-allowed disabled:opacity-35 hover:border-white hover:text-white"
                        title={t('libraryPage.sortMode.moveDown')}
                      >
                        <ArrowDown className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
                      </button>
                    </div>
                  )}
                  <LibraryItemCard
                    item={item}
                    density={density}
                    focusKey={`library-resource-${index}`}
                    trackerStatus={getTrackerStatus?.(item)}
                    onContextMenu={sortMode ? undefined : onContextMenu}
                    onOpen={onOpenItem}
                    onArrowPress={(direction) => {
                      if (handleItemMoveFocus(index, direction)) {
                        return false;
                      }
                      return onItemArrowPress?.(index, direction);
                    }}
                    contextMenuActive={activeContextItemId === item.id}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </OreOverlayScrollArea>
  );
};
