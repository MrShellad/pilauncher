// src/ui/focus/FocusItem.tsx
import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
// ✅ 1. 引入你之前写好的输入模式钩子
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
  children: (props: FocusItemRenderProps) => React.ReactNode; 
}

export const FocusItem: React.FC<FocusItemProps> = ({
  focusKey,
  disabled = false,
  onEnter,
  children
}) => {
  const { ref, focused, hasFocusedChild } = useFocusable({
    focusable: !disabled, 
    focusKey: focusKey,
    onEnterPress: onEnter,
  });

  // ✅ 2. 动态获取当前用户的输入外设状态
  const inputMode = useInputMode();

  // ✅ 3. 核心魔法：视觉焦点遮罩！
  // 只要当前是用“鼠标”在操作，哪怕底层空间焦点在这里，也强行对 UI 隐藏发光框！
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