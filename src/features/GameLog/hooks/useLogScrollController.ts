import { useCallback, useEffect, useRef } from 'react';

import { useEvent } from '../../../hooks/useEvent';

interface LogVirtualizer {
  scrollToIndex: (
    index: number,
    options?: { align?: 'auto' | 'start' | 'center' | 'end' }
  ) => void;
}

interface UseLogScrollControllerOptions {
  isOpen: boolean;
  itemCount: number;
  totalSize: number;
  scrollElement: HTMLDivElement | null;
  virtualizer: LogVirtualizer;
}

export const useLogScrollController = ({
  isOpen,
  itemCount,
  totalSize,
  scrollElement,
  virtualizer,
}: UseLogScrollControllerOptions) => {
  const isAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const releaseProgrammaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;

    const target = event.currentTarget;
    isAutoScrollRef.current = target.scrollHeight - target.scrollTop - target.clientHeight <= 10;
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    isProgrammaticScrollRef.current = false;
    if (event.deltaY < 0) {
      isAutoScrollRef.current = false;
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    if (!scrollElement || itemCount === 0) return;

    if (releaseProgrammaticScrollTimerRef.current) {
      clearTimeout(releaseProgrammaticScrollTimerRef.current);
      releaseProgrammaticScrollTimerRef.current = null;
    }

    isProgrammaticScrollRef.current = true;
    virtualizer.scrollToIndex(itemCount - 1, { align: 'end' });

    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(itemCount - 1, { align: 'end' });

      requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollElement.scrollHeight;
        releaseProgrammaticScrollTimerRef.current = setTimeout(() => {
          isProgrammaticScrollRef.current = false;
          releaseProgrammaticScrollTimerRef.current = null;
        }, 80);
      });
    });
  }, [itemCount, scrollElement, virtualizer]);

  useEffect(() => {
    if (!isOpen || itemCount === 0 || !scrollElement || !isAutoScrollRef.current) return;
    scrollToBottom();
  }, [isOpen, itemCount, scrollElement, scrollToBottom, totalSize]);

  useEffect(() => () => {
    if (releaseProgrammaticScrollTimerRef.current) {
      clearTimeout(releaseProgrammaticScrollTimerRef.current);
    }
  }, []);

  useEvent('ore-controller-scroll', (payload) => {
    if (!isOpen || !scrollElement) return;

    const deltaY = payload.deltaY ?? 0;
    if (Math.abs(deltaY) <= 0.1) return;
    isProgrammaticScrollRef.current = false;
    scrollElement.scrollTop += deltaY;
  });

  return {
    handleScroll,
    handleWheel,
  };
};
