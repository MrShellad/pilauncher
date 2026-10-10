import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'motion/react';
import { useDownloadLayoutStore } from '../../../../download';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { OreOverlayScrollArea } from '../../../../../ui/primitives/OreOverlayScrollArea';
import { InstalledModIndex, type ModMeta } from '../../../../instance-resources';
import type { ModrinthProject } from '../../../../resource-catalog';
import { buildProjectViewModel } from '../../../../download';
import { ResourceCard } from './ResourceCard';
import {
  ResourceCardSkeleton,
  ResourceGridFooter,
  ResourceGridHeader,
} from './ResourceGridFeedback';

export { ResourceCardSkeleton } from './ResourceGridFeedback';

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore: boolean;
  loadMoreFailed?: boolean;
  onRetryLoadMore?: () => void;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
  lockedMcVersion?: string;
  lockedLoaderType?: string;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  selectedProjectIds?: Set<string>;
  isSelectionMode?: boolean;
  onToggleProjectSelection?: (project: ModrinthProject) => void;
  getProjectKey?: (project: ModrinthProject) => string;
  scrollContainerId?: string;
  onScrollTopChange?: (scrollTop: number) => void;
  onClickAuthor?: (author: string) => void;
  selectedProjectId?: string;
}

interface ResourceGridItem {
  project: ModrinthProject;
  viewModel: ReturnType<typeof buildProjectViewModel>;
  isInstalled: boolean;
  isSkeleton?: boolean;
}

const prettifyLoader = (loader: string) => {
  if (!loader) return 'Vanilla';
  if (loader === 'neoforge') return 'NeoForge';
  return loader.charAt(0).toUpperCase() + loader.slice(1);
};

export const ResourceGrid: React.FC<ResourceGridProps> = ({
  results,
  installedMods,
  isLoading,
  isLoadingMore = false,
  hasMore,
  loadMoreFailed = false,
  onRetryLoadMore,
  resourceTab = 'mod',
  lockedMcVersion = '',
  lockedLoaderType = '',
  onLoadMore,
  onSelectProject,
  selectedProjectIds,
  isSelectionMode = false,
  onToggleProjectSelection,
  getProjectKey = (project) => project.id || project.project_id || project.slug || project.title,
  scrollContainerId,
  onScrollTopChange,
  onClickAuthor,
  selectedProjectId
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreLockRef = useRef(false);
  const latestRef = useRef({
    hasMore,
    isLoading,
    isLoadingMore,
    loadMoreFailed,
    onLoadMore
  });

  const [shouldAnimateLayout, setShouldAnimateLayout] = useState(false);
  const reflowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const forceDoubleColumn = useDownloadLayoutStore((state) => state.forceDoubleColumn);

  const computeDoubleColumn = useCallback(() => {
    if (forceDoubleColumn) return true;
    return window.innerWidth > 1920;
  }, [forceDoubleColumn]);

  const [isDoubleColumn, setIsDoubleColumn] = useState(computeDoubleColumn);
  const lastFocusedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const double = computeDoubleColumn();
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
  }, [computeDoubleColumn, isDoubleColumn]);



  useEffect(() => {
    latestRef.current = { hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  const prevIsLoadingRef = useRef(isLoading);

  // Reset scroll to top when a fresh search completes
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && results.length > 0 && parentRef.current) {
      parentRef.current.scrollTop = 0;
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, results.length]);

  const canLoadMore = useCallback(() => {
    const latest = latestRef.current;
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
    latestRef.current.onLoadMore();
  }, [canLoadMore]);

  const installedModIndex = useMemo(() => new InstalledModIndex(installedMods), [installedMods]);

  const resourceItems = useMemo(() => {
    const items: ResourceGridItem[] = results.map((project) => ({
      project,
      viewModel: buildProjectViewModel(project),
      isInstalled: installedModIndex.isInstalled(project)
    }));

    return items;
  }, [installedModIndex, results]);

  // Row chunking helper for grid layout
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
    getScrollElement: () => parentRef.current,
    estimateSize: () => 148,
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

  const emptyLoading = isLoading && results.length === 0;
  const emptyStateText = resourceTab === 'shader'
    ? '当前没有找到适配这个实例环境的光影。'
    : resourceTab === 'resourcepack'
      ? '当前没有找到适配这个实例环境的资源包。'
      : '当前没有找到适配这个实例环境的模组。';
  const envText = resourceTab === 'mod' && lockedLoaderType
    ? `MC ${lockedMcVersion} | ${prettifyLoader(lockedLoaderType)}`
    : `MC ${lockedMcVersion}`;

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
        <OreOverlayScrollArea
          id={scrollContainerId}
          ref={parentRef}
          className="h-full min-h-0"
          viewportClassName="overscroll-contain scroll-smooth"
          contentClassName="min-h-full"
          safeInsetTop={10}
          safeInsetBottom={12}
          safeInsetRight={8}
          contentSafePaddingRight={18}
          onScroll={(e) => {
            const el = e.currentTarget;
            onScrollTopChange?.(el.scrollTop);
          }}
        >
        <FocusBoundary
          id="instance-download-results-grid"
          defaultFocusKey="download-grid-item-0"
          className="min-h-full"
        >
          <div className="min-h-full px-[0.875rem] pb-[1.25rem] pt-0 sm:px-[1rem] sm:pb-[1.5rem] sm:pt-0">
            {results.length === 0 && !isLoading ? (
              <div className="flex min-h-[22.5rem] flex-col items-center justify-center gap-3 px-6 text-center">
                <Blocks className="h-10 w-10 text-white/35" />
                <div className="font-minecraft text-base text-white">{emptyStateText}</div>
                <div className="text-xs text-gray-400">
                  搜索结果已锁定为 {envText}，不会混入不匹配的结果。
                </div>
              </div>
            ) : (
              <>
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
                        className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} gap-[0.75rem] pb-[0.75rem]`}
                      >
                        {rowData.map((item, colIndex) => {
                          const itemIndex = isDoubleColumn ? rowIndex * 2 + colIndex : rowIndex;
                          return (
                            <ResourceCard
                              key={`${getProjectKey(item.project)}-${itemIndex}`}
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

                <ResourceGridFooter
                  context={{ hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore }}
                  isDoubleColumn={isDoubleColumn}
                />
              </>
            )}
          </div>
        </FocusBoundary>
      </OreOverlayScrollArea>
      </motion.div>

      <AnimatePresence>
        {emptyLoading && (
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
            <div className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} gap-[0.75rem] pb-[1.5rem] pt-[1.5rem]`}>
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
