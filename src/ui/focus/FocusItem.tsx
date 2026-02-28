// src/ui/focus/FocusItem.tsx
import React from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';

interface FocusItemRenderProps {
  ref: React.RefObject<any>; // 传递给内部 DOM 节点的 ref
  focused: boolean;          // 当前项是否获得焦点
  hasFocusedChild: boolean;  // 内部子元素是否获得焦点
}

interface FocusItemProps {
  focusKey?: string;         // 可选的指定焦点 ID
  disabled?: boolean;        // 是否禁用焦点
  onEnter?: () => void;      // 按下手柄 A 键 / 键盘 Enter 键的回调
  // 采用 Render Props 模式，把状态和 ref 传递给被包裹的元素
  children: (props: FocusItemRenderProps) => React.ReactNode; 
}

export const FocusItem: React.FC<FocusItemProps> = ({
  focusKey,
  disabled = false,
  onEnter,
  children
}) => {
  // 接入 Norigin Spatial Navigation 引擎的核心 Hook
  const { ref, focused, hasFocusedChild } = useFocusable({
    focusable: !disabled, // 如果 disabled 为 true，则剥夺获取焦点的能力
    focusKey: focusKey,
    onEnterPress: onEnter,
  });

  return (
    <>
      {children({ ref, focused, hasFocusedChild })}
    </>
  );
};