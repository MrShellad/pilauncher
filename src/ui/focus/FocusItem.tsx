// src/ui/focus/FocusItem.tsx
import React, { useEffect, useRef, useContext } from 'react';
import { useFocusable, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useInputMode } from './FocusProvider'; 
import { BoundaryContext } from './FocusBoundary'; 
import { focusManager } from './FocusManager';     

interface FocusItemRenderProps {
  ref: React.RefObject<any>;
  focused: boolean;          
  hasFocusedChild: boolean;  
}

interface FocusItemProps {
  focusKey?: string;         
  disabled?: boolean;
  focusable?: boolean;       
  onEnter?: () => void;      
  onFocus?: () => void;      
  onArrowPress?: (direction: string) => boolean | void;
  children: (props: FocusItemRenderProps) => React.ReactNode; 
  autoScroll?: boolean;
  defaultFocused?: boolean;  
}

export const FocusItem: React.FC<FocusItemProps> = ({
  focusKey,
  disabled = false,
  focusable = true,
  onEnter,
  onFocus,
  onArrowPress,
  children,
  autoScroll = true,
  defaultFocused = false,    
}) => {
  const contextValue = useContext(BoundaryContext);
  const boundaryId = typeof contextValue === 'string' ? contextValue : contextValue?.id;
  const isBoundaryActive = typeof contextValue === 'object' ? contextValue?.isActive ?? true : true;

  const { ref, focused, hasFocusedChild, focusKey: resolvedFocusKey } = useFocusable({
    // 当所处页面被 hidden 时，强制剥夺所有元素的聚焦能力
    focusable: focusable && !disabled && isBoundaryActive, 
    focusKey: focusKey,
    onEnterPress: onEnter,
    onArrowPress: (direction) => onArrowPress?.(direction) ?? true,
  });

  const inputMode = useInputMode();
  
  // ✅ 核心修复：如果是鼠标模式，强制向 UI 屏蔽视觉焦点，但底层记忆依然生效！
  const isVisualFocused = focused && inputMode !== 'mouse';

  const onFocusRef = useRef(onFocus);
  useEffect(() => { onFocusRef.current = onFocus; }, [onFocus]);

  useEffect(() => {
    if (boundaryId && resolvedFocusKey) {
      focusManager.seedFocus(boundaryId, resolvedFocusKey);
    }
  }, [boundaryId, resolvedFocusKey]);

  useEffect(() => {
    // 记忆存留使用真实的 focused，不被鼠标模式干扰
    if (focused && isBoundaryActive) {
      if (onFocusRef.current) onFocusRef.current();
      if (boundaryId && resolvedFocusKey) {
        focusManager.saveFocus(boundaryId, resolvedFocusKey);
      }
    }
  }, [focused, boundaryId, resolvedFocusKey, isBoundaryActive]);

  useEffect(() => {
    if (autoScroll && focused && inputMode !== 'mouse' && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focused, inputMode, autoScroll]);

  useEffect(() => {
    if (defaultFocused && resolvedFocusKey && isBoundaryActive) {
      const timer = setTimeout(() => setFocus(resolvedFocusKey), 50);
      return () => clearTimeout(timer);
    }
  }, [defaultFocused, resolvedFocusKey, isBoundaryActive]);

  // ✅ 传给 OreButton / OreList 等 UI 组件的将是严格过滤过的视觉状态
  return children({ ref: ref as React.RefObject<any>, focused: isVisualFocused, hasFocusedChild });
};
