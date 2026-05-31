import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { doesFocusableExist, getCurrentFocusKey, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, Check, CheckCircle2, Clock3, Download, Heart, Loader2, Monitor, Server, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { VirtuosoGrid } from 'react-virtuoso';
import { motion, useReducedMotion } from 'framer-motion';
import fabricIcon from '../../../../../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../../../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../../../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../../../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../../../../../assets/icons/tags/loaders/liteloader.svg';

import { FocusBoundary } from '../../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../../ui/focus/FocusItem';
import { OreOverlayScrollArea } from '../../../../../../../ui/primitives/OreOverlayScrollArea';
import { InstalledModIndex, type ModMeta } from '../../../../../logic/modService';
import type { ModrinthProject } from '../../../../../logic/modrinthApi';
import {
  getLocalizedDownloadTagLabel,
  prettifyDownloadTagLabel
} from '../../../../../../Download/logic/downloadTagLabels';
import {
  buildProjectViewModel,
  formatNumber,
  type ProjectViewModel
} from '../../../../../../Download/logic/projectViewModel';

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
  selectedProjectIds?: Set<string>;
  isSelectionMode?: boolean;
  onToggleProjectSelection?: (project: ModrinthProject) => void;
  getProjectKey?: (project: ModrinthProject) => string;
  scrollContainerId?: string;
  onScrollTopChange?: (scrollTop: number) => void;
  onClickAuthor?: (author: string) => void;
  selectedProjectId?: string;
}

interface ResourceCardProps {
  project: ModrinthProject;
  viewModel: ProjectViewModel;
  index: number;
  isInstalled: boolean;
  hasMore: boolean;
  canLoadMore: () => boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelection?: (project: ModrinthProject) => void;
  isNearBottom: boolean;
  onClickAuthor?: (author: string) => void;
  shouldAnimateLayout?: boolean;
  selectedProjectId?: string;
}

interface ResourceGridItem {
  project: ModrinthProject;
  viewModel: ProjectViewModel;
  isInstalled: boolean;
}

interface ResourceGridContext {
  hasMore: boolean;
  isLoadingMore: boolean;
}

const TOP_ROW_KEYS = [
  'inst-filter-search',
  'inst-filter-btn-search',
  'inst-filter-btn-reset'
] as const;

const LOADER_ICON_MAP: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  liteloader: liteloaderIcon
};

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
  Footer: ResourceGridFooter
};

const prettifyLoader = (loader: string) => {
  if (!loader) return 'Vanilla';
  if (loader === 'neoforge') return 'NeoForge';
  return loader.charAt(0).toUpperCase() + loader.slice(1);
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

const ResourceCard = React.memo(({
  project,
  viewModel,
  index,
  isInstalled,
  hasMore,
  canLoadMore,
  onLoadMore,
  onSelectProject,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection,
  isNearBottom,
  onClickAuthor,
  shouldAnimateLayout = false,
  selectedProjectId
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const cardRef = useRef<HTMLDivElement | null>(null);
  const { features, followerCount, loaders, supportsClient, supportsServer } = viewModel;
  const focusKey = `download-grid-item-${index}`;
  const authorLabel = project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' });
  const shouldReduceMotion = useReducedMotion();
  const isSelectedForTransition = project.id && selectedProjectId ? project.id === selectedProjectId : false;

  const timeAgo = (dateStr?: string) => {
    if (!dateStr) return t('download.time.unknown', { defaultValue: 'Unknown time' });

    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));

    if (days === 0) return t('download.time.today', { defaultValue: 'Today' });
    if (days < 30) return t('download.time.daysAgo', { count: days, defaultValue: `${days} days ago` });

    const months = Math.floor(days / 30);
    if (months < 12) return t('download.time.monthsAgo', { count: months, defaultValue: `${months} months ago` });

    const years = Math.floor(months / 12);
    return t('download.time.yearsAgo', { count: years, defaultValue: `${years} years ago` });
  };

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onSelectProject(project)}
      onArrowPress={(direction) => {
        if (direction !== 'up') return true;
        if (index > 0) return true;

        const target = TOP_ROW_KEYS[Math.min(index, TOP_ROW_KEYS.length - 1)];
        if (doesFocusableExist(target)) {
          setFocus(target);
        } else if (doesFocusableExist('inst-filter-search')) {
          setFocus('inst-filter-search');
        }
        return false;
      }}
      onFocus={() => {
        if (isNearBottom && hasMore && canLoadMore()) onLoadMore();
      }}
    >
      {({ ref, focused }) => {
        const focusRef = ref as React.MutableRefObject<HTMLDivElement | null>;
        const setCardNode = (node: HTMLDivElement | null) => {
          cardRef.current = node;
          focusRef.current = node;
        };

        return (
          <motion.div
            ref={setCardNode}
            layout={shouldAnimateLayout}
            onClick={() => {
              if (isSelectionMode) {
                onToggleSelection?.(project);
                return;
              }
              onSelectProject(project);
            }}
            onKeyDown={(event) => {
              if (event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                event.stopPropagation();
                onToggleSelection?.(project);
              }
            }}
            onMouseDown={(event) => {
              if (event.button === 2) {
                event.preventDefault();
                event.stopPropagation();
              }
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onToggleSelection?.(project);
            }}
            role="button"
            tabIndex={-1}
            aria-label={t('download.actions.openProject', {
              defaultValue: `Open ${project.title}`,
              project: project.title
            })}
            className={`
              group relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F]
              text-left transition-none cursor-pointer
              ${focused
                ? 'z-20 bg-[#DDE0E3] brightness-[1.01] outline outline-[4px] outline-[#F5C542] outline-offset-0'
                : 'bg-[#C6C8CB] hover:bg-[#D7DADF] outline-none'}
              ${isSelected ? 'border-[#1D4D13]' : ''}
            `}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : {
              layout: { type: 'spring', stiffness: 300, damping: 30 },
              default: { duration: 0.2, ease: 'easeOut', delay: Math.min(index, 10) * 0.035 }
            }}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -4px #1D4D13, 0 0 8px rgba(0,0,0,0.12)'
                : 'inset 0 -4px #58585A, 0 0 8px rgba(0,0,0,0.10)'
            }}
          >
            <div className={`absolute inset-y-0 left-0 w-1.5 ${isInstalled ? 'bg-[#6CC349]' : 'bg-[#48494A]'}`} />
            <div className="absolute inset-x-0 top-0 h-[0.25rem] bg-white/25" />

            <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pl-[1.125rem] pr-[1rem]">
              <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
                <motion.div
                  layoutId={isSelectedForTransition ? `project-icon-container-${project.id}` : undefined}
                  className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-4px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.15)]"
                >
                  {project.icon_url ? (
                    <motion.img
                      layoutId={isSelectedForTransition ? `project-icon-image-${project.id}` : undefined}
                      src={project.icon_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <motion.div
                      layoutId={isSelectedForTransition ? `project-icon-placeholder-${project.id}` : undefined}
                      className="flex h-full w-full items-center justify-center"
                    >
                      <Blocks className="h-[2.25rem] w-[2.25rem] text-white/75" />
                    </motion.div>
                  )}
                </motion.div>

                <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
                  {loaders.map((loader) => {
                    const normalizedLoader = loader.raw.toLowerCase();
                    const loaderIcon = LOADER_ICON_MAP[normalizedLoader];

                    return (
                      <div
                        key={loader.raw}
                        className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#262729] bg-[#D7CF9A] shadow-[inset_0_-2px_0_#9F955C]"
                        title={t(`download.tags.loader.${normalizedLoader}`, {
                          defaultValue: prettifyDownloadTagLabel(loader.display)
                        })}
                      >
                        {loaderIcon && (
                          <img
                            src={loaderIcon}
                            alt=""
                            className="h-[0.75rem] w-[0.75rem] shrink-0 object-contain opacity-90"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex h-full min-w-0 flex-col justify-between">
                  <div className="min-w-0">
                    {/* 标题行：徽标 shrink-0 排在右侧，标题 min-w-0 截断 */}
                    <div className="flex min-w-0 items-center gap-[0.75rem]">
                      <div className="flex min-w-0 flex-1 items-center gap-[0.625rem]">
                        <div className="min-w-0 truncate font-minecraft text-[1.25rem] font-bold leading-[1.15] text-black">
                          {project.title}
                        </div>
                        {onClickAuthor ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onClickAuthor(authorLabel);
                            }}
                            className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[#4A4C50] hover:text-ore-green hover:underline cursor-pointer transition-colors"
                            title={t('download.actions.searchAuthor', { defaultValue: 'Search mods by {{author}}', author: authorLabel })}
                          >
                            {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author: authorLabel })}
                          </button>
                        ) : (
                          <div className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[#4A4C50]">
                            {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author: authorLabel })}
                          </div>
                        )}
                      </div>
                      {(isInstalled || supportsClient || supportsServer) && (
                        <div className="ml-auto flex shrink-0 items-center justify-end gap-[0.375rem]">
                          {isInstalled && (
                            <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#6CC349] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-2px_0_#3C8527]">
                              <CheckCircle2 className="h-[11px] w-[11px]" />
                              {t('download.status.installed', { defaultValue: 'Installed' })}
                            </div>
                          )}
                          {supportsClient && (
                            <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]">
                              <Monitor className="h-[11px] w-[11px]" />
                              {t('download.env.client', { defaultValue: 'Client' })}
                            </div>
                          )}
                          {supportsServer && (
                            <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]">
                              <Server className="h-[11px] w-[11px]" />
                              {t('download.env.server', { defaultValue: 'Server' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {/* 描述：始终占满全宽，不受徽标数量影响 */}
                    <p className="mt-[0.625rem] truncate text-[0.9375rem] leading-[1.35] text-[#242528]">
                      {project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' })}
                    </p>
                  </div>

                  <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
                    <div className="flex h-full min-w-0 flex-wrap items-center gap-[0.4375rem] overflow-hidden">
                      {features.map((feature) => (
                        <span
                          key={`${feature.raw}-${feature.display}`}
                          className="inline-flex h-[1.375rem] items-center gap-[5px] whitespace-nowrap border-[0.125rem] border-[#262729] bg-[#90A6D6] px-[6px] text-[11px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#61749C]"
                        >
                          <Tags className="h-[0.6875rem] w-[0.6875rem]" strokeWidth={2.5} />
                          {getLocalizedDownloadTagLabel({
                            t,
                            language: i18n.language,
                            source: project.source,
                            raw: feature.raw,
                            display: feature.display
                          })}
                        </span>
                      ))}
                    </div>

                    <div className="flex h-full shrink-0 items-center justify-end gap-x-[0.875rem] gap-y-[0.25rem] text-[0.8125rem] font-minecraft uppercase tracking-[0.08em] text-[#161719]">
                      <span className="flex h-full items-center gap-[0.375rem]">
                        <Download className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                        <span className="leading-none">{formatNumber(project.downloads)}</span>
                      </span>
                      <span className="flex h-full items-center gap-[0.375rem]">
                        <Heart className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                        <span className="leading-none">{formatNumber(followerCount)}</span>
                      </span>
                      <span className="flex h-full items-center gap-[0.375rem] text-[#231A0D]">
                        <Clock3 className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                        <span className="font-bold leading-none">{timeAgo(project.date_modified)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {isSelected && (
              <>
                <span className="pointer-events-none absolute inset-0 z-20 bg-[#1D4D13]/32" />
                <span className="pointer-events-none absolute right-3 top-3 z-40 inline-flex h-8 items-center gap-1.5 border-2 border-[#1D4D13] bg-[#6CC349] px-2 font-minecraft text-[0.6875rem] uppercase tracking-[0.12em] text-[#111214] shadow-[inset_0_-0.1875rem_0_#3C8527,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.24)]">
                  <Check size={13} strokeWidth={3} />
                  命中
                </span>
              </>
            )}
          </motion.div>
        );
      }}
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
  selectedProjectIds,
  isSelectionMode = false,
  onToggleProjectSelection,
  getProjectKey = (project) => project.id || project.project_id || project.slug || project.title,
  scrollContainerId,
  onScrollTopChange,
  onClickAuthor,
  selectedProjectId
}) => {
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const virtuosoRef = useRef<any>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  const loadMoreLockRef = useRef(false);
  const latestRef = useRef({
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore
  });

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
    latestRef.current = { hasMore, isLoading, isLoadingMore, onLoadMore };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore]);

  useEffect(() => {
    if (isLoading || isLoadingMore) return;
    loadMoreLockRef.current = false;
  }, [isLoading, isLoadingMore]);

  const canLoadMore = useCallback(() => {
    const latest = latestRef.current;
    if (!latest.hasMore || latest.isLoading || latest.isLoadingMore || loadMoreLockRef.current) {
      return false;
    }
    return true;
  }, []);

  const triggerLoadMore = useCallback(() => {
    if (!canLoadMore()) return;
    loadMoreLockRef.current = true;
    latestRef.current.onLoadMore();
  }, [canLoadMore]);

  const installedModIndex = useMemo(() => new InstalledModIndex(installedMods), [installedMods]);

  const resourceItems = useMemo(() => results.map((project) => ({
    project,
    viewModel: buildProjectViewModel(project),
    isInstalled: installedModIndex.isInstalled(project)
  })), [installedModIndex, results]);

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
      className="h-full min-h-0 flex-1 overflow-hidden"
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 1.5rem)'
      }}
    >
      <OreOverlayScrollArea
        id={scrollContainerId}
        ref={(node) => {
          scrollContainerRef.current = node;
          setScrollElement(node);
        }}
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
            {emptyLoading ? (
              <div className="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] pb-[1.5rem] pt-[1.5rem]">
                {Array.from({ length: 6 }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : results.length === 0 ? (
              <div className="flex min-h-[22.5rem] flex-col items-center justify-center gap-3 px-6 text-center">
                <Blocks className="h-10 w-10 text-white/35" />
                <div className="font-minecraft text-base text-white">{emptyStateText}</div>
                <div className="text-xs text-gray-400">
                  搜索结果已锁定为 {envText}，不会混入不匹配的结果。
                </div>
              </div>
            ) : (
              <VirtuosoGrid<ResourceGridItem, ResourceGridContext>
                ref={virtuosoRef}
                data={resourceItems}
                context={{ hasMore, isLoadingMore }}
                customScrollParent={scrollElement ?? undefined}
                computeItemKey={(index, item) => `${getProjectKey(item.project)}-${index}`}
                listClassName="grid grid-cols-1 min-[1921px]:grid-cols-2 gap-[0.75rem] pb-[1.5rem] pt-0"
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
                    onClickAuthor={onClickAuthor}
                    shouldAnimateLayout={shouldAnimateLayout}
                    selectedProjectId={selectedProjectId}
                  />
                )}
              />
            )}
          </div>
        </FocusBoundary>
      </OreOverlayScrollArea>
    </div>
  );
};
