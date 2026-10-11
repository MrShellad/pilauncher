import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { LayoutGroup, motion } from 'motion/react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import type { InstalledModIndex, ModMeta } from '@/features/instance-resources';
import type { ModrinthProject } from '@/features/resource-catalog';
import type { FilterOption } from '../hooks/useResourceDownload';
import { useResourceGridLayout } from '../hooks/useResourceGridLayout';
import { useResourceGridPagination } from '../hooks/useResourceGridPagination';
import { buildProjectViewModel, checkIsInstalled, type ProjectViewModel } from '../logic/projectViewModel';
import { ResourceCard } from './ResourceCard';
import {
  ResourceGridFooter,
  ResourceGridHeader,
  ResourceGridLoadingOverlay,
} from './ResourceGridFeedback';

export { ResourceCardSkeleton } from './ResourceGridFeedback';

interface ResourceGridItem {
  project: ModrinthProject;
  viewModel: ProjectViewModel;
  isInstalled: boolean;
  isSkeleton?: boolean;
}

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
  const { isDoubleColumn, lastFocusedIndexRef, shouldAnimateLayout } = useResourceGridLayout();
  const { canLoadMore, triggerLoadMore } = useResourceGridPagination({
    hasMore,
    isLoading,
    isLoadingMore,
    loadMoreFailed,
    onLoadMore,
    resultCount: results.length,
  });

  const handleScrollContainerRef = useCallback((node: HTMLDivElement | null) => {
    setScrollElement(node);
  }, []);

  const prevIsLoadingRef = useRef(isLoading);

  // Reset scroll to top when a fresh search completes
  useEffect(() => {
    if (prevIsLoadingRef.current && !isLoading && results.length > 0 && scrollElement) {
      scrollElement.scrollTop = 0;
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, results.length, scrollElement]);

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
  }, [isDoubleColumn, lastFocusedIndexRef, rowVirtualizer]);

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
                      className={`grid ${isDoubleColumn ? 'grid-cols-2' : 'grid-cols-1'} gap-[0.75rem] px-[1rem] pb-[0.5rem]`}
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

              <ResourceGridFooter
                context={{ hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore }}
                isDoubleColumn={isDoubleColumn}
              />
            </OreOverlayScrollArea>
          </LayoutGroup>
        </FocusBoundary>
      </motion.div>

      <ResourceGridLoadingOverlay
        isDoubleColumn={isDoubleColumn}
        isLoading={isLoading}
      />
    </div>
  );
};
