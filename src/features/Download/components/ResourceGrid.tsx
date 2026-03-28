import React, { useCallback, useEffect, useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, CheckCircle2, Clock3, Download, Heart, Loader2, Monitor, Tags } from 'lucide-react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { ControlHint } from '../../../ui/components/ControlHint';
import type { ModMeta } from '../../InstanceDetail/logic/modService';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import {
  getCurseForgeCategoryFallbackLabel,
  getCurseForgeCategoryTranslationKey
} from '../logic/curseforgeApi';

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
}

const KNOWN_LOADERS = ['fabric', 'forge', 'neoforge', 'quilt', 'liteloader'];

const formatNumber = (value?: number) => {
  if (!value) return '0';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
};

export const prettifyDownloadTagLabel = (value: string) =>
  value
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const normalizeDownloadTagKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_');

interface DownloadTagLabelOptions {
  t: TFunction;
  language?: string;
  source?: string;
  raw: string;
  display?: string;
  translationKey?: string;
  defaultLabel?: string;
  labels?: Record<string, string>;
}

const resolveConfiguredLabel = (labels?: Record<string, string>, language?: string) => {
  if (!labels) return '';

  const exact = language ? labels[language] : '';
  if (exact) return exact;

  const baseLanguage = language?.split('-')[0];
  if (baseLanguage) {
    const matchedEntry = Object.entries(labels).find(([key]) => key.split('-')[0] === baseLanguage);
    if (matchedEntry?.[1]) return matchedEntry[1];
  }

  return labels['en-US'] || labels.en || Object.values(labels)[0] || '';
};

export const getLocalizedDownloadTagLabel = ({
  t,
  language,
  source,
  raw,
  display,
  translationKey,
  defaultLabel,
  labels
}: DownloadTagLabelOptions) => {
  const configuredLabel = resolveConfiguredLabel(labels, language);
  if (configuredLabel) {
    return configuredLabel;
  }

  if (source === 'curseforge') {
    return t(getCurseForgeCategoryTranslationKey(raw), {
      defaultValue: getCurseForgeCategoryFallbackLabel(raw, display || defaultLabel || '')
    });
  }

  return t(translationKey || `download.categories.${normalizeDownloadTagKey(raw)}`, {
    defaultValue: defaultLabel || prettifyDownloadTagLabel(display || raw)
  });
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
  isNearBottom
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const cardRef = useRef<HTMLButtonElement | null>(null);
  const rawProject = project as ModrinthProject & { display_categories?: string[]; followers?: number };

  const categoryItems = (rawProject.categories || []).map((raw, idx) => ({
    raw,
    display: rawProject.display_categories?.[idx] || raw
  }));

  const loaders = categoryItems.filter((item) => KNOWN_LOADERS.includes(item.raw.toLowerCase())).slice(0, 2);
  const features = categoryItems.filter((item) => !KNOWN_LOADERS.includes(item.raw.toLowerCase())).slice(0, 3);
  const followerCount = rawProject.followers || rawProject.follows || 0;
  const supportsClient = project.client_side !== 'unsupported' && !!project.client_side;
  const focusKey = `download-grid-item-${index}`;

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
              group relative flex min-h-[160px] w-full overflow-hidden border-[2px] border-[#1E1E1F] text-left outline-none transition-none
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

            {isInstalled && (
              <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 border-[2px] border-[#1E1E1F] bg-[#6CC349] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-2px_0_#3C8527]">
                <CheckCircle2 size={10} />
                {t('download.status.installed', { defaultValue: 'Installed' })}
              </div>
            )}

            <div className="flex w-full gap-3 p-3 pr-4">
              <div className="flex w-20 shrink-0 flex-col gap-1.5">
                <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-4px_0_#313233,inset_2px_2px_0_rgba(255,255,255,0.15)]">
                  {project.icon_url ? (
                    <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <Blocks className="h-10 w-10 text-white/75" />
                  )}
                </div>

                <div className="mt-auto flex h-[38px] flex-col items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#48494A] px-1 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
                  <div className="font-minecraft text-[9px] uppercase tracking-[0.18em] text-[#B1B2B5] leading-none">
                    {t('download.meta.author', { defaultValue: 'Author' })}
                  </div>
                  <div className="w-full truncate pt-1 text-center text-[11px] font-bold leading-none text-white">
                    {project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' })}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="pr-16">
                  <div className="truncate font-minecraft text-lg font-bold leading-tight text-black">{project.title}</div>
                  <p className="mt-1.5 line-clamp-1 text-xs leading-[18px] text-[#313233]">
                    {project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' })}
                  </p>
                </div>

                <div className="mt-2 mb-2.5 flex h-[22px] shrink-0 flex-wrap gap-1.5 overflow-hidden">
                  {supportsClient && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#313233] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-white shadow-[inset_0_2px_0_rgba(255,255,255,0.12)]">
                      <Monitor size={10} />
                      {t('download.tags.clientSide', { defaultValue: 'Client-side' })}
                    </span>
                  )}

                  {loaders.map((loader) => (
                    <span
                      key={loader.raw}
                      className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#FFE866] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#C9B12D]"
                    >
                      {t(`download.tags.loader.${loader.raw.toLowerCase()}`, {
                        defaultValue: prettifyDownloadTagLabel(loader.display)
                      })}
                    </span>
                  ))}

                  {features.map((feature) => (
                    <span
                      key={`${feature.raw}-${feature.display}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap border-[2px] border-[#1E1E1F] bg-[#8CB3FF] px-1.5 py-0.5 text-[9px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-2px_0_#5C82CA]"
                    >
                      <Tags size={9} />
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

                <div className="mt-auto flex h-[38px] shrink-0 items-center justify-between gap-2 overflow-hidden border-[2px] border-[#1E1E1F] bg-[#48494A] px-2.5 shadow-[inset_0_2px_0_rgba(255,255,255,0.08)]">
                  <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs font-minecraft uppercase tracking-[0.08em] text-[#E6E8EB]">
                    <span className="flex items-center gap-1.5">
                      <Download size={12} />
                      {formatNumber(project.downloads)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Heart size={12} />
                      {formatNumber(followerCount)}
                    </span>
                    <span className="flex items-center gap-1.5 text-[#FFE866]">
                      <Clock3 size={12} />
                      <span className="mt-0.5">{timeAgo(project.date_modified)}</span>
                    </span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <ControlHint label="A" variant="face" tone="green" />
                    <span className="font-minecraft text-[10px] uppercase tracking-[0.16em] text-[#E6E8EB]">
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
  onScrollTopChange
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
      className="h-full min-h-0 flex-1 overflow-y-auto custom-scrollbar"
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
        <div className="min-h-full px-4 pb-5 pt-4">
          {isLoading ? (
            <div className="flex h-full min-h-[360px] items-center justify-center">
              <Loader2 size={44} className="animate-spin text-ore-green" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 pb-6 lg:grid-cols-2 2xl:grid-cols-3">
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
