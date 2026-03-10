// src/ui/focus/FocusBoundary.tsx
import React, { useEffect, createContext } from 'react';
import { FocusContext, useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { focusManager } from './FocusManager';

export const BoundaryContext = createContext<{ id: string | null; isActive: boolean }>({
  id: null,
  isActive: true
});

interface FocusBoundaryProps {
  id: string;
  className?: string;
  children: React.ReactNode;
  trapFocus?: boolean;
  onEscape?: () => void;
  isActive?: boolean;
  defaultFocusKey?: string;
}

export const FocusBoundary: React.FC<FocusBoundaryProps> = ({
  id,
  className,
  children,
  trapFocus = false,
  onEscape,
  isActive = true,
  defaultFocusKey
}) => {
  const { ref, focusKey, focused, hasFocusedChild } = useFocusable({
    // Boundary itself must never become a focus target.
    focusable: false,
    focusKey: id,
    isFocusBoundary: isActive && trapFocus
  });

  useEffect(() => {
    if (!isActive) return;

    const timer = setTimeout(() => {
      // If focus was forced onto boundary itself, redirect to remembered/default child.
      if (focused && !hasFocusedChild) {
        focusManager.restoreFocus(id, defaultFocusKey);
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [id, isActive, focused, hasFocusedChild, defaultFocusKey]);

  useEffect(() => {
    const handleGlobalEsc = (e: KeyboardEvent) => {
      if (!isActive) return;
      if (e.key !== 'Escape' || (!focused && !hasFocusedChild)) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        activeEl.blur();
        return;
      }

      onEscape?.();
    };

    window.addEventListener('keydown', handleGlobalEsc);
    return () => window.removeEventListener('keydown', handleGlobalEsc);
  }, [focused, hasFocusedChild, onEscape, isActive]);

  return (
    <BoundaryContext.Provider value={{ id, isActive }}>
      <FocusContext.Provider value={focusKey}>
        <div ref={ref} className={className} tabIndex={-1} style={{ outline: 'none' }}>
          {children}
        </div>
      </FocusContext.Provider>
    </BoundaryContext.Provider>
  );
};
