import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useToastStore } from '../../../../shared/stores/useToastStore';
import {
  screenshotService,
  type ScreenshotItem,
} from '../logic/screenshotService';

export type ScreenshotSort = 'newest' | 'oldest' | 'name' | 'size';
export type ScreenshotView = 'grid' | 'list';

interface UseScreenshotPanelOptions {
  instanceId: string;
  isActive: boolean;
  onCoverChanged: (absolutePath: string) => void;
}

export function useScreenshotPanel({
  instanceId,
  isActive,
  onCoverChanged,
}: UseScreenshotPanelOptions) {
  const addToast = useToastStore((state) => state.addToast);
  const [items, setItems] = useState<ScreenshotItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<ScreenshotSort>('newest');
  const [view, setView] = useState<ScreenshotView>('grid');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingCover, setIsSettingCover] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const loadedInstanceIdRef = useRef<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (silent) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      const nextItems = await screenshotService.list(instanceId);
      loadedInstanceIdRef.current = instanceId;
      setItems(nextItems);
      setSelectedIds((current) => {
        const existingIds = new Set(nextItems.map((item) => item.id));
        return new Set([...current].filter((id) => existingIds.has(id)));
      });
      setPreviewId((current) => current && nextItems.some((item) => item.id === current) ? current : null);
      setError(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message);
      if (silent) addToast('error', `刷新截图失败：${message}`);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [addToast, instanceId]);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setTimeout(
      () => void load(loadedInstanceIdRef.current === instanceId),
      0,
    );
    return () => window.clearTimeout(timer);
  }, [isActive, instanceId, load]);

  useEffect(() => {
    if (!isActive) return;
    const handleWindowFocus = () => void load(true);
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [isActive, load]);

  useEffect(() => {
    if (isActive) return;
    const timer = window.setTimeout(() => {
      setSelectionMode(false);
      setSelectedIds(new Set());
      setPreviewId(null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isActive]);

  const sortedItems = useMemo(() => {
    const nextItems = [...items];
    nextItems.sort((left, right) => {
      if (sort === 'newest') return right.capturedAt - left.capturedAt || left.fileName.localeCompare(right.fileName);
      if (sort === 'oldest') return left.capturedAt - right.capturedAt || left.fileName.localeCompare(right.fileName);
      if (sort === 'size') return right.sizeBytes - left.sizeBytes || left.fileName.localeCompare(right.fileName);
      return left.fileName.localeCompare(right.fileName, undefined, { numeric: true });
    });
    return nextItems;
  }, [items, sort]);

  const totalSize = useMemo(
    () => items.reduce((total, item) => total + item.sizeBytes, 0),
    [items],
  );

  const previewIndex = previewId
    ? sortedItems.findIndex((item) => item.id === previewId)
    : -1;
  const previewItem = previewIndex >= 0 ? sortedItems[previewIndex] : null;

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectionFromContext = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds((current) =>
      current.size === sortedItems.length
        ? new Set()
        : new Set(sortedItems.map((item) => item.id)),
    );
  }, [sortedItems]);

  const confirmDelete = useCallback(async () => {
    if (pendingDeleteIds.length === 0) return;
    setIsDeleting(true);
    try {
      const result = await screenshotService.delete(instanceId, pendingDeleteIds);
      const deletedSet = new Set(result.deletedIds);
      setItems((current) => current.filter((item) => !deletedSet.has(item.id)));
      setSelectedIds((current) => new Set([...current].filter((id) => !deletedSet.has(id))));
      setPendingDeleteIds([]);
      setSelectionMode(false);

      if (result.deletedIds.length > 0) {
        addToast('success', `已永久删除 ${result.deletedIds.length} 张截图`);
      }
      if (result.failures.length > 0) {
        addToast('error', `${result.failures.length} 张截图删除失败`);
      }

      if (previewId && deletedSet.has(previewId)) {
        const deletedIndex = sortedItems.findIndex((item) => item.id === previewId);
        const remaining = sortedItems.filter((item) => !deletedSet.has(item.id));
        const nextPreview = remaining[Math.min(deletedIndex, remaining.length - 1)];
        setPreviewId(nextPreview?.id ?? null);
      }
    } catch (deleteError) {
      addToast('error', `删除截图失败：${String(deleteError)}`);
    } finally {
      setIsDeleting(false);
    }
  }, [addToast, instanceId, pendingDeleteIds, previewId, sortedItems]);

  const setAsCover = useCallback(async () => {
    if (!previewItem) return;
    setIsSettingCover(true);
    try {
      const newCoverPath = await screenshotService.setAsCover(instanceId, previewItem.id);
      onCoverChanged(newCoverPath);
      addToast('success', '已将截图设为实例封面');
    } catch (coverError) {
      addToast('error', `设置封面失败：${String(coverError)}`);
    } finally {
      setIsSettingCover(false);
    }
  }, [addToast, instanceId, onCoverChanged, previewItem]);

  const openFolder = useCallback(async () => {
    try {
      await screenshotService.openFolder(instanceId);
    } catch (openError) {
      addToast('error', `打开截图目录失败：${String(openError)}`);
    }
  }, [addToast, instanceId]);

  const revealPreview = useCallback(async () => {
    if (!previewItem) return;
    try {
      await screenshotService.reveal(instanceId, previewItem.id);
    } catch (revealError) {
      addToast('error', `定位截图失败：${String(revealError)}`);
    }
  }, [addToast, instanceId, previewItem]);

  const copyPreview = useCallback(async () => {
    if (!previewItem || isCopying) return;
    setIsCopying(true);
    try {
      await screenshotService.copyImage(previewItem);
      addToast('success', '截图已复制到剪贴板');
    } catch (copyError) {
      addToast('error', `复制截图失败：${String(copyError)}`);
    } finally {
      setIsCopying(false);
    }
  }, [addToast, isCopying, previewItem]);

  return {
    items,
    sortedItems,
    totalSize,
    isLoading,
    isRefreshing,
    error,
    sort,
    setSort,
    view,
    setView,
    selectionMode,
    selectedIds,
    previewItem,
    previewIndex,
    pendingDeleteIds,
    isDeleting,
    isSettingCover,
    isCopying,
    load,
    openFolder,
    toggleSelection,
    toggleSelectionFromContext,
    exitSelectionMode,
    selectAll,
    setPreviewId,
    setPendingDeleteIds,
    confirmDelete,
    setAsCover,
    revealPreview,
    copyPreview,
  };
}

