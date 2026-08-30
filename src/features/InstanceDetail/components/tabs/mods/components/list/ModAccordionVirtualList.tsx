import React, { useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import { useInputMode } from '../../../../../../../ui/focus/FocusProvider';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../ui/primitives/OreOverlayScrollArea';
import { ModListGroupHeader } from './ModListGroupHeader';
import { ModRowItem } from './ModRowItem';
import { type ModListRenderEntry, type ModGroupId, type ModListTheme } from '../../modListShared';
import type { ModMeta } from '../../../../../logic/modService';

const GROUP_HEADER_HEIGHT = 36;
const MOD_ROW_HEIGHT = 72;

type GroupEntry = Extract<ModListRenderEntry, { type: 'group' }>;
type ModRowPropsFromController = Omit<
  React.ComponentProps<typeof ModRowItem>,
  'listTheme' | 'onFocusRenderIndex'
>;

interface ModAccordionVirtualListProps {
  renderEntries: ModListRenderEntry[];
  listTheme: ModListTheme;
  onTopStateChange?: (atTop: boolean) => void;
  onRangeChanged: (range: { startIndex: number; endIndex: number }) => void;
  getGroupHeaderFocusKey: (groupId: ModGroupId) => string;
  onToggleGroup: (groupId: ModGroupId) => void;
  onGroupArrowPress: (direction: string) => boolean;
  getRowProps: (mod: ModMeta, rowIndex: number) => ModRowPropsFromController;
}

const getAccordionHeaderId = (groupId: ModGroupId) => `mod-accordion-header-${groupId}`;
const getAccordionPanelId = (groupId: ModGroupId) => `mod-accordion-panel-${groupId}`;

export const ModAccordionVirtualList: React.FC<ModAccordionVirtualListProps> = ({
  renderEntries,
  listTheme,
  onTopStateChange,
  onRangeChanged,
  getGroupHeaderFocusKey,
  onToggleGroup,
  onGroupArrowPress,
  getRowProps
}) => {
  const groupEntries = useMemo(() => {
    return renderEntries.filter((entry): entry is GroupEntry => entry.type === 'group');
  }, [renderEntries]);

  const groupEntryById = useMemo(() => {
    return new Map(groupEntries.map((entry) => [entry.group.id, entry]));
  }, [groupEntries]);

  const parentRef = useRef<HTMLDivElement>(null);
  const inputMode = useInputMode();

  const rowVirtualizer = useVirtualizer({
    count: renderEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const entry = renderEntries[index];
      return entry?.type === 'group' ? GROUP_HEADER_HEIGHT : MOD_ROW_HEIGHT;
    },
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  const handleItemFocus = (index: number) => {
    if (inputMode !== 'mouse') {
      rowVirtualizer.scrollToIndex(index, {
        align: 'center',
      });
    }
  };

  useEffect(() => {
    if (virtualItems.length > 0) {
      onRangeChanged({
        startIndex: virtualItems[0].index,
        endIndex: virtualItems[virtualItems.length - 1].index,
      });
    }
  }, [virtualItems, onRangeChanged]);

  useEffect(() => {
    onTopStateChange?.((rowVirtualizer.scrollOffset ?? 0) <= 0);
  }, [rowVirtualizer.scrollOffset, onTopStateChange]);

  const renderGroupHeader = (index: number, entry: GroupEntry, isSticky = false) => {
    const { group, collapsed } = entry;

    return (
      <FocusItem
        focusKey={getGroupHeaderFocusKey(group.id)}
        onEnter={() => onToggleGroup(group.id)}
        onArrowPress={onGroupArrowPress}
        onFocus={() => handleItemFocus(index)}
        autoScroll={false}
      >
        {({ ref, focused }) => (
          <div ref={ref as React.RefObject<HTMLDivElement>} className={listTheme === 'light' ? 'bg-[#A9ABAE]' : 'bg-[#13151A]'}>
            <ModListGroupHeader
              group={group}
              collapsed={collapsed}
              focused={focused && !isSticky}
              listTheme={listTheme}
              headerId={getAccordionHeaderId(group.id)}
              panelId={getAccordionPanelId(group.id)}
              onToggle={onToggleGroup}
            />
          </div>
        )}
      </FocusItem>
    );
  };

  const renderEntry = (index: number, entry: ModListRenderEntry) => {
    if (entry.type === 'group') {
      return renderGroupHeader(index, entry);
    }

    const fallbackGroup = groupEntryById.get(entry.groupId)?.group;
    const owningGroup = fallbackGroup;
    const isFirstGroupItem = owningGroup?.mods[0]?.fileName === entry.mod.fileName;

    return (
      <div
        id={owningGroup && isFirstGroupItem ? getAccordionPanelId(owningGroup.id) : undefined}
        role="group"
        aria-labelledby={owningGroup ? getAccordionHeaderId(owningGroup.id) : undefined}
      >
        <ModRowItem
          {...getRowProps(entry.mod, entry.rowIndex)}
          listTheme={listTheme}
          onFocusRenderIndex={() => handleItemFocus(index)}
        />
      </div>
    );
  };

  // Sticky header computation: 仅在分组标题滚出视口顶端时才激活悬浮吸顶
  const activeStickyEntry = useMemo(() => {
    if (virtualItems.length === 0) return null;
    const offset = rowVirtualizer.scrollOffset ?? 0;
    
    const firstVisible = virtualItems[0];
    const firstEntry = renderEntries[firstVisible.index];
    if (!firstEntry) return null;

    let groupIndex = -1;
    if (firstEntry.type === 'group') {
      // 若首个可见项本身就是分组标题且还未被向上完全滚出视口，则无需吸顶覆盖
      if (offset <= firstVisible.start) {
        return null;
      }
      groupIndex = firstVisible.index;
    } else {
      groupIndex = renderEntries.findIndex(
        (e) => e.type === 'group' && e.group.id === firstEntry.groupId
      );
    }

    if (groupIndex === -1) return null;
    const groupVirtualItem = virtualItems.find((v) => v.index === groupIndex);
    
    // 若该分组标题仍在正常视口内，不需要重复悬浮渲染
    if (groupVirtualItem && groupVirtualItem.start >= offset) {
      return null;
    }

    return {
      index: groupIndex,
      entry: renderEntries[groupIndex] as GroupEntry,
    };
  }, [virtualItems, renderEntries, rowVirtualizer.scrollOffset]);

  const stickyStyle = useMemo(() => {
    if (!activeStickyEntry) return null;
    const offset = rowVirtualizer.scrollOffset ?? 0;

    const nextVisibleGroup = virtualItems.find(
      (item) => item.index > activeStickyEntry.index && renderEntries[item.index]?.type === 'group'
    );

    let translateY = 0;
    if (nextVisibleGroup) {
      const nextStart = nextVisibleGroup.start;
      const space = nextStart - offset;
      if (space < GROUP_HEADER_HEIGHT) {
        translateY = space - GROUP_HEADER_HEIGHT;
      }
    }

    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      transform: `translateY(${translateY}px)`,
      zIndex: 40,
    };
  }, [activeStickyEntry, virtualItems, renderEntries, rowVirtualizer.scrollOffset]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <OreOverlayScrollArea
        ref={parentRef}
        className="h-full mod-list-scrollport"
        viewportClassName="overscroll-contain"
        style={{
          height: '100%',
        }}
        safeInsetTop={0}
        safeInsetBottom={0}
        safeInsetRight={0}
        contentSafePaddingRight={0}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualRow) => {
            const index = virtualRow.index;
            const entry = renderEntries[index];
            if (!entry) return null;

            const isGroupHead = entry.type === 'group';
            const itemStyle = {
              position: 'absolute' as const,
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
              zIndex: isGroupHead ? 30 : 10,
            };

            return (
              <div
                key={virtualRow.key}
                ref={rowVirtualizer.measureElement}
                data-index={index}
                style={itemStyle}
                className={isGroupHead ? (listTheme === 'light' ? 'bg-[#A9ABAE]' : 'bg-[#13151A]') : undefined}
              >
                {renderEntry(index, entry)}
              </div>
            );
          })}
        </div>
      </OreOverlayScrollArea>

      {/* Floating Sticky Header Overlay */}
      {activeStickyEntry && stickyStyle && (
        <div style={stickyStyle}>
          {renderGroupHeader(activeStickyEntry.index, activeStickyEntry.entry, true)}
        </div>
      )}
    </div>
  );
};
