// src/ui/navigation/NavItem.tsx
import React from 'react';
import { FocusItem } from '../focus/FocusItem';

export interface NavItemProps {
  id: string;
  boundaryId: string; // 传给 FocusItem 用于记录历史
  label: string;
  icon: React.FC<any>;
  isActive: boolean;
  onSelect: () => void;
}

export const NavItem: React.FC<NavItemProps> = ({ 
  id, boundaryId, label, icon: Icon, isActive, onSelect 
}) => {
  return (
    <FocusItem 
      focusKey={id} 
      boundaryId={boundaryId} 
      onEnter={onSelect}
    >
      {/* 接收底层抛出的 ref 和 focused 状态进行渲染 */}
      {({ ref, focused }) => (
        <button
          ref={ref}
          onClick={onSelect}
          className={`
            flex items-center w-full px-5 py-3 text-sm font-minecraft transition-all relative outline-none
            ${isActive ? 'text-white bg-[#2A2A2C]' : 'text-ore-text-muted hover:text-white hover:bg-[#1E1E1F]'}
            /* 焦点高亮：纯粹的 CSS 驱动 */
            ${focused ? 'ring-2 ring-inset ring-white bg-[#363638] z-10 brightness-110' : ''}
          `}
        >
          {isActive && (
            <div className="absolute left-0 top-0 w-1 h-full bg-ore-green shadow-[0_0_8px_rgba(56,133,39,0.8)]" />
          )}
          <Icon size={16} className={`mr-3 ${isActive ? 'text-ore-green' : 'opacity-70'} ${focused ? 'animate-pulse' : ''}`} />
          {label}
        </button>
      )}
    </FocusItem>
  );
};