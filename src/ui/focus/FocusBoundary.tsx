// src/ui/focus/FocusBoundary.tsx
import React from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

interface FocusBoundaryProps {
  id: string; 
  className?: string;
  children: React.ReactNode;
  // ✅ 1. 新增：是否将焦点锁死在容器内（焦点陷阱）
  trapFocus?: boolean; 
}

export const FocusBoundary: React.FC<FocusBoundaryProps> = ({ 
  id, className, children, trapFocus = false // 默认不锁死
}) => {
  const { ref, focusKey } = useFocusable({
    focusable: true,
    focusKey: id,
    // ✅ 2. 关键修复：不再写死 true，让侧边栏的焦点可以流向外部
    isFocusBoundary: trapFocus, 
  });

  return (
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </FocusContext.Provider>
  );
};