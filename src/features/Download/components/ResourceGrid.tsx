import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { VirtuosoGrid } from 'react-virtuoso';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { VirtuosoScroller } from '../../../ui/primitives/OreOverlayScrollArea';

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
}

interface ResourceGridContext {
  hasMore: boolean;
  isLoadingMore: boolean;
}

const ResourceGridFooter: React.FC<{ context?: ResourceGridContext }> = ({ context }) => {
  if (!context?.hasMore) return null;

  return (
    <div className="col-span-full flex h-16 items-center justify-center">
      <Loader2
        size={24}
        className={`text-ore-green opacity-60 ${context.isLoadingMore ? 'animate-spin' : ''}`}
      />
    </div>
  );
};

const ResourceGridHeader: React.FC = () => {
  return <div className="col-span-full h-[1.5rem] w-full" />;
};

const RESOURCE_GRID_COMPONENTS = {
  Header: ResourceGridHeader,
  Footer: ResourceGridFooter,
  Scroller: VirtuosoScroller
};

const ResourceCardSkeleton = () => {
  return (
    <div className="relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#C6C8CB]/60 animate-pulse">
      <div className="absolute inset-y-0 left-0 w-1.5 bg-[#48494A]/20" />
      <div className="absolute inset-x-0 top-0 h-[0.25rem] bg-white/10" />

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
    </div>
  );
};

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  installedModIndex?: InstalledModIndex;
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore: boolean;
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
  installedModIndex,
  isLoading,
  isLoadingMore = false,
  hasMore,
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
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const latestLoadMoreRef = useRef({ hasMore, isLoading, isLoadingMore, onLoadMore });

  const [shouldAnimateLayout, setShouldAnimateLayout] = useState(false);
  const reflowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isDoubleColumn, setIsDoubleColumn] = useState(() => window.innerWidth > 1920);
  const lastFocusedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const double = window.innerWidth > 1920;
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

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (reflowTimeoutRef.current) {
        clearTimeout(reflowTimeoutRef.current);
      }
    };
  }, [isDoubleColumn]);

  useEffect(() => {
    if (lastFocusedIndexRef.current !== null) {
      const targetIndex = lastFocusedIndexRef.current;
      lastFocusedIndexRef.current = null;

      const focusKey = `download-grid-item-${targetIndex}`;
      
      const timer = setTimeout(() => {
        if (doesFocusableExist(focusKey)) {
          setFocus(focusKey);
        } else {
          virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: 'smart'
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
  }, [isDoubleColumn]);

  useEffect(() => {
    latestLoadMoreRef.current = { hasMore, isLoading, isLoadingMore, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  useEffect(() => {
    if (!scrollElement || !onScrollTopChange) return;

    const handleScroll = () => {
      onScrollTopChange(scrollElement.scrollTop);
    };

    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollElement.removeEventListener('scroll', handleScroll);
  }, [onScrollTopChange, scrollElement]);

  const handleScrollerRef = useCallback((node: HTMLElement | null) => {
    scrollContainerRef.current = node;
    setScrollElement(node);
  }, []);

  const canLoadMore = useCallback(() => {
    const latest = latestLoadMoreRef.current;
    if (!latest.hasMore || latest.isLoading || latest.isLoadingMore || loadMoreLockRef.current) {
      return false;
    }
    return true;
  }, []);

  const triggerLoadMore = useCallback(() => {
    if (!canLoadMore()) return;
    loadMoreLockRef.current = true;
    latestLoadMoreRef.current.onLoadMore();
  }, [canLoadMore]);

  const resourceItems = useMemo(() => {
    const installedLookup = installedModIndex || installedMods;

    return results.map((project) => ({
      project,
      viewModel: buildProjectViewModel(project),
      isInstalled: checkIsInstalled(project, installedLookup)
    }));
  }, [installedModIndex, installedMods, results]);

  if (isLoading) {
    return (
      <div
        className="h-full min-h-0 flex-1 overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)'
        }}
      >
        <VirtuosoScroller
          id={scrollContainerId}
          ref={(node: HTMLDivElement | null) => {
            scrollContainerRef.current = node;
          }}
          className="h-full min-h-0 flex-1 scroll-smooth"
          onScroll={(e: React.UIEvent<HTMLDivElement>) => {
            onScrollTopChange?.(e.currentTarget.scrollTop);
          }}
          style={{
            height: '100%',
            overflowY: 'auto'
          }}
        >
          <FocusBoundary
            id="download-results-grid"
            defaultFocusKey="download-grid-item-0"
            className="min-h-full"
          >
            <div className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] pb-[1.5rem] px-[0.875rem] pt-[1.5rem] sm:px-[1rem] sm:pt-[1.5rem]">
              {Array.from({ length: 6 }).map((_, i) => (
                <ResourceCardSkeleton key={i} />
              ))}
            </div>
          </FocusBoundary>
        </VirtuosoScroller>
      </div>
    );
  }

  return (
    <div
      className="h-full min-h-0 flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)'
      }}
    >
      <FocusBoundary
        id="download-results-grid"
        defaultFocusKey="download-grid-item-0"
        className="h-full min-h-0"
      >
        <VirtuosoGrid<ResourceGridItem, ResourceGridContext>
          ref={virtuosoRef}
          id={scrollContainerId}
          className="h-full custom-scrollbar"
          style={{
            height: '100%',
            overflowY: 'auto',
            overscrollBehaviorY: 'contain'
          }}
          data={resourceItems}
          context={{ hasMore, isLoadingMore }}
          scrollerRef={handleScrollerRef}
          computeItemKey={(_, item) => getProjectKey(item.project)}
          listClassName="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] px-[1rem] pb-[1.5rem] pt-0"
          components={RESOURCE_GRID_COMPONENTS}
          increaseViewportBy={{ top: 240, bottom: 520 }}
          endReached={triggerLoadMore}
          itemContent={(index, { project, viewModel, isInstalled }) => (
            <ResourceCard
              project={project}
              viewModel={viewModel}
              index={index}
              isInstalled={isInstalled}
              hasMore={hasMore}
              canLoadMore={canLoadMore}
              onLoadMore={triggerLoadMore}
              onSelectProject={onSelectProject}
              isSelectionMode={isSelectionMode}
              isSelected={selectedProjectIds?.has(getProjectKey(project)) ?? false}
              onToggleSelection={onToggleProjectSelection}
              isNearBottom={index >= results.length - 6}
              categoryOptions={categoryOptions}
              onClickAuthor={onClickAuthor}
              shouldAnimateLayout={shouldAnimateLayout}
              selectedProjectId={selectedProjectId}
            />
          )}
        />
      </FocusBoundary>
    </div>
  );
};
