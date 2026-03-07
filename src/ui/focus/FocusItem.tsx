// src/ui/focus/FocusItem.tsx
import React, { useEffect, useRef, useContext } from 'react';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInputMode } from './FocusProvider'; 
import { BoundaryContext } from './FocusBoundary'; // ✅ 引入 BoundaryContext
import { focusManager } from './FocusManager';     // ✅ 引入 Manager

interface FocusItemRenderProps {
  ref: React.RefObject<any>;
  focused: boolean;          
  hasFocusedChild: boolean;  
}

interface FocusItemProps {
  focusKey?: string;         
  disabled?: boolean;        
  onEnter?: () => void;      
  onFocus?: () => void;      
  children: (props: FocusItemRenderProps) => React.ReactNode; 
  autoScroll?: boolean;
  defaultFocused?: boolean;  
}

export const FocusItem: React.FC<FocusItemProps> = ({
  focusKey,
  disabled = false,
  onEnter,
  onFocus,
  children,
  autoScroll = true,
  defaultFocused = false,    
}) => {
  const { ref, focused, hasFocusedChild, focusKey: resolvedFocusKey } = useFocusable({
    focusable: !disabled, 
    focusKey: focusKey,
    onEnterPress: onEnter,
  });

  const inputMode = useInputMode();
  const boundaryId = useContext(BoundaryContext); // ✅ 获取当前所属的边界 ID

  const onFocusRef = useRef(onFocus);
  useEffect(() => { onFocusRef.current = onFocus; }, [onFocus]);

  useEffect(() => {
    if (focused) {
      if (onFocusRef.current) {
        onFocusRef.current();
      }
      // ✅ 核心机制 2：只要拿到焦点，立刻在 Manager 中登记造册！
      if (boundaryId && resolvedFocusKey) {
        focusManager.saveFocus(boundaryId, resolvedFocusKey);
      }
    }
  }, [focused, boundaryId, resolvedFocusKey]);

  useEffect(() => {
    if (autoScroll && focused && inputMode !== 'mouse' && ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',  // ✅ 按你之前的要求，这里改成了 center，体验更好
      });
    }
  }, [focused, inputMode, autoScroll]);

  useEffect(() => {
    if (defaultFocused && resolvedFocusKey) {
      const timer = setTimeout(() => {
        setFocus(resolvedFocusKey);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [defaultFocused, resolvedFocusKey]);

  const isVisualFocused = focused && inputMode !== 'mouse';
  const isVisualFocusedChild = hasFocusedChild && inputMode !== 'mouse';

  return (
    <>
      {children({ 
        ref: ref as React.RefObject<any>, 
        focused: isVisualFocused, 
        hasFocusedChild: isVisualFocusedChild 
      })}
    </>
  );
};