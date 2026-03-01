// src/ui/focus/FocusItem.tsx
import React, { useEffect, useRef } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { useInputMode } from './FocusProvider'; 

interface FocusItemRenderProps {
  ref: React.RefObject<any>;
  focused: boolean;          
  hasFocusedChild: boolean;  
}

interface FocusItemProps {
  focusKey?: string;         
  disabled?: boolean;        
  onEnter?: () => void;      
  onFocus?: () => void;      // ✅ 新增：光环聚焦到当前元素时的回调
  children: (props: FocusItemRenderProps) => React.ReactNode; 
  autoScroll?: boolean;
}

export const FocusItem: React.FC<FocusItemProps> = ({
  focusKey,
  disabled = false,
  onEnter,
  onFocus,
  children,
  autoScroll = true,
}) => {
  const { ref, focused, hasFocusedChild } = useFocusable({
    focusable: !disabled, 
    focusKey: focusKey,
    onEnterPress: onEnter,
  });

  const inputMode = useInputMode();

  // ✅ 使用 Ref 存储最新的 onFocus，防止 React 闭包陷阱或引发死循环
  const onFocusRef = useRef(onFocus);
  useEffect(() => { onFocusRef.current = onFocus; }, [onFocus]);

  // ✅ 当获得焦点时，触发回调
  useEffect(() => {
    if (focused && onFocusRef.current) {
      onFocusRef.current();
    }
  }, [focused]);

  // 全局虚拟焦点自动吸附可视区域
  useEffect(() => {
    if (autoScroll && focused && inputMode !== 'mouse' && ref.current) {
      ref.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'nearest',   
      });
    }
  }, [focused, inputMode, autoScroll]);

  // 视觉焦点遮罩：鼠标模式下隐藏光环
  const isVisualFocused = focused && inputMode !== 'mouse';
  const isVisualFocusedChild = hasFocusedChild && inputMode !== 'mouse';

  return (
    <>
      {children({ 
        ref, 
        focused: isVisualFocused, 
        hasFocusedChild: isVisualFocusedChild 
      })}
    </>
  );
};