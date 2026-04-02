import React, { useRef } from 'react';
import { Loader2 } from 'lucide-react';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import type { ModMeta } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { FilterOption } from '../hooks/useResourceDownload';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';
import { checkIsInstalled } from '../logic/projectViewModel';
import { ResourceCard } from './ResourceCard';

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
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
  isLoading,
  isLoadingMore = false,
  hasMore,
  onLoadMore,
  onSelectProject,
  scrollContainerId,
  onScrollTopChange,
  categoryOptions
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  const { canLoadMore, triggerLoadMore } = useInfiniteScroll({
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore,
    scrollContainerRef,
    observerTargetRef
  });

  return (
    <div
      id={scrollContainerId}
      ref={scrollContainerRef}
      className="h-full min-h-0 flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
      onScroll={(e) => {
        if (!onScrollTopChange) return;
        onScrollTopChange(e.currentTarget.scrollTop);
      }}
    >
      <FocusBoundary
        id="download-results-grid"
        defaultFocusKey="download-grid-item-0"
        className="min-h-full"
      >
        <div className="min-h-full px-[0.875rem] pb-[1.25rem] pt-[0.875rem] sm:px-[1rem] sm:pb-[1.5rem] sm:pt-[1rem]">
          {isLoading ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <Loader2 size={44} className="animate-spin text-ore-green" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-[0.875rem] pb-[1.5rem] lg:grid-cols-2 2xl:grid-cols-3">
              {results.map((project, index) => (
                <ResourceCard
                  key={`${project.id}-${index}`}
                  project={project}
                  index={index}
                  isInstalled={checkIsInstalled(project, installedMods)}
                  hasMore={hasMore}
                  canLoadMore={canLoadMore}
                  onLoadMore={triggerLoadMore}
                  onSelectProject={onSelectProject}
                  isNearBottom={index >= results.length - 6}
                  categoryOptions={categoryOptions}
                />
              ))}

              {results.length > 0 && hasMore && (
                <div ref={observerTargetRef} className="col-span-full flex h-16 items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-ore-green opacity-60" />
                </div>
              )}
            </div>
          )}
        </div>
      </FocusBoundary>
    </div>
  );
};
