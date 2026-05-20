import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /** ref 挂载的子容器（滚动根） */
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  /** IntersectionObserver 的监听目标 */
  observerTargetRef: React.RefObject<HTMLElement | null>;
  /** 触发加载的 rootMargin，默认 '100px' */
  rootMargin?: string;
}

interface UseInfiniteScrollReturn {
  /** 判断当前是否可以触发加载（无锁、无 loading、hasMore） */
  canLoadMore: () => boolean;
  /** 手动触发一次加载（已内置锁防重入） */
  triggerLoadMore: () => void;
}

/**
 * 封装「无限滚动」逻辑：
 * - 维护 latestRef 避免闭包过期
 * - loadMoreLockRef 防止重入
 * - IntersectionObserver 监听 observerTarget 进入视口时触发加载
 */
export function useInfiniteScroll({
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  scrollContainerRef,
  observerTargetRef,
  rootMargin = '100px'
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  const loadMoreLockRef = useRef(false);
  const latestRef = useRef({ hasMore, isLoading, isLoadingMore, onLoadMore });

  useEffect(() => {
    latestRef.current = { hasMore, isLoading, isLoadingMore, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  // 加载完成后解锁
  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  const canLoadMore = useCallback(() => {
    const { hasMore: h, isLoading: l, isLoadingMore: lm } = latestRef.current;
    if (!h || l || lm || loadMoreLockRef.current) return false;
    return true;
  }, []);

  const triggerLoadMore = useCallback(() => {
    if (!canLoadMore()) return;
    loadMoreLockRef.current = true;
    latestRef.current.onLoadMore();
  }, [canLoadMore]);

  useEffect(() => {
    const scrollHost = scrollContainerRef.current;
    const target = observerTargetRef.current;
    if (!scrollHost || !target) return;
    if (isLoading || isLoadingMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) triggerLoadMore();
      },
      { root: scrollHost, rootMargin, threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  // result 总数变化时重新绑新 target（父组件负责传入 key）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerLoadMore, isLoading, isLoadingMore]);

  return { canLoadMore, triggerLoadMore };
}
