import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { VirtuosoGrid } from 'react-virtuoso';
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

const RESOURCE_GRID_COMPONENTS = { Footer: ResourceGridFooter, Scroller: VirtuosoScroller };

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
  categoryOptions
}) => {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const latestLoadMoreRef = useRef({ hasMore, isLoading, isLoadingMore, onLoadMore });

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
      <VirtuosoScroller
        id={scrollContainerId}
        ref={(node: HTMLDivElement | null) => {
          scrollContainerRef.current = node;
        }}
        className="h-full min-h-0 flex-1 scroll-smooth"
        onScroll={(e: React.UIEvent<HTMLDivElement>) => {
          onScrollTopChange?.(e.currentTarget.scrollTop);
        }}
      >
        <FocusBoundary
          id="download-results-grid"
          defaultFocusKey="download-grid-item-0"
          className="min-h-full"
        >
          <div className="flex h-full min-h-[360px] items-center justify-center">
            <Loader2 size={44} className="animate-spin text-ore-green" />
          </div>
        </FocusBoundary>
      </VirtuosoScroller>
    );
  }

  return (
    <div className="h-full min-h-0 flex-1 overflow-hidden">
      <FocusBoundary
        id="download-results-grid"
        defaultFocusKey="download-grid-item-0"
        className="h-full min-h-0"
      >
        <VirtuosoGrid<ResourceGridItem, ResourceGridContext>
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
          computeItemKey={(index, item) => `${getProjectKey(item.project)}-${index}`}
          listClassName="grid grid-cols-1 gap-[0.75rem] px-[0.875rem] pb-[1.5rem] pt-[1.375rem] sm:px-[1rem] sm:pt-[1.5rem]"
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
            />
          )}
        />
      </FocusBoundary>
    </div>
  );
};
