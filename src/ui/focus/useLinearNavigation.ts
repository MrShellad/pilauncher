import { useCallback, useEffect, useRef } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';

export const useLinearNavigation = (focusOrder: string[], initialFocusKey?: string, autoInitialize = true, active = true) => {
  const handleLinearArrow = useCallback(
    (direction: string) => {
      if (!active) return true;
      if (direction !== 'up' && direction !== 'down') return true;

      const availableKeys = focusOrder.filter((k) => doesFocusableExist(k));
      if (availableKeys.length === 0) return true;

      const currentKey = getCurrentFocusKey();
      const index = availableKeys.indexOf(currentKey);

      if (index < 0) {
        setFocus(availableKeys[0]);
        return false;
      }

      const nextIndex =
        direction === 'down'
          ? Math.min(availableKeys.length - 1, index + 1)
          : Math.max(0, index - 1);

      if (nextIndex !== index) {
        setFocus(availableKeys[nextIndex]);
      }

      return false;
    },
    [focusOrder, active]
  );

  const initializedFocusRef = useRef(false);
  useEffect(() => {
    if (!autoInitialize || !active) return;
    if (initializedFocusRef.current) return;

    let retries = 0;
    let timer: number;

    const attemptFocus = () => {
      // 1. 如果当前的焦点依然存在并且在我们预期的序列中，说明焦点已经被外部系统正常锁定
      const currentKey = getCurrentFocusKey();
      if (currentKey && focusOrder.includes(currentKey) && doesFocusableExist(currentKey)) {
        initializedFocusRef.current = true;
        return;
      }

      // 2. 尝试绑定到显式传入的 initialFocusKey
      if (initialFocusKey && doesFocusableExist(initialFocusKey)) {
        setFocus(initialFocusKey);
        initializedFocusRef.current = true;
        return;
      }

      // 3. 降级：绑定到 focusOrder 中第一个被渲染出来的可用 FocusItem
      const firstVisible = focusOrder.find((key) => doesFocusableExist(key));
      if (firstVisible) {
        setFocus(firstVisible);
        initializedFocusRef.current = true;
        return;
      }

      // 4. 重试机制：如果还没找到任何元素（可能是因为数据获取或渲染延迟）
      // 则每 50 毫秒重试一次，最多重试 20 次 (1秒)
      if (retries < 20) {
        retries++;
        timer = window.setTimeout(attemptFocus, 50);
      }
      // 注意：如果超过最高重试次数依然没有任何焦点，我们不去将 `initializedFocusRef.current` 设置为 true
      // 这保留了它“自愈”的能力，也就是当下一次依赖项(如 focusOrder)被更新而触发重新渲染时，可以继续尝试聚焦
    };

    // 留出 20 毫秒的初次渲染时间，随后开始尝试
    timer = window.setTimeout(attemptFocus, 20);

    return () => clearTimeout(timer);
  }, [focusOrder, initialFocusKey, autoInitialize, active]);

  return { handleLinearArrow };
};
