import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ShimmerOverlay } from './ShimmerOverlay';
import { useScreenDensity } from '../../../hooks/ui/useScreenDensity';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import type { InstalledModIndex, ModMeta } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { FilterOption } from '../hooks/useResourceDownload';
import { buildProjectViewModel, checkIsInstalled, type ProjectViewModel } from '../logic/projectViewModel';
import { ResourceCard } from './ResourceCard';

interface ResourceGridItem {
  project: ModrinthProject;
  viewModel: ProjectViewModel;
  isInstalled: boolean;
  isSkeleton?: boolean;
}

interface ResourceGridContext {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMoreFailed?: boolean;
  onRetryLoadMore?: () => void;
}

const ResourceGridFooter: React.FC<{ context?: ResourceGridContext }> = ({ context }) => {
  if (!context) return null;
  const { hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore } = context;

  if (loadMoreFailed) {
    return (
      <div className="col-span-full flex h-16 items-center justify-center gap-3 pb-6">
        <span className="text-sm text-red-400 font-minecraft font-bold">加载失败，请重试</span>
        <button
          onClick={onRetryLoadMore}
          className="rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-1.5 text-xs font-minecraft font-bold tracking-wider text-ore-green hover:bg-ore-green/20 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          手动继续加载
        </button>
      </div>
    );
  }

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div className="col-span-full overflow-hidden w-full pb-6">
      <AnimatePresence mode="popLayout">
        {isLoadingMore && (
          <motion.div
            key="loadmore-skeletons"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] w-full pt-[0.75rem] px-[1rem]"
          >
            {Array.from({ length: 2 }).map((_, i) => (
              <ResourceCardSkeleton key={`loadmore-skeleton-${i}`} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ResourceGridHeader: React.FC = () => {
  return <div className="col-span-full h-[1.5rem] w-full" />;
};

export const ResourceCardSkeleton = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#C6C8CB]/60"
    >
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#48494A]/20" />

      <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pr-[1rem]">
        <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
          <div className="w-[4.75rem] h-[4.75rem] border-[0.125rem] border-[#1E1E1F] bg-[#48494A]/30 shadow-[inset_0_-4px_0_rgba(0,0,0,0.1)]" />
          <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
            <div className="h-[1.375rem] w-[1.375rem] bg-[#48494A]/20 border-[0.125rem] border-[#262729]" />
            <div className="h-[1.375rem] w-[1.375rem] bg-[#48494A]/20 border-[0.125rem] border-[#262729]" />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div>
            <div className="flex items-center gap-[0.75rem]">
              <div className="h-5 w-36 bg-[#48494A]/30 rounded-sm" />
              <div className="h-4 w-20 bg-[#48494A]/20 rounded-sm" />
            </div>
            <div className="mt-3 space-y-1.5">
              <div className="h-4 w-[90%] bg-[#48494A]/25 rounded-sm" />
              <div className="h-4 w-[60%] bg-[#48494A]/25 rounded-sm" />
            </div>
          </div>

          <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
            <div className="flex h-full min-w-0 items-center gap-[0.4375rem] overflow-hidden">
              <div className="h-[1.375rem] w-14 bg-[#90A6D6]/30 border-[0.125rem] border-[#262729] rounded-sm" />
              <div className="h-[1.375rem] w-14 bg-[#90A6D6]/30 border-[0.125rem] border-[#262729] rounded-sm" />
            </div>
            <div className="flex h-full items-center gap-x-[0.875rem] text-[#161719]/40">
              <div className="h-4 w-12 bg-[#48494A]/20 rounded-sm" />
              <div className="h-4 w-12 bg-[#48494A]/20 rounded-sm" />
              <div className="h-4 w-16 bg-[#48494A]/20 rounded-sm" />
            </div>
          </div>
        </div>
      </div>
      <ShimmerOverlay />
    </motion.div>
  );
};

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  installedModIndex?: InstalledModIndex;
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore: boolean;
  loadMoreFailed?: boolean;
  onRetryLoadMore?: () => void;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  selectedProjectIds?: Set<string>;
  isSelectionMode?: boolean;
  onToggleProjectSelection?: (project: ModrinthProject) => void;
  getProjectKey?: (project: ModrinthProject) => string;
  scrollContainerId?: string;
  onScrollTopChange?: (scrollTop: number) => void;
  categoryOptions?: FilterOption[];
  onClickAuthor?: (author: string) => void;
  selectedProjectId?: string;
}

export const ResourceGrid: React.FC<ResourceGridProps> = ({
  results,
  installedMods,
  isLoading,
  isLoadingMore = false,
  hasMore,
  loadMoreFailed = false,
  onRetryLoadMore,
  onLoadMore,
  onSelectProject,
  selectedProjectIds,
  isSelectionMode = false,
  onToggleProjectSelection,
  getProjectKey = (project) => project.id || project.project_id || project.slug || project.title,
  scrollContainerId,
  onScrollTopChange,
  categoryOptions,
  onClickAuthor,
  selectedProjectId
}) => {
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null);

  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);

  const loadMoreLockRef = useRef(false);
  const latestLoadMoreRef = useRef({ hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore });

  const [shouldAnimateLayout, setShouldAnimateLayout] = useState(false);
  const reflowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const density = useScreenDensity();
  const [isDoubleColumn, setIsDoubleColumn] = useState(() => window.innerWidth > 1920 && density !== 'compact');
  const lastFocusedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const double = window.innerWidth > 1920 && density !== 'compact';
      if (double !== isDoubleColumn) {
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
          if (!isNaN(index)) {
            lastFocusedIndexRef.current = index;
          }
        }
        setIsDoubleColumn(double);
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
  }, [isDoubleColumn, density]);

  useEffect(() => {
    latestLoadMoreRef.current = { hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  const prevIsLoadingRef = useRef(isLoading);

  // Reset scroll to top when a fresh search completes
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && results.length > 0 && scrollElement) {
      scrollElement.scrollTop = 0;
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, results.length, scrollElement]);

  const canLoadMore = useCallback(() => {
    const latest = latestLoadMoreRef.current;
    if (
      !latest.hasMore ||
      latest.isLoading ||
      latest.isLoadingMore ||
      latest.loadMoreFailed ||
      results.length === 0 ||
      loadMoreLockRef.current
    ) {
      return false;
    }
    return true;
  }, [results.length]);

  const triggerLoadMore = useCallback(() => {
    if (!canLoadMore()) return;
    loadMoreLockRef.current = true;
    latestLoadMoreRef.current.onLoadMore();
  }, [canLoadMore]);

  const resourceItems = useMemo(() => {
    return results.map((project) => ({
      project,
      viewModel: buildProjectViewModel(project),
      isInstalled: checkIsInstalled(project, installedMods)
    }));
  }, [installedMods, results]);

  const rowItems = useMemo(() => {
    const chunked: ResourceGridItem[][] = [];
    if (isDoubleColumn) {
      for (let i = 0; i < resourceItems.length; i += 2) {
        const chunk = resourceItems.slice(i, i + 2);
        chunked.push(chunk);
      }
    } else {
      for (let i = 0; i < resourceItems.length; i++) {
        chunked.push([resourceItems[i]]);
      }
    }
    return chunked;
  }, [resourceItems, isDoubleColumn]);

  const rowVirtualizer = useVirtualizer({
    count: rowItems.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => 144,
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  useEffect(() => {
    if (virtualRows.length > 0) {
      const lastItem = virtualRows[virtualRows.length - 1];
      if (lastItem.index >= rowItems.length - 2) {
        triggerLoadMore();
      }
    }
  }, [virtualRows, rowItems.length, triggerLoadMore]);

  useEffect(() => {
    if (lastFocusedIndexRef.current !== null) {
      const targetIndex = lastFocusedIndexRef.current;
      lastFocusedIndexRef.current = null;

      const focusKey = `download-grid-item-${targetIndex}`;

      const timer = setTimeout(() => {
        if (doesFocusableExist(focusKey)) {
          setFocus(focusKey);
        } else {
          const rowIndex = isDoubleColumn ? Math.floor(targetIndex / 2) : targetIndex;
          rowVirtualizer.scrollToIndex(rowIndex, {
            align: 'auto'
          });

          setTimeout(() => {
            if (doesFocusableExist(focusKey)) {
              setFocus(focusKey);
            }
          }, 80);
        }
      }, 80);

      return () => clearTimeout(timer);
    }
  }, [isDoubleColumn, rowVirtualizer]);

  const focusGridIndex = useCallback((targetIndex: number, align: 'auto' | 'center' = 'auto') => {
    if (targetIndex < 0 || targetIndex >= results.length) return false;

    const targetFocusKey = `download-grid-item-${targetIndex}`;
    const rowIndex = isDoubleColumn ? Math.floor(targetIndex / 2) : targetIndex;

    rowVirtualizer.scrollToIndex(rowIndex, { align });

    window.setTimeout(() => {
      if (doesFocusableExist(targetFocusKey)) {
        setFocus(targetFocusKey);
        return;
      }

      rowVirtualizer.scrollToIndex(rowIndex, { align: 'center' });
      window.setTimeout(() => {
        if (doesFocusableExist(targetFocusKey)) {
          setFocus(targetFocusKey);
        }
      }, 80);
    }, 0);

    return true;
  }, [isDoubleColumn, results.length, rowVirtualizer]);

  const handleCardMoveFocus = useCallback((index: number, direction: string) => {
    const columns = isDoubleColumn ? 2 : 1;

    if (direction === 'up') {
      return focusGridIndex(index - columns);
    }

    if (direction === 'down') {
      return focusGridIndex(index + columns);
    }

    if (direction === 'left') {
      if (!isDoubleColumn || index % 2 === 0) return false;
      return focusGridIndex(index - 1);
    }

    if (direction === 'right') {
      if (!isDoubleColumn || index % 2 !== 0) return false;
      return focusGridIndex(index + 1);
    }

    return false;
  }, [focusGridIndex, isDoubleColumn]);

  return (
    <div
      className="relative h-full min-h-0 flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)'
      }}
    >
      <motion.div
        key="grid"
        initial={{ opacity: 0, y: 12 }}
        animate={{
          opacity: isLoading ? 0 : 1,
          y: isLoading ? 12 : 0
        }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="h-full w-full"
      >
        <FocusBoundary
          id="download-results-grid"
          defaultFocusKey="download-grid-item-0"
          className="h-full min-h-0"
        >
          <LayoutGroup id="resource-download-grid-group">
            <OreOverlayScrollArea
              ref={handleScrollContainerRef}
              id={scrollContainerId}
              className="h-full"
              contentSafePaddingRight={0}
              style={{
                height: '100%',
                overflowY: 'auto',
                overscrollBehaviorY: 'contain'
              }}
              onScroll={(e) => {
                const el = e.currentTarget;
                onScrollTopChange?.(el.scrollTop);
              }}
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize() + 24}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                <ResourceGridHeader />

                {virtualRows.map((virtualRow) => {
                  const rowIndex = virtualRow.index;
                  const rowData = rowItems[rowIndex];
                  if (!rowData) return null;

                  return (
                    <div
                      key={virtualRow.key}
                      ref={rowVirtualizer.measureElement}
                      data-index={rowIndex}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start + 24}px)`,
                      }}
                      className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] px-[1rem] pb-[0.5rem]"
                    >
                      {rowData.map((item, colIndex) => {
                        const itemIndex = isDoubleColumn ? rowIndex * 2 + colIndex : rowIndex;
                        return (
                          <ResourceCard
                            key={getProjectKey(item.project)}
                            project={item.project}
                            viewModel={item.viewModel}
                            index={itemIndex}
                            isInstalled={item.isInstalled}
                            hasMore={hasMore}
                            canLoadMore={canLoadMore}
                            onLoadMore={triggerLoadMore}
                            onSelectProject={onSelectProject}
                            isSelectionMode={isSelectionMode}
                            isSelected={selectedProjectIds?.has(getProjectKey(item.project)) ?? false}
                            onToggleSelection={onToggleProjectSelection}
                            isNearBottom={itemIndex >= results.length - 6}
                            categoryOptions={categoryOptions}
                            onClickAuthor={onClickAuthor}
                            shouldAnimateLayout={shouldAnimateLayout}
                            selectedProjectId={selectedProjectId}
                            onMoveFocus={handleCardMoveFocus}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>

              <ResourceGridFooter context={{ hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore }} />
            </OreOverlayScrollArea>
          </LayoutGroup>
        </FocusBoundary>
      </motion.div>

      <AnimatePresence>
        {isLoading && (
          <motion.div
            key="skeleton-overlay"
            initial={{ opacity: 1 }}
            exit={{
              opacity: 0,
              pointerEvents: "none"
            }}
            transition={{
              duration: 0.25,
              ease: "easeInOut"
            }}
            className="absolute inset-0 z-30 bg-[#313233] px-[1rem] pt-0 overflow-y-auto custom-scrollbar"
          >
            <div className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] pb-[1.5rem] pt-[1.5rem]">
              {Array.from({ length: 6 }).map((_, i) => (
                <ResourceCardSkeleton key={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
