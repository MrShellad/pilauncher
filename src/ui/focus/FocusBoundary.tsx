// src/ui/focus/FocusBoundary.tsx
import React, { useEffect, createContext } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';
import { focusManager } from './FocusManager';

// ✅ 新增：创建一个上下文，把 Boundary 的 ID 传递给内部的 Item
export const BoundaryContext = createContext<string | null>(null);

interface FocusBoundaryProps {
  id: string;
  className?: string;
  children: React.ReactNode;
  trapFocus?: boolean;
  onEscape?: () => void;
}

export const FocusBoundary: React.FC<FocusBoundaryProps> = ({
  id, className, children, trapFocus = false, onEscape
}) => {
  const { ref, focusKey, focused, hasFocusedChild } = useFocusable({
    focusable: true,
    focusKey: id,
    isFocusBoundary: trapFocus,
  });

  // ✅ 核心机制 1：当边界组件挂载时，尝试自动恢复之前的焦点记忆
  useEffect(() => {
    const timer = setTimeout(() => {
      // 只有在当前边界内部没有活跃焦点时，才触发恢复逻辑
      if (!focused && !hasFocusedChild) {
        focusManager.restoreFocus(id);
      }
    }, 50); // 给 DOM 渲染留一点时间
    return () => clearTimeout(timer);
  }, [id]);

  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (focused || hasFocusedChild) {
          const activeEl = document.activeElement as HTMLElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.blur();
            return; 
          }
          if (onEscape) onEscape();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [focused, hasFocusedChild, onEscape]);

  return (
    // ✅ 注入 BoundaryContext
    <BoundaryContext.Provider value={id}>
      <FocusContext.Provider value={focusKey}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </FocusContext.Provider>
    </BoundaryContext.Provider>
  );
};