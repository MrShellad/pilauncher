import { useEffect, useMemo, useRef, useState } from 'react';

interface UseIncrementalListOptions<T> {
  items: T[];
  getItemKey: (item: T) => string;
  pageSize?: number;
  ensureVisibleIndex?: number | null;
}

export const useIncrementalList = <T,>({
  items,
  getItemKey,
  pageSize = 20,
  ensureVisibleIndex = null
}: UseIncrementalListOptions<T>) => {
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const resetSignature = useMemo(() => {
    return items.map(getItemKey).join('\u0001');
  }, [getItemKey, items]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, resetSignature]);

  useEffect(() => {
    if (ensureVisibleIndex === null || ensureVisibleIndex < 0 || ensureVisibleIndex < visibleCount) {
      return;
    }

    setVisibleCount((current) => {
      return Math.min(items.length, Math.max(current, ensureVisibleIndex + pageSize));
    });
  }, [ensureVisibleIndex, items.length, pageSize, visibleCount]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => Math.min(current + pageSize, items.length));
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, pageSize, visibleCount]);

  return {
    visibleItems: items.slice(0, visibleCount),
    visibleCount,
    hasMore: visibleCount < items.length,
    sentinelRef
  };
};
