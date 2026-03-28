import React, { useCallback, useEffect, useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, CheckCircle2, Download, Heart, Loader2 } from 'lucide-react';

import { FocusBoundary } from '../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../ui/focus/FocusItem';
import type { ModMeta } from '../../../logic/modService';
import type { ModrinthProject } from '../../../logic/modrinthApi';

interface ResourceGridProps {
  results: ModrinthProject[];
  installedMods: ModMeta[];
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore: boolean;
  resourceTab?: 'mod' | 'resourcepack' | 'shader';
  lockedMcVersion?: string;
  lockedLoaderType?: string;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  scrollContainerId?: string;
  onScrollTopChange?: (scrollTop: number) => void;
}

interface ResourceCardProps {
  project: ModrinthProject;
  index: number;
  isInstalled: boolean;
  onSelectProject: (project: ModrinthProject) => void;
}

const TOP_ROW_KEYS = ['inst-filter-search', 'inst-filter-btn-search', 'inst-filter-btn-reset'] as const;

const formatNumber = (value?: number) => {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

const prettifyLoader = (loader: string) => {
  if (!loader) return 'Vanilla';
  if (loader === 'neoforge') return 'NeoForge';
  return loader.charAt(0).toUpperCase() + loader.slice(1);
};

const ResourceCard = React.memo(({
  project,
  index,
  isInstalled,
  onSelectProject
}: ResourceCardProps) => {
  const focusKey = `download-grid-item-${index}`;
  const followers = (project as ModrinthProject & { followers?: number }).followers || project.follows || 0;

  const handleArrowPress = (direction: string) => {
    if (direction !== 'up') return true;
    if (index > 2) return true;

    const target = TOP_ROW_KEYS[Math.min(index, TOP_ROW_KEYS.length - 1)];
    if (doesFocusableExist(target)) {
      setFocus(target);
    } else if (doesFocusableExist('inst-filter-search')) {
      setFocus('inst-filter-search');
    }
    return false;
  };

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onSelectProject(project)}
      onArrowPress={handleArrowPress}
    >
      {({ ref, focused }) => (
        <button
          ref={ref as React.RefObject<HTMLButtonElement>}
          type="button"
          onClick={() => onSelectProject(project)}
          tabIndex={-1}
          className={`relative flex min-h-[150px] w-full flex-col overflow-hidden border-2 text-left outline-none transition-none ${
            focused
              ? 'border-white bg-[#E6E8EB] brightness-105 shadow-[0_0_12px_rgba(255,255,255,0.25)]'
              : 'border-[#1E1E1F] bg-[#D0D1D4]'
          }`}
        >
          {isInstalled && (
            <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 border-2 border-[#1E1E1F] bg-[#6CC349] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.16em] text-black">
              <CheckCircle2 size={10} />
              Installed
            </div>
          )}

          <div className="flex gap-3 p-3">
            <div className="h-20 w-20 shrink-0 overflow-hidden border-2 border-[#1E1E1F] bg-[#48494A]">
              {project.icon_url ? (
                <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Blocks className="h-8 w-8 text-white/70" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate font-minecraft text-base font-bold text-black">{project.title}</div>
              <p className="mt-1 line-clamp-2 text-xs text-[#313233]">
                {project.description?.trim() || 'No description provided.'}
              </p>
            </div>
          </div>

          <div className="mt-auto flex items-center justify-between border-t-2 border-[#1E1E1F] bg-[#48494A] px-3 py-2 text-xs font-minecraft text-[#E6E8EB]">
            <span className="inline-flex items-center gap-1.5">
              <Download size={12} />
              {formatNumber(project.downloads)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Heart size={12} />
              {formatNumber(followers)}
            </span>
          </div>
        </button>
      )}
    </FocusItem>
  );
});

ResourceCard.displayName = 'InstanceResourceCard';

export const ResourceGrid: React.FC<ResourceGridProps> = ({
  results,
  installedMods,
  isLoading,
  isLoadingMore = false,
  hasMore,
  resourceTab = 'mod',
  lockedMcVersion = '',
  lockedLoaderType = '',
  onLoadMore,
  onSelectProject,
  scrollContainerId,
  onScrollTopChange
}) => {
  // Simplification of constants, removing intricate locking intervals.
  // The loadLockRef should be sufficient for concurrency control.
  const AUTO_FILL_MAX_PAGES = 2;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerTargetRef = useRef<HTMLDivElement>(null);
  const loadLockRef = useRef(false);
  const autoFillCountRef = useRef(0);
  const latestRef = useRef({ hasMore, isLoading, isLoadingMore, onLoadMore });

  useEffect(() => {
    latestRef.current = { hasMore, isLoading, isLoadingMore, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  // Use a effect to release the load lock when loading finishes.
  useEffect(() => {
    if (!isLoading && !isLoadingMore) {
      loadLockRef.current = false;
    }
  }, [isLoading, isLoadingMore, results.length]);

  const tryLoadMore = useCallback(() => {
    const latest = latestRef.current;
    if (!latest.hasMore || latest.isLoading || latest.isLoadingMore || loadLockRef.current) {
      return;
    }

    loadLockRef.current = true;
    latest.onLoadMore();
  }, []);

  const isInstalled = useCallback(
    (project: ModrinthProject) =>
      installedMods.some(
        (mod) =>
          mod.modId === project.id ||
          (mod.fileName || '').toLowerCase().includes((project.slug || '').toLowerCase())
      ),
    [installedMods]
  );

  // IntersectionObserver to handle lazy loading at the bottom.
  useEffect(() => {
    const host = scrollContainerRef.current;
    const target = observerTargetRef.current;
    if (!host || !target) return;
    if (isLoading || isLoadingMore) return;

    // Use a clean intersection observer. No arming/disarming here.
    // The loadLockRef and prop checks are sufficient.
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;

        if (entry.isIntersecting) {
          tryLoadMore();
        }
      },
      { root: host, rootMargin: '80px', threshold: 0.05 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isLoading, isLoadingMore, tryLoadMore, results.length]);

  // Reset autoFillCount when results array is empty.
  useEffect(() => {
    if (results.length !== 0) return;
    autoFillCountRef.current = 0;
  }, [results.length]);

  // Auto-fill logic when the page first loads and there is no scrollbar.
  useEffect(() => {
    const host = scrollContainerRef.current;
    if (!host || isLoading || isLoadingMore || !hasMore) return;

    const hasScrollbar = host.scrollHeight > host.clientHeight + 16;
    if (hasScrollbar) return;
    if (autoFillCountRef.current >= AUTO_FILL_MAX_PAGES) return;

    autoFillCountRef.current += 1;
    tryLoadMore();
  }, [AUTO_FILL_MAX_PAGES, hasMore, isLoading, isLoadingMore, results.length, tryLoadMore]);

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
      id={scrollContainerId}
      ref={scrollContainerRef}
      className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain custom-scrollbar"
      onScroll={(e) => {
        const el = e.currentTarget;
        onScrollTopChange?.(el.scrollTop);
        // The checkAndLoadWhenNearBottom is removed.
        // We now rely solely on the IntersectionObserver for lazy loading.
      }}
    >
      <FocusBoundary id="instance-download-results-grid" defaultFocusKey="download-grid-item-0" className="min-h-full">
        <div className="min-h-full px-4 pb-5 pt-4">
          {emptyLoading ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <Loader2 size={44} className="animate-spin text-ore-green" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
              <Blocks className="h-10 w-10 text-white/35" />
              <div className="font-minecraft text-base text-white">{emptyStateText}</div>
              <div className="text-xs text-gray-400">
                搜索结果已锁定为 {envText}，不会混入不匹配的结果。
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2 2xl:grid-cols-3">
              {results.map((project, index) => (
                <ResourceCard
                  key={`${project.id}-${index}`}
                  project={project}
                  index={index}
                  isInstalled={isInstalled(project)}
                  onSelectProject={onSelectProject}
                />
              ))}

              {results.length > 0 && hasMore && (
                <div ref={observerTargetRef} className="col-span-full flex h-16 items-center justify-center">
                  <Loader2 size={24} className={`text-ore-green opacity-60 ${isLoadingMore ? 'animate-spin' : ''}`} />
                </div>
              )}
            </div>
          )}
        </div>
      </FocusBoundary>
    </div>
  );
};
