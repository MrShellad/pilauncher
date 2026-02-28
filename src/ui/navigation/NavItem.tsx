// src/ui/navigation/NavItem.tsx
import React, { useEffect } from 'react';
import { FocusItem } from '../focus/FocusItem';
import { useInputMode } from '../focus/FocusProvider';

export interface NavItemProps {
  id: string;
  boundaryId: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  onSelect: () => void;
  onPreview?: () => void; // ✨ 核心：用于接收预览事件
}

export const NavItem: React.FC<NavItemProps> = ({ 
  id, label, icon: Icon, isActive, onSelect, onPreview 
}) => {
  // 引入全局输入模式，用于判断当前是“手柄/键盘”还是“鼠标”
  const inputMode = useInputMode();

  return (
    <FocusItem focusKey={id} onEnter={onSelect}>
      {({ ref, focused }) => {
        
        // ✅ 核心魔法：当焦点停留在该项，且【非鼠标模式】时，触发右侧无感即时预览！
        // 这样手柄玩家上下推摇杆时，右边页面会跟着变，但焦点还在左边。
        useEffect(() => {
          if (focused && inputMode !== 'mouse' && onPreview) {
            onPreview();
          }
        }, [focused, inputMode, onPreview]);

        return (
          <button
            ref={ref as React.RefObject<HTMLButtonElement>} // 对接 FocusItem 传来的 ref
            onClick={() => {
              // 鼠标点击时，同时触发预览和选中深入
              if (onPreview) onPreview();
              onSelect();
            }}
            className={`
              w-full flex items-center px-6 py-4 outline-none transition-all duration-200 font-minecraft border-l-[4px]
              ${isActive ? 'bg-[#2A2A2C] text-white border-ore-green shadow-sm' : 'text-ore-text-muted border-transparent hover:bg-white/5 hover:text-white'}
              ${focused ? 'ring-2 ring-white ring-inset brightness-110' : ''}
            `}
          >
            <Icon size={20} className={`mr-3 ${isActive ? 'text-ore-green' : ''}`} />
            <span className="text-lg drop-shadow-sm tracking-wide">{label}</span>
          </button>
        );
      }}
    </FocusItem>
  );
};