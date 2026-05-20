import React from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { Virtuoso } from 'react-virtuoso';
import { useTranslation } from 'react-i18next';
import { VirtuosoScroller } from '../../../ui/primitives/OreOverlayScrollArea';

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

  return (
    <Virtuoso
      className="h-full custom-scrollbar"
      style={{
        height: '100%',
        overflowY: 'auto',
        overscrollBehaviorY: 'contain',
      }}
      data={items}
      components={{ Scroller: VirtuosoScroller }}
      computeItemKey={(_, item) => item.id}
      increaseViewportBy={{ top: 320, bottom: 720 }}
      itemContent={(index, item) => (
        <div
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
            event.dataTransfer.dropEffect = 'move';
          }}
          onDrop={(event) => {
            if (!sortMode) return;
            event.preventDefault();
            const sourceId = draggedItemId || event.dataTransfer.getData('text/plain');
            setDraggedItemId(null);
            if (!sourceId || sourceId === item.id) return;
            onPlaceItem?.(sourceId, item.id);
          }}
          onDragEnd={() => setDraggedItemId(null)}
        >
          <div className={['relative', sortMode ? 'cursor-grab active:cursor-grabbing' : ''].join(' ')}>
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
            onArrowPress={(direction) => onItemArrowPress?.(index, direction)}
            contextMenuActive={activeContextItemId === item.id}
          />
          </div>
        </div>
      )}
    />
  );
};
