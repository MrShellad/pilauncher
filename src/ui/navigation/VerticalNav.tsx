// /src/ui/navigation/VerticalNav.tsx
import React, { useEffect } from 'react';
import { FocusBoundary } from '../focus/FocusBoundary';
import { NavItem } from './NavItem';
import type { NavItemProps } from './NavItem';
import { focusManager } from '../focus/FocusManager';

interface VerticalNavProps {
  boundaryId: string;
  items: Omit<NavItemProps, 'isActive' | 'onSelect' | 'onPreview' | 'boundaryId'>[];
  activeId: string;
  onSelect: (id: string) => void;
  onPreview?: (id: string) => void;  // ✨ 新增
  onEscape?: () => void;             // ✨ 新增
  className?: string;
}

export const VerticalNav: React.FC<VerticalNavProps> = ({
  boundaryId, items, activeId, onSelect, onPreview, onEscape, className = ''
}) => {

  useEffect(() => {
    focusManager.restoreFocus(boundaryId, activeId);
  }, [boundaryId, activeId]);

  return (
    // ✅ 核心魔法 2：给侧边栏也绑定 onEscape，用于退出到上一级页面
    <FocusBoundary 
      id={boundaryId} 
      trapFocus={true} 
      onEscape={onEscape} 
      className={`flex flex-col overflow-y-auto custom-scrollbar ${className}`}
    >
      {items.map(item => (
        <NavItem
          key={item.id}
          id={item.id}
          boundaryId={boundaryId}
          label={item.label}
          icon={item.icon}
          isActive={activeId === item.id}
          onPreview={() => onPreview && onPreview(item.id)}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </FocusBoundary>
  );
};