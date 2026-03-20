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

    const timer = setTimeout(() => {
      const currentKey = getCurrentFocusKey();
      if (currentKey && focusOrder.includes(currentKey) && doesFocusableExist(currentKey)) {
        initializedFocusRef.current = true;
        return;
      }

      if (initialFocusKey && doesFocusableExist(initialFocusKey)) {
        setFocus(initialFocusKey);
      } else {
        const firstVisible = focusOrder.find((key) => doesFocusableExist(key));
        if (firstVisible) setFocus(firstVisible);
      }

      initializedFocusRef.current = true;
    }, 120);

    return () => clearTimeout(timer);
  }, [focusOrder, initialFocusKey, autoInitialize, active]);

  return { handleLinearArrow };
};
