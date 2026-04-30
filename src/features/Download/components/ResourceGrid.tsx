import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { VirtuosoGrid } from 'react-virtuoso';

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

const RESOURCE_GRID_COMPONENTS = { Footer: ResourceGridFooter };

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  installedModIndex?: InstalledModIndex;
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
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
      <div
        id={scrollContainerId}
        ref={(node) => {
          scrollContainerRef.current = node;
        }}
        className="h-full min-h-0 flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
        onScroll={(e) => {
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
      </div>
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
          computeItemKey={(index, item) => `${item.project.id}-${index}`}
          listClassName="grid grid-cols-1 gap-[0.875rem] px-[0.875rem] pb-[1.5rem] pt-[0.875rem] sm:px-[1rem] sm:pt-[1rem] lg:grid-cols-2 2xl:grid-cols-3"
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
              isNearBottom={index >= results.length - 6}
              categoryOptions={categoryOptions}
            />
          )}
        />
      </FocusBoundary>
    </div>
  );
};
