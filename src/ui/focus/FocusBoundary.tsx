// /src/ui/focus/FocusBoundary.tsx
import React, { useEffect } from 'react';
import { useFocusable, FocusContext } from '@noriginmedia/norigin-spatial-navigation';

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

  // ✅ 核心修复：使用全局冒泡监听，完美跨越 DOM 焦点丢失的限制
  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 只有当“空间焦点”真正在这个边界内部时，才响应 Esc
        if (focused || hasFocusedChild) {
          const activeEl = document.activeElement as HTMLElement;
          
          // 贴心细节：如果用户正在输入框里打字，ESC 仅用于取消输入框焦点，绝不触发退出层级
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
            activeEl.blur();
            return; 
          }
          
          if (onEscape) {
            onEscape();
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [focused, hasFocusedChild, onEscape]);

  return (
    <FocusContext.Provider value={focusKey}>
      {/* 移除原本失效的 onKeyDown */}
      <div ref={ref} className={className}>
        {children}
      </div>
    </FocusContext.Provider>
  );
};