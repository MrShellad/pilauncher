// src/ui/focus/FocusBoundary.tsx
import React from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

interface FocusBoundaryProps {
  id: string; // 必须的唯一标识，用于 FocusContext
  className?: string;
  children: React.ReactNode;
}

export const FocusBoundary: React.FC<FocusBoundaryProps> = ({ id, className, children }) => {
  // 注册一个 Boundary 节点
  const { ref, focusKey } = useFocusable({
    focusable: true,
    focusKey: id,
    isFocusBoundary: true, // 核心属性：阻止焦点意外逃逸
  });

  return (
    // 用 Provider 圈定上下文范围
    <FocusContext.Provider value={focusKey}>
      <div ref={ref} className={className}>
        {children}
      </div>
    </FocusContext.Provider>
  );
};