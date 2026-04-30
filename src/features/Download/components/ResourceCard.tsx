import React, { useRef } from 'react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { Blocks, CheckCircle2, Clock3, Download, Heart, Monitor, Server, Tags } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';
import { ControlHint } from '../../../ui/components/ControlHint';
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
  isNearBottom,
  categoryOptions
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const timeAgo = useTimeAgo();
  const cardRef = useRef<HTMLButtonElement | null>(null);

  const { features, followerCount, loaders, supportsClient, supportsServer } = viewModel;

  const focusKey = `download-grid-item-${index}`;
  const authorLabel = project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' });
  const summary = project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' });
  const authorTextClassName = authorLabel.length > 36
    ? 'text-[10px]'
    : authorLabel.length > 28
      ? 'text-[11px]'
      : authorLabel.length > 20
        ? 'text-[12px]'
        : 'text-[14px]';

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onSelectProject(project)}
      onArrowPress={(direction) => {
        if (direction !== 'up') return true;
        if (index > 3) return true;

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
              group relative flex min-h-[12.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F]
              text-left outline-none transition-none
              ${focused
                ? 'z-20 bg-[#E6E8EB] brightness-[1.02] outline outline-[0.1875rem] outline-offset-[0.0625rem] outline-white'
                : 'bg-[#D0D1D4] hover:bg-[#E6E8EB]'}
            `}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -0.25rem #1D4D13, 0 0 0.5rem rgba(0,0,0,0.12)'
                : 'inset 0 -0.25rem #58585A, 0 0 0.5rem rgba(0,0,0,0.10)'
            }}
          >
            <div className="absolute inset-x-0 top-0 h-[0.25rem] bg-white/25" />

            <div className="flex w-full gap-[0.875rem] p-[0.9375rem] pr-[1rem]">
              <div className="flex w-[6rem] shrink-0 flex-col gap-[0.625rem]">
                <div className="flex min-h-[8rem] flex-col justify-between">
                  <div className="relative flex h-[6rem] w-[6rem] items-center justify-center overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[#48494A] shadow-[inset_0_-0.25rem_0_#313233,inset_0.125rem_0.125rem_0_rgba(255,255,255,0.15)]">
                    {project.icon_url ? (
                      <img src={project.icon_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <Blocks className="h-[2.75rem] w-[2.75rem] text-white/75" />
                    )}
                  </div>

                  <div className="flex min-h-[2rem] items-center justify-center gap-[0.375rem] overflow-hidden">
                    {loaders.slice(0, 3).map((loader) => {
                      const loaderIcon = LOADER_ICON_MAP[loader.raw.toLowerCase()];
                      if (!loaderIcon) return null;

                      return (
                        <div
                          key={loader.raw}
                          className="flex h-[1.75rem] w-[1.75rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#262729] bg-[#D7CF9A] shadow-[inset_0_-0.125rem_0_#9F955C]"
                          title={loader.display}
                        >
                          <img
                            src={loaderIcon}
                            alt=""
                            className="h-[0.875rem] w-[0.875rem] shrink-0 object-contain opacity-90"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex min-h-[3.125rem] flex-col justify-center px-[0.125rem] py-[0.125rem] text-center">
                  <div className="font-minecraft text-[10px] uppercase leading-[12px] tracking-[0.18em] text-[#4A4C50]">
                    {t('download.meta.author', { defaultValue: 'Author' })}
                  </div>
                  <div className={`mt-[0.3125rem] break-words font-bold leading-[1.1] text-[#161719] ${authorTextClassName}`}>
                    {authorLabel}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex min-h-[8rem] flex-col justify-between">
                  <div className="min-h-[4.25rem]">
                    <div className="flex items-start gap-[0.5rem]">
                      <div className="min-w-0 flex-1 truncate font-minecraft text-[1.1875rem] font-bold leading-[1.15] text-black">
                        {project.title}
                      </div>

                      {(isInstalled || supportsClient || supportsServer) && (
                        <div className="flex shrink-0 items-center gap-[0.375rem] pt-[0.125rem]">
                          {isInstalled && (
                            <div className="inline-flex items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#6CC349] px-[6px] py-[3px] text-[11px] leading-[13px] font-minecraft uppercase tracking-[0.16em] text-black shadow-[inset_0_-0.125rem_0_#3C8527] sm:text-[10px] sm:leading-[12px]">
                              <CheckCircle2 className="h-[11px] w-[11px]" />
                              {t('download.status.installed', { defaultValue: 'Installed' })}
                            </div>
                          )}
                          {supportsClient && (
                            <div className="inline-flex items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] py-[3px] text-[11px] leading-[13px] font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)] sm:text-[10px] sm:leading-[12px]">
                              <Monitor className="h-[11px] w-[11px]" />
                              {t('download.env.client', { defaultValue: 'Client' })}
                            </div>
                          )}
                          {supportsServer && (
                            <div className="inline-flex items-center gap-1 border-[0.125rem] border-[#1E1E1F] bg-[#313233] px-[6px] py-[3px] text-[11px] leading-[13px] font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)] sm:text-[10px] sm:leading-[12px]">
                              <Server className="h-[11px] w-[11px]" />
                              {t('download.env.server', { defaultValue: 'Server' })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <p className="mt-[0.5rem] min-h-[2.5rem] line-clamp-2 text-[0.9375rem] leading-[1.35] text-[#313233]">
                      {summary}
                    </p>
                  </div>

                  <div className="mt-[0.75rem] flex min-h-[2rem] shrink-0 flex-wrap content-end gap-[0.4375rem] overflow-hidden">
                    {features.map((feature) => {
                      const configuredFeature = findDownloadTagOption(categoryOptions || [], feature.raw, feature.display);
                      return (
                        <span
                          key={`${feature.raw}-${feature.display}`}
                          className="inline-flex items-center gap-[5px] whitespace-nowrap border-[0.125rem] border-[#262729] bg-[#90A6D6] px-[9px] py-[4px] text-[12px] leading-[14px] font-minecraft uppercase tracking-[0.14em] text-black shadow-[inset_0_-0.125rem_0_#61749C]"
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

                <div className="flex min-h-[3.125rem] shrink-0 items-center justify-between gap-[0.625rem] px-[0.125rem] py-[0.25rem]">
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
