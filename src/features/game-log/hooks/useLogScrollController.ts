import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [isAutoScroll, setIsAutoScroll] = useState(true);
  const isAutoScrollRef = useRef(true);
  const isProgrammaticScrollRef = useRef(false);
  const releaseProgrammaticScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (isProgrammaticScrollRef.current) return;

    const target = event.currentTarget;
    const atBottom = target.scrollHeight - target.scrollTop - target.clientHeight <= 20;
    if (isAutoScrollRef.current !== atBottom) {
      isAutoScrollRef.current = atBottom;
      setIsAutoScroll(atBottom);
    }
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    isProgrammaticScrollRef.current = false;
    if (event.deltaY < 0) {
      if (isAutoScrollRef.current) {
        isAutoScrollRef.current = false;
        setIsAutoScroll(false);
      }
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

  const handleJumpToBottom = useCallback(() => {
    isAutoScrollRef.current = true;
    setIsAutoScroll(true);
    scrollToBottom();
  }, [scrollToBottom]);

  return {
    handleScroll,
    handleWheel,
    isAutoScroll,
    scrollToBottom: handleJumpToBottom,
  };
};
