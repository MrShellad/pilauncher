import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VirtuosoGrid } from 'react-virtuoso';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { VirtuosoScroller } from '../../../ui/primitives/OreOverlayScrollArea';
import { motion, AnimatePresence, LayoutGroup } from 'motion/react';
import { ShimmerOverlay } from './ShimmerOverlay';

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
  if (!context?.hasMore) return null;

  if (context.loadMoreFailed) {
    return (
      <div className="col-span-full flex h-16 items-center justify-center gap-3">
        <span className="text-sm text-red-400 font-minecraft font-bold">加载失败，请重试</span>
        <button
          onClick={context.onRetryLoadMore}
          className="rounded-sm border border-ore-green/30 bg-ore-green/10 px-3 py-1.5 text-xs font-minecraft font-bold tracking-wider text-ore-green hover:bg-ore-green/20 hover:text-white transition-colors cursor-pointer active:scale-95"
        >
          手动继续加载
        </button>
      </div>
    );
  }

  return null;
};

const ResourceGridHeader: React.FC = () => {
  return <div className="col-span-full h-[1.5rem] w-full" />;
};

const RESOURCE_GRID_COMPONENTS = {
  Header: ResourceGridHeader,
  Footer: ResourceGridFooter,
  Scroller: VirtuosoScroller,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  List: React.forwardRef<HTMLDivElement, any>((props, ref) => (
    <div {...props} ref={ref} role="list" aria-label="资源下载列表" />
  ))
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
  installedModIndex,
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
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const latestLoadMoreRef = useRef({ hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore });

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
    latestLoadMoreRef.current = { hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, loadMoreFailed, onLoadMore]);

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
    const installedLookup = installedModIndex || installedMods;

    const items: ResourceGridItem[] = results.map((project) => ({
      project,
      viewModel: buildProjectViewModel(project),
      isInstalled: checkIsInstalled(project, installedLookup),
      isSkeleton: false
    }));

    if (isLoadingMore) {
      // Append 4 skeleton items at the bottom when loading more
      for (let i = 0; i < 4; i++) {
        items.push({
          project: {
            id: `skeleton-${i}`,
            slug: `skeleton-${i}`,
            title: '',
            description: '',
            icon_url: '',
            author: '',
            downloads: 0,
            date_modified: '',
            client_side: '',
            server_side: ''
          },
          viewModel: {
            loaders: [],
            features: [],
            followerCount: 0,
            supportsClient: false,
            supportsServer: false
          },
          isInstalled: false,
          isSkeleton: true
        });
      }
    }

    return items;
  }, [installedModIndex, installedMods, results, isLoadingMore]);

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
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className="h-full w-full"
      >
        <FocusBoundary
          id="download-results-grid"
          defaultFocusKey="download-grid-item-0"
          className="h-full min-h-0"
        >
          <LayoutGroup id="resource-download-grid-group">
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
              context={{ hasMore, isLoadingMore, loadMoreFailed, onRetryLoadMore }}
              scrollerRef={handleScrollerRef}
              computeItemKey={(_, item) => item.isSkeleton ? item.project.id : getProjectKey(item.project)}
              listClassName="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] px-[1rem] pb-[1.5rem] pt-0"
              components={RESOURCE_GRID_COMPONENTS}
              increaseViewportBy={{ top: 240, bottom: 520 }}
              endReached={triggerLoadMore}
              itemContent={(index, item) => {
                if (item.isSkeleton) {
                  return <ResourceCardSkeleton key={item.project.id} />;
                }
                return (
                  <ResourceCard
                    project={item.project}
                    viewModel={item.viewModel}
                    index={index}
                    isInstalled={item.isInstalled}
                    hasMore={hasMore}
                    canLoadMore={canLoadMore}
                    onLoadMore={triggerLoadMore}
                    onSelectProject={onSelectProject}
                    isSelectionMode={isSelectionMode}
                    isSelected={selectedProjectIds?.has(getProjectKey(item.project)) ?? false}
                    onToggleSelection={onToggleProjectSelection}
                    isNearBottom={index >= results.length - 6}
                    categoryOptions={categoryOptions}
                    onClickAuthor={onClickAuthor}
                    shouldAnimateLayout={shouldAnimateLayout}
                    selectedProjectId={selectedProjectId}
                  />
                );
              }}
            />
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
