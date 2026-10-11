import { useCallback, useEffect, useRef } from 'react';

interface UseResourceGridPaginationOptions {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadMoreFailed: boolean;
  onLoadMore: () => void;
  resultCount: number;
}

export const useResourceGridPagination = ({
  hasMore,
  isLoading,
  isLoadingMore,
  loadMoreFailed,
  onLoadMore,
  resultCount,
}: UseResourceGridPaginationOptions) => {
  const loadMoreLockRef = useRef(false);
  const latestLoadMoreRef = useRef({
    hasMore,
    isLoading,
    isLoadingMore,
    loadMoreFailed,
    onLoadMore,
  });

  useEffect(() => {
    latestLoadMoreRef.current = {
      hasMore,
      isLoading,
      isLoadingMore,
      loadMoreFailed,
      onLoadMore,
    };
  }, [hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  const canLoadMore = useCallback(() => {
    const latest = latestLoadMoreRef.current;
    if (
      !latest.hasMore
      || latest.isLoading
      || latest.isLoadingMore
      || latest.loadMoreFailed
      || resultCount === 0
      || loadMoreLockRef.current
    ) {
      return false;
    }
    return true;
  }, [resultCount]);

  const triggerLoadMore = useCallback(() => {
    if (!canLoadMore()) return;
    loadMoreLockRef.current = true;
    latestLoadMoreRef.current.onLoadMore();
  }, [canLoadMore]);

  return { canLoadMore, triggerLoadMore };
};
