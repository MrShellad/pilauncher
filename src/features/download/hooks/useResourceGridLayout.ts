import { useCallback, useEffect, useRef, useState } from 'react';
import { getCurrentFocusKey } from '@noriginmedia/norigin-spatial-navigation';

import { useSettingsStore } from '../../../app/stores/useSettingsStore';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';

export const useResourceGridLayout = () => {
  const forceDoubleColumn = useSettingsStore(
    (state) => state.settings.appearance.forceDoubleColumn
  );
  const density = useScreenDensity();
  const reflowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocusedIndexRef = useRef<number | null>(null);
  const [shouldAnimateLayout, setShouldAnimateLayout] = useState(false);

  const computeDoubleColumn = useCallback(() => {
    if (forceDoubleColumn) return true;
    return window.innerWidth > 1920 && density !== 'compact';
  }, [density, forceDoubleColumn]);

  const [isDoubleColumn, setIsDoubleColumn] = useState(computeDoubleColumn);

  useEffect(() => {
    const handleResize = () => {
      const doubleColumn = computeDoubleColumn();
      if (doubleColumn !== isDoubleColumn) {
        setShouldAnimateLayout(true);
        if (reflowTimeoutRef.current) {
          clearTimeout(reflowTimeoutRef.current);
        }
        reflowTimeoutRef.current = setTimeout(() => {
          setShouldAnimateLayout(false);
        }, 800);

        const currentFocus = getCurrentFocusKey();
        if (currentFocus && currentFocus.startsWith('download-grid-item-')) {
          const index = parseInt(currentFocus.replace('download-grid-item-', ''), 10);
          if (!Number.isNaN(index)) {
            lastFocusedIndexRef.current = index;
          }
        }
        setIsDoubleColumn(doubleColumn);
      }
    };

    handleResize();

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (reflowTimeoutRef.current) {
        clearTimeout(reflowTimeoutRef.current);
      }
    };
  }, [computeDoubleColumn, isDoubleColumn]);

  return {
    isDoubleColumn,
    lastFocusedIndexRef,
    shouldAnimateLayout,
  };
};
