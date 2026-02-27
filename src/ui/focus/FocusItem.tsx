// src/ui/focus/FocusItem.tsx
import React, { useEffect } from 'react';
import { useFocusable } from '@noriginmedia/norigin-spatial-navigation';
import { focusManager } from './FocusManager';
import { useInputMode } from './FocusProvider';

interface FocusItemProps {
  focusKey?: string;
  boundaryId?: string; 
  disabled?: boolean;
  onEnter?: () => void;
  children: (props: { ref: any; focused: boolean }) => React.ReactNode;
}

export const FocusItem: React.FC<FocusItemProps> = ({ 
  focusKey, 
  boundaryId, 
  disabled = false, 
  onEnter, 
  children 
}) => {
  const inputMode = useInputMode();

  // ✅ 修复：将 setFocus 改为引擎提供的 focusSelf
  const { ref, focused, focusKey: generatedKey, focusSelf } = useFocusable({
    focusable: !disabled,
    focusKey,
    onEnterPress: onEnter,
  });

  // 1. 记录焦点历史
  useEffect(() => {
    if (focused && boundaryId) {
      focusManager.saveFocus(boundaryId, generatedKey);
    }
  }, [focused, boundaryId, generatedKey]);

  // 2. ✨ 静默同步鼠标点击位置 ✨
  useEffect(() => {
    const el = ref.current as HTMLElement | undefined;
    if (!el || disabled) return;

    const handleMouseDown = () => {
      // ✅ 修复：使用 focusSelf() 直接让当前元素在空间导航中获取焦点
      focusSelf();
    };

    el.addEventListener('mousedown', handleMouseDown);
    return () => el.removeEventListener('mousedown', handleMouseDown);
  }, [ref, disabled, focusSelf]); // 依赖项同步修改为 focusSelf

  // 3. ✨ 过滤视觉焦点 ✨
  // 只有在键盘或手柄模式下，且底层确实获取了焦点时，才向 UI 层传递 true
  const visuallyFocused = focused && inputMode !== 'mouse';

  return (
    <>
      {children({ ref, focused: visuallyFocused })}
    </>
  );
};