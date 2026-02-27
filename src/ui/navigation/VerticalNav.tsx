// src/ui/navigation/VerticalNav.tsx
import React, { useEffect } from 'react';
import { FocusBoundary } from '../focus/FocusBoundary';

// ✅ 修复：将 NavItem (组件) 和 NavItemProps (类型) 分开导入，并加上 type 关键字
import { NavItem } from './NavItem';
import type { NavItemProps } from './NavItem';

import { focusManager } from '../focus/FocusManager';

interface VerticalNavProps {
  boundaryId: string; // 如 "sidebar-instances"
  items: Omit<NavItemProps, 'isActive' | 'onSelect' | 'boundaryId'>[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const VerticalNav: React.FC<VerticalNavProps> = ({ 
  boundaryId, items, activeId, onSelect, className = '' 
}) => {

  // 组件挂载时，尝试恢复该侧边栏上次的焦点
  useEffect(() => {
    // 默认焦点给当前激活的项
    focusManager.restoreFocus(boundaryId, activeId);
  }, [boundaryId, activeId]);

  return (
    <FocusBoundary id={boundaryId} className={`flex flex-col overflow-y-auto custom-scrollbar ${className}`}>
      {items.map(item => (
        <NavItem
          key={item.id}
          id={item.id}
          boundaryId={boundaryId}
          label={item.label}
          icon={item.icon}
          isActive={activeId === item.id}
          onSelect={() => onSelect(item.id)}
        />
      ))}
    </FocusBoundary>
  );
};