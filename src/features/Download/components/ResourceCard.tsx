import React, { useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { Blocks, Check, CheckCircle2, Clock3, Download, Heart, Monitor, Server, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';
import { FocusItem } from '../../../ui/focus/FocusItem';
import type { ModrinthProject } from '../../InstanceDetail/logic/modrinthApi';
import type { FilterOption } from '../hooks/useResourceDownload';
import {
  findDownloadTagOption,
  getLocalizedDownloadTagLabel
} from '../logic/downloadTagLabels';
import {
  formatNumber,
  type ProjectViewModel
} from '../logic/projectViewModel';

const FILTER_FALLBACK_TARGETS = [
  'filter-mc-version',
  'filter-loader',
  'filter-category',
  'filter-sort'
] as const;

const LOADER_ICON_MAP: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  liteloader: liteloaderIcon
};

export interface ResourceCardProps {
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
  categoryOptions?: FilterOption[];
}

function useTimeAgo() {
  const { t } = useTranslation();

  return (dateStr?: string) => {
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
}

export const ResourceCard = React.memo(({
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
  categoryOptions
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const timeAgo = useTimeAgo();
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLButtonElement | null>(null);

  const { features, followerCount, loaders, supportsClient, supportsServer } = viewModel;

  const focusKey = `download-grid-item-${index}`;
  const authorLabel = project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' });
  const summary = project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' });

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onSelectProject(project)}
      onArrowPress={(direction) => {
        if (direction !== 'up') return true;
        if (index > 0) return true;

        const preferredTarget = FILTER_FALLBACK_TARGETS[Math.min(index, FILTER_FALLBACK_TARGETS.length - 1)];
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
          <motion.button
            ref={setCardNode}
            type="button"
            onClick={() => {
              if (isSelectionMode) {
                onToggleSelection?.(project);
                return;
              }
              onSelectProject(project);
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
            tabIndex={-1}
            aria-label={t('download.actions.openProject', {
              defaultValue: `Open ${project.title}`,
              project: project.title
            })}
            className={`
              group relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F]
              text-left outline-none transition-none
              ${focused
                ? 'z-20 bg-[#DDE0E3] brightness-[1.01]'
                : 'bg-[#C6C8CB] hover:bg-[#D7DADF]'}
              ${isSelected ? 'border-[#1D4D13]' : ''}
            `}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{
              duration: 0.2,
              ease: 'easeOut',
              delay: shouldReduceMotion ? 0 : Math.min(index, 10) * 0.035
            }}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -0.25rem #1D4D13, 0 0 0.5rem rgba(0,0,0,0.12)'
                : 'inset 0 -0.25rem #58585A, 0 0 0.5rem rgba(0,0,0,0.10)'
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[0.25rem] bg-white/25" />

            <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pr-[1rem]">
              <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
                <div className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-0.25rem_0_#313233,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.15)]">
                  {project.icon_url ? (
                    <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <Blocks className="h-[2.25rem] w-[2.25rem] text-white/75" />
                  )}
                </div>

                <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
                  {loaders.slice(0, 3).map((loader) => {
                    const loaderIcon = LOADER_ICON_MAP[loader.raw.toLowerCase()];
                    if (!loaderIcon) return null;

                    return (
                      <div
                        key={loader.raw}
                        className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#262729] bg-[#D7CF9A] shadow-[inset_0_-0.125rem_0_#9F955C]"
                        title={loader.display}
                      >
                        <img
                          src={loaderIcon}
                          alt=""
                          className="h-[0.75rem] w-[0.75rem] shrink-0 object-contain opacity-90"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex min-w-0 items-center gap-[0.75rem]">
                  <div className="flex min-w-0 flex-1 items-center gap-[0.625rem]">
                    <div className="min-w-0 truncate font-minecraft text-[1.25rem] font-bold leading-[1.15] text-black">
                      {project.title}
                    </div>
                    <div className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[#4A4C50]">
                      {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author: authorLabel })}
                    </div>
                  </div>

                  {(isInstalled || supportsClient || supportsServer) && (
                    <div className="ml-auto flex shrink-0 items-center justify-end gap-[0.375rem]">
                      {isInstalled && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#6CC349] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-0.125rem_0_#3C8527]">
                          <CheckCircle2 className="h-[11px] w-[11px]" />
                          {t('download.status.installed', { defaultValue: 'Installed' })}
                        </div>
                      )}
                      {supportsClient && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)]">
                          <Monitor className="h-[11px] w-[11px]" />
                          {t('download.env.client', { defaultValue: 'Client' })}
                        </div>
                      )}
                      {supportsServer && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)]">
                          <Server className="h-[11px] w-[11px]" />
                          {t('download.env.server', { defaultValue: 'Server' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <p className="my-auto truncate text-[0.9375rem] leading-[1.35] text-[#242528]">
                  {summary}
                </p>

                <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
                  <div className="flex h-full min-w-0 flex-wrap items-center gap-[0.4375rem] overflow-hidden">
                    {features.map((feature) => {
                      const configuredFeature = findDownloadTagOption(categoryOptions || [], feature.raw, feature.display);
                      return (
                        <span
                          key={`${feature.raw}-${feature.display}`}
                          className="inline-flex h-[1.375rem] items-center gap-[5px] whitespace-nowrap border-[0.125rem] border-[#262729] bg-[#90A6D6] px-[6px] text-[11px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-0.125rem_0_#61749C]"
                        >
                          <Tags className="h-[0.6875rem] w-[0.6875rem]" strokeWidth={2.5} />
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
            {focused && (
              <span className="pointer-events-none absolute inset-0 z-30 border-[0.1875rem] border-[#F5C542]" />
            )}
            {isSelected && (
              <>
                <span className="pointer-events-none absolute inset-0 z-20 bg-[#1D4D13]/32" />
                <span className="pointer-events-none absolute right-3 top-3 z-40 inline-flex h-8 items-center gap-1.5 border-2 border-[#1D4D13] bg-[#6CC349] px-2 font-minecraft text-[0.6875rem] uppercase tracking-[0.12em] text-[#111214] shadow-[inset_0_-0.1875rem_0_#3C8527,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.24)]">
                  <Check size={13} strokeWidth={3} />
                  命中
                </span>
              </>
            )}
          </motion.button>
        );
      }}
    </FocusItem>
  );
});

ResourceCard.displayName = 'ResourceCard';
