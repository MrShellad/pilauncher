import React, { useCallback, useEffect, useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, CheckCircle2, Clock3, Download, Heart, Loader2, Monitor, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { ControlHint } from '../../../ui/components/ControlHint';
import type { ModMeta } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { FilterOption } from '../hooks/useResourceDownload';
import {
  findDownloadTagOption,
  getLocalizedDownloadTagLabel,
  prettifyDownloadTagLabel
} from '../logic/downloadTagLabels';

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

interface ResourceCardProps {
  project: ModrinthProject;
  index: number;
  isInstalled: boolean;
  hasMore: boolean;
  canLoadMore: () => boolean;
  onLoadMore: () => void;
  onSelectProject: (project: ModrinthProject) => void;
  isNearBottom: boolean;
  categoryOptions?: FilterOption[];
}

const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'];
const LOADER_PRIORITY: Record<string, number> = {
  neoforge: 0,
  fabric: 1,
  forge: 2,
  quilt: 3,
  liteloader: 4
};
const LOADER_ICON_MAP: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  liteloader: liteloaderIcon
};

const formatNumber = (value?: number) => {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

const filterFallbackTargets = [
  'filter-mc-version',
  'filter-loader',
  'filter-category',
  'filter-sort'
] as const;

const ResourceCard = React.memo(({
  project,
  index,
  isInstalled,
  hasMore,
  canLoadMore,
  onLoadMore,
  onSelectProject,
  isNearBottom,
  categoryOptions
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const rawProject = project as ModrinthProject & { display_categories?: string[]; followers?: number };

  const categoryItems = (rawProject.categories || []).map((raw, idx) => ({
    raw,
    display: rawProject.display_categories?.[idx] || raw
  }));

  const loaders = categoryItems
    .filter((item) => KNOWN_LOADERS.includes(item.raw.toLowerCase()))
    .sort((a, b) => {
      const aPriority = LOADER_PRIORITY[a.raw.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
      const bPriority = LOADER_PRIORITY[b.raw.toLowerCase()] ?? Number.MAX_SAFE_INTEGER;
      return aPriority - bPriority;
    })
    .slice(0, 3);
  const features = categoryItems.filter((item) => !KNOWN_LOADERS.includes(item.raw.toLowerCase())).slice(0, 3);
  const followerCount = rawProject.followers || rawProject.follows || 0;
  const supportsClient = project.client_side !== 'unsupported' && !!project.client_side;
  const focusKey = `download-grid-item-${index}`;
  const titlePadClass = isInstalled && supportsClient
    ? 'pr-[10rem]'
    : isInstalled || supportsClient
      ? 'pr-[5.75rem]'
      : '';

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
        if (index > 3) return true;

        const preferredTarget = filterFallbackTargets[Math.min(index, filterFallbackTargets.length - 1)];
        const target = [
          preferredTarget,
          'download-btn-search',
          'download-search-input',
          'filter-source-toggle'
        ].find((key) => doesFocusableExist(key));

        if (target) setFocus(target);
        return false;
      }}
      onFocus={() => {
        if (isNearBottom && hasMore && canLoadMore()) onLoadMore();
      }}
    >
      {({ ref, focused }) => {
        const focusRef = ref as React.MutableRefObject<HTMLButtonElement | null>;
        const setCardNode = (node: HTMLButtonElement | null) => {
          cardRef.current = node;
          focusRef.current = node;
        };

        return (
          <button
            ref={setCardNode}
            type="button"
            onClick={() => onSelectProject(project)}
            tabIndex={-1}
            aria-label={t('download.actions.openProject', {
              defaultValue: `Open ${project.title}`,
              project: project.title
            })}
            className={`
              group relative flex min-h-[12.5rem] w-full overflow-hidden border-[2px] border-[#1E1E1F] text-left outline-none transition-none
              ${focused
                ? 'z-20 bg-[#E6E8EB] brightness-[1.02] outline outline-[3px] outline-offset-[1px] outline-white drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]'
                : 'bg-[#D0D1D4] hover:bg-[#E6E8EB]'}
            `}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -4px #1D4D13, inset 2px 2px rgba(255,255,255,0.7), inset -2px -6px rgba(255,255,255,0.3)'
                : 'inset 0 -4px #58585A, inset 2px 2px rgba(255,255,255,0.7), inset -2px -6px rgba(255,255,255,0.38)'
            }}
          >
            <div className={`absolute inset-y-0 left-0 w-1.5 ${isInstalled ? 'bg-[#6CC349]' : 'bg-[#48494A]'}`} />
            <div className="absolute inset-x-0 top-0 h-[4px] bg-white/25" />

            {(isInstalled || supportsClient) && (
              <div className="absolute right-2 top-2 z-10 flex items-center gap-[0.375rem]">
                {isInstalled && (
                  <div className="inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#6CC349] px-[0.375rem] py-[0.1875rem] text-[0.6875rem] font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-2px_0_#3C8527] sm:text-[0.625rem]">
                    <CheckCircle2 className="h-[0.6875rem] w-[0.6875rem]" />
                    {t('download.status.installed', { defaultValue: 'Installed' })}
                  </div>
                )}

                {supportsClient && (
                  <div className="inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#313233] px-[0.375rem] py-[0.1875rem] text-[0.6875rem] font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.12)] sm:text-[0.625rem]">
                    <Monitor className="h-[0.6875rem] w-[0.6875rem]" />
                    {t('download.tags.clientSide', { defaultValue: 'Client-side' })}
                  </div>
                )}
              </div>
            )}

            <div className="flex w-full gap-[0.875rem] p-[0.9375rem] pr-[1rem]">
              <div className="flex w-[6rem] shrink-0 flex-col gap-[0.625rem]">
                <div className="flex min-h-[8rem] flex-col justify-between">
                  <div className="relative flex h-[6rem] w-[6rem] items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-4px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.15)]">
                    {project.icon_url ? (
                      <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Blocks className="h-[2.75rem] w-[2.75rem] text-white/75" />
                    )}
                  </div>

                  <div className="flex min-h-[2rem] items-center justify-center gap-[0.375rem] overflow-hidden">
                    {loaders.map((loader) => {
                      const normalizedLoader = loader.raw.toLowerCase();
                      const loaderIcon = LOADER_ICON_MAP[normalizedLoader];

                      return (
                        <div
                          key={loader.raw}
                          className="flex h-[1.75rem] w-[1.75rem] shrink-0 items-center justify-center overflow-hidden border-[2px] border-[#262729] bg-[#D7CF9A] shadow-[inset_0_-2px_0_#9F955C]"
                          title={t(`download.tags.loader.${normalizedLoader}`, {
                            defaultValue: prettifyDownloadTagLabel(loader.display)
                          })}
                        >
                          {loaderIcon && (
                            <img
                              src={loaderIcon}
                              alt=""
                              className="h-[0.875rem] w-[0.875rem] shrink-0 object-contain opacity-90"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[3.125rem] flex-col items-center justify-center overflow-hidden border-[2px] border-[#34363A] bg-[#8A8D93] px-[0.375rem] py-[0.375rem] shadow-[inset_0_2px_0_rgba(255,255,255,0.16)]">
                  <div className="font-minecraft text-[0.625rem] uppercase leading-none tracking-[0.18em] text-[#2B2D30]">
                    {t('download.meta.author', { defaultValue: 'Author' })}
                  </div>
                  <div className="w-full truncate pt-[0.25rem] text-center text-[0.875rem] font-bold leading-none text-[#161719]">
                    {project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' })}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex min-h-[8rem] flex-col justify-between pr-[4.75rem]">
                  <div className="min-h-[4.25rem]">
                    <div className={`truncate font-minecraft text-[1.1875rem] font-bold leading-[1.15] text-black ${titlePadClass}`}>
                      {project.title}
                    </div>
                    <p className={`mt-[0.5rem] min-h-[2.5rem] line-clamp-2 text-[0.9375rem] leading-[1.35] text-[#313233] ${titlePadClass}`}>
                      {project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' })}
                    </p>
                  </div>

                  <div className="mt-[0.75rem] flex min-h-[2rem] shrink-0 flex-wrap content-end gap-[0.4375rem] overflow-hidden">
                    {features.map((feature) => {
                      const configuredFeature = findDownloadTagOption(categoryOptions || [], feature.raw, feature.display);

                      return (
                        <span
                          key={`${feature.raw}-${feature.display}`}
                          className="inline-flex items-center gap-[0.3125rem] whitespace-nowrap border-[2px] border-[#262729] bg-[#90A6D6] px-[0.5625rem] py-[0.25rem] text-[0.75rem] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#61749C]"
                        >
                          <Tags className="h-[0.75rem] w-[0.75rem]" />
                          {getLocalizedDownloadTagLabel({
                            t,
                            language: i18n.language,
                            source: project.source,
                            raw: feature.raw,
                            display: feature.display,
                            translationKey: configuredFeature?.translationKey,
                            defaultLabel: configuredFeature?.defaultLabel,
                            labels: configuredFeature?.labels
                          })}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[3.125rem] shrink-0 items-center justify-between gap-[0.625rem] overflow-hidden border-[2px] border-[#34363A] bg-[#8A8D93] px-[0.75rem] py-[0.5rem] shadow-[inset_0_2px_0_rgba(255,255,255,0.16)]">
                  <div className="flex flex-wrap items-center gap-x-[0.875rem] gap-y-[0.25rem] text-[0.8125rem] font-minecraft uppercase tracking-[0.08em] text-[#161719]">
                    <span className="flex items-center gap-[0.375rem]">
                      <Download className="h-[0.8125rem] w-[0.8125rem]" />
                      {formatNumber(project.downloads)}
                    </span>
                    <span className="flex items-center gap-[0.375rem]">
                      <Heart className="h-[0.8125rem] w-[0.8125rem]" />
                      {formatNumber(followerCount)}
                    </span>
                    <span className="flex items-center gap-[0.375rem] text-[#231A0D]">
                      <Clock3 className="h-[0.8125rem] w-[0.8125rem]" />
                      <span className="mt-[0.0625rem] font-bold">{timeAgo(project.date_modified)}</span>
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-[0.375rem]">
                    <ControlHint label="A" variant="face" tone="green" />
                    <span className="font-minecraft text-[0.75rem] uppercase tracking-[0.16em] text-[#161719]">
                      {t('download.actions.details', { defaultValue: 'Details' })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

ResourceCard.displayName = 'ResourceCard';

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
  const observerTarget = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreLockRef = useRef(false);
  const latestRef = useRef({
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore
  });

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

  useEffect(() => {
    const scrollHost = scrollContainerRef.current;
    const target = observerTarget.current;
    if (!scrollHost || !target) return;

    if (isLoading || isLoadingMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          triggerLoadMore();
        }
      },
      { root: scrollHost, rootMargin: '100px', threshold: 0.1 }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [triggerLoadMore, results.length, isLoading, isLoadingMore]);

  const checkIsInstalled = (project: ModrinthProject) => (
    installedMods.some((mod) =>
      mod.modId === project.id || (mod.fileName || '').toLowerCase().includes((project.slug || '').toLowerCase())
    )
  );

  return (
    <div
      id={scrollContainerId}
      ref={scrollContainerRef}
      className="h-full min-h-0 flex-1 overflow-y-auto scroll-smooth custom-scrollbar"
      onScroll={(e) => {
        if (!onScrollTopChange) return;
        const el = e.currentTarget;
        onScrollTopChange(el.scrollTop);
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
                  isInstalled={checkIsInstalled(project)}
                  hasMore={hasMore}
                  canLoadMore={canLoadMore}
                  onLoadMore={triggerLoadMore}
                  onSelectProject={onSelectProject}
                  isNearBottom={index >= results.length - 6}
                  categoryOptions={categoryOptions}
                />
              ))}

              {results.length > 0 && hasMore && (
                <div ref={observerTarget} className="col-span-full flex h-16 items-center justify-center">
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
