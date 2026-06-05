import React, { useMemo, useRef } from 'react';
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso';

import { useInputMode } from '../../../../../../../ui/focus/FocusProvider';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../ui/primitives/OreOverlayScrollArea';
import { ModListGroupHeader } from './ModListGroupHeader';
import { ModRowItem } from './ModRowItem';
import { type ModListRenderEntry, type ModGroupId, type ModListTheme } from '../../modListShared';
import type { ModMeta } from '../../../../../logic/modService';

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

const ModListOverlayScroller = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({
  children,
  className = '',
  style,
  ...props
}, ref) => (
  <OreOverlayScrollArea
    {...props}
    ref={ref}
    className={`h-full ${className}`}
    viewportClassName="w-full"
    contentClassName="w-full"
    style={style}
    safeInsetTop={4}
    safeInsetBottom={4}
    safeInsetRight={2}
    contentSafePaddingRight={0}
  >
    {children}
  </OreOverlayScrollArea>
));
ModListOverlayScroller.displayName = 'ModListOverlayScroller';

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

  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const inputMode = useInputMode();

  const handleItemFocus = (index: number) => {
    if (inputMode !== 'mouse') {
      virtuosoRef.current?.scrollToIndex({
        index,
        align: 'center',
        behavior: 'smooth'
      });
    }
  };

  const renderGroupHeader = (index: number, entry: GroupEntry) => {
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
          <div ref={ref as React.RefObject<HTMLDivElement>} className={listTheme === 'light' ? 'bg-[#A9ABAE]' : 'bg-[#111318]'}>
            <ModListGroupHeader
              group={group}
              collapsed={collapsed}
              focused={focused}
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

  const VirtuosoItem = useMemo(() => {
    const Component = ({ children, item, style, ...props }: any) => {
      const isGroupHead = item?.type === 'group';
      const itemStyle = isGroupHead
        ? {
            ...style,
            position: 'sticky' as const,
            top: 0,
            zIndex: 40,
            width: '100%'
          }
        : {
            ...style,
            width: '100%'
          };

      return (
        <div
          {...props}
          style={itemStyle}
          className={isGroupHead ? (listTheme === 'light' ? 'bg-[#A9ABAE]' : 'bg-[#111318]') : undefined}
        >
          {children}
        </div>
      );
    };
    Component.displayName = 'VirtuosoItem';
    return Component;
  }, [listTheme]);

  return (
    <Virtuoso
      ref={virtuosoRef}
      className="h-full mod-list-scrollport"
      style={{
        height: '100%',
        overscrollBehaviorY: 'contain'
      }}
      data={renderEntries}
      increaseViewportBy={{ top: 640, bottom: 960 }}
      overscan={{ main: 420, reverse: 260 }}
      atTopThreshold={0}
      atTopStateChange={onTopStateChange}
      rangeChanged={onRangeChanged}
      computeItemKey={(_index, entry) => (
        entry.type === 'group' ? `group-${entry.group.id}` : entry.mod.fileName
      )}
      itemContent={renderEntry}
      components={{
        Scroller: ModListOverlayScroller,
        Item: VirtuosoItem
      }}
    />
  );
};
