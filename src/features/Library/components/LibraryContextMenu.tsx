import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../ui/focus/useLinearNavigation';

export type LibraryContextMenuGroup = 'primary' | 'secondary' | 'danger';

export interface LibraryContextMenuAction {
  id: string;
  label: string;
  icon: LucideIcon;
  group: LibraryContextMenuGroup;
  disabled?: boolean;
  onSelect: () => void;
}

export interface LibraryContextMenuAnchor {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface LibraryContextMenuPoint {
  x: number;
  y: number;
}

interface LibraryContextMenuProps {
  anchorRect: LibraryContextMenuAnchor;
  triggerPoint: LibraryContextMenuPoint;
  actions: LibraryContextMenuAction[];
  onClose: () => void;
}

const SAFE_MARGIN = 12;
const POINTER_GAP = 6;
const GROUP_ORDER: LibraryContextMenuGroup[] = ['primary', 'secondary', 'danger'];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const LibraryContextMenu: React.FC<LibraryContextMenuProps> = ({
  anchorRect,
  triggerPoint,
  actions,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(() => ({
    x: triggerPoint.x,
    y: triggerPoint.y,
    originX: 0,
    originY: 0,
    measured: false,
  }));

  const groups = useMemo(
    () => GROUP_ORDER
      .map((group) => ({
        group,
        actions: actions.filter((action) => action.group === group && !action.disabled),
      }))
      .filter((group) => group.actions.length > 0),
    [actions],
  );
  const visibleActions = useMemo(
    () => groups.flatMap((group) => group.actions),
    [groups],
  );
  const actionFocusKeys = useMemo(
    () => visibleActions.map((action) => `library-context-action-${action.id}`),
    [visibleActions],
  );
  const { handleLinearArrow } = useLinearNavigation(
    actionFocusKeys,
    actionFocusKeys[0],
    true,
    groups.length > 0,
  );

  useLayoutEffect(() => {
    if (groups.length === 0) return;

    const menu = menuRef.current;
    if (!menu) return;

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = triggerPoint.x + POINTER_GAP;
    let y = triggerPoint.y + POINTER_GAP;

    if (x + rect.width > viewportWidth - SAFE_MARGIN) {
      x = triggerPoint.x - rect.width - POINTER_GAP;
    }
    if (y + rect.height > viewportHeight - SAFE_MARGIN) {
      y = triggerPoint.y - rect.height - POINTER_GAP;
    }

    x = clamp(
      x,
      SAFE_MARGIN,
      viewportWidth - rect.width - SAFE_MARGIN,
    );
    y = clamp(
      y,
      SAFE_MARGIN,
      viewportHeight - rect.height - SAFE_MARGIN,
    );

    setPosition({
      x,
      y,
      originX: clamp(triggerPoint.x - x, 0, rect.width),
      originY: clamp(triggerPoint.y - y, 0, rect.height),
      measured: true,
    });
  }, [anchorRect, groups.length, triggerPoint]);

  useEffect(() => {
    if (groups.length === 0) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', onClose, true);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', onClose, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [groups.length, onClose]);

  if (groups.length === 0) return null;

  return (
    <FocusBoundary
      id="library-context-menu"
      trapFocus
      onEscape={onClose}
      defaultFocusKey={actionFocusKeys[0]}
    >
      <motion.div
        ref={menuRef}
        className="fixed z-[120] w-[232px] border-2 border-[var(--ore-color-border-primary-strong)] bg-[var(--ore-color-background-surface-panel)] p-1 shadow-[0_12px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          left: position.x,
          top: position.y,
          opacity: position.measured ? undefined : 0,
          transformOrigin: `${position.originX}px ${position.originY}px`,
        }}
        initial={{ opacity: 0, scale: 0.86 }}
        animate={{ opacity: position.measured ? 1 : 0, scale: position.measured ? 1 : 0.86 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        onPointerDown={(event) => event.stopPropagation()}
        onContextMenu={(event) => event.preventDefault()}
      >
        {groups.map((group, groupIndex) => (
          <React.Fragment key={group.group}>
            {groupIndex > 0 && <div className="my-1 h-px bg-[var(--ore-library-contextMenu-divider)]" />}
            {group.actions.map((action) => {
              const Icon = action.icon;
              const isDanger = action.group === 'danger';
              return (
                <FocusItem
                  key={action.id}
                  focusKey={`library-context-action-${action.id}`}
                  onEnter={action.onSelect}
                  onArrowPress={handleLinearArrow}
                >
                  {({ ref, focused }) => (
                    <button
                      ref={ref as React.RefObject<HTMLButtonElement>}
                      type="button"
                      onClick={action.onSelect}
                      tabIndex={-1}
                      className={[
                        'flex min-h-9 w-full items-center gap-3 px-3 py-2 text-left font-minecraft text-xs outline-none transition-none',
                        isDanger
                          ? 'text-[var(--ore-color-text-danger-default)] hover:bg-[var(--ore-color-background-danger-subtle)]'
                          : 'text-[var(--ore-color-text-secondary-strong)] hover:bg-[var(--ore-color-background-surface-hover)]',
                        focused
                          ? isDanger
                            ? 'bg-[var(--ore-color-background-danger-subtle)] ring-2 ring-white/80'
                            : 'bg-[var(--ore-color-background-surface-hover)] ring-2 ring-white/80'
                          : '',
                      ].join(' ')}
                    >
                      <Icon className="h-[1.125rem] w-[1.125rem] shrink-0" />
                      <span className="min-w-0 truncate">{action.label}</span>
                    </button>
                  )}
                </FocusItem>
              );
            })}
          </React.Fragment>
        ))}
      </motion.div>
    </FocusBoundary>
  );
};
