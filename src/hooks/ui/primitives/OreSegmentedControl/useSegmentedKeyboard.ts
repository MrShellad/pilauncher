// /src/hooks/ui/primitives/OreSegmentedControl/useSegmentedKeyboard.ts
import { useEffect, useCallback } from 'react';

// 只提取 Hook 运行所需要的最小数据结构
interface TabItemBase {
  id: string;
}

interface UseSegmentedKeyboardProps {
  tabs: TabItemBase[];
  activeTab: string;
  onChange: (id: string) => void;
}

export const useSegmentedKeyboard = ({
  tabs,
  activeTab,
  onChange,
}: UseSegmentedKeyboardProps) => {
  // 核心切换逻辑
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const currentIndex = tabs.findIndex((t) => t.id === activeTab);
      if (currentIndex === -1) return;

      if (e.key === '[') {
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
        onChange(tabs[prevIndex].id);
      } else if (e.key === ']') {
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
        onChange(tabs[nextIndex].id);
      }
    },
    [tabs, activeTab, onChange]
  );

  // 绑定全局事件
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 暴露给外部鼠标点击调用的方法
  const triggerPrev = useCallback(() => {
    handleKeyDown(new KeyboardEvent('keydown', { key: '[' }));
  }, [handleKeyDown]);

  const triggerNext = useCallback(() => {
    handleKeyDown(new KeyboardEvent('keydown', { key: ']' }));
  }, [handleKeyDown]);

  return { triggerPrev, triggerNext };
};