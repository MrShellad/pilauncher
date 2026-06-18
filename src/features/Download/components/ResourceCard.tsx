import React, { useRef, useEffect } from 'react';
import { useIconCacheStore } from '../logic/iconCache';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { motion, useReducedMotion } from 'motion/react';
import { Blocks, Check, CheckCircle2, Clock3, Download, Globe2, Heart, Monitor, Package, Server, Tags } from 'lucide-react';
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
  onClickAuthor?: (author: string) => void;
  shouldAnimateLayout?: boolean;
  selectedProjectId?: string;
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
  categoryOptions,
  onClickAuthor,
  shouldAnimateLayout = false,
  selectedProjectId
}: ResourceCardProps) => {
  const { t, i18n } = useTranslation();
  const timeAgo = useTimeAgo();
  const shouldReduceMotion = useReducedMotion();
  const cardRef = useRef<HTMLDivElement | null>(null);

  const cachedIconUrl = useIconCacheStore((state) => project.icon_url ? state.cachedUrls[project.icon_url] || '' : '');
  const loadIcon = useIconCacheStore((state) => state.loadIcon);

  useEffect(() => {
    if (project.icon_url) {
      void loadIcon(project.icon_url);
    }
  }, [project.icon_url, loadIcon]);

  const { features, followerCount, loaders, supportsClient, supportsServer } = viewModel;

  const focusKey = `download-grid-item-${index}`;
  const authorLabel = project.author || t('download.meta.unknownAuthor', { defaultValue: 'Unknown' });
  const summary = project.description?.trim() || t('download.empty.noDescription', { defaultValue: 'No description provided yet.' });
  const isSelectedForTransition = project.id && selectedProjectId ? project.id === selectedProjectId : false;

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
      {({ ref, focused, tabIndex }) => {
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
            role="listitem"
            tabIndex={tabIndex}
            aria-label={t('download.actions.openProject', {
              defaultValue: `Open ${project.title}`,
              project: project.title
            })}
            className={`
              group relative flex min-h-[8.5rem] w-full overflow-hidden border-[0.125rem] border-[#1E1E1F]
              text-left transition-none cursor-pointer
              ${focused
                ? 'z-20 bg-[var(--ore-library-resourceCard-bgFocused)] brightness-[1.01] outline outline-[4px] outline-[#F5C542] outline-offset-0'
                : 'bg-[var(--ore-library-resourceCard-bg)] hover:bg-[var(--ore-library-resourceCard-bgHover)] outline-none'}
              ${isSelected ? 'border-[var(--ore-library-resourceCard-borderSelected)]' : ''}
            `}
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={
              shouldReduceMotion
                ? undefined
                : shouldAnimateLayout
                ? { opacity: [0.3, 1] }
                : { opacity: 1, y: 0 }
            }
            transition={shouldReduceMotion ? { duration: 0 } : {
              layout: { type: 'spring', stiffness: 220, damping: 28 },
              default: { duration: 0.3, ease: 'easeOut', delay: index < 8 ? index * 0.05 : 0 },
              opacity: shouldAnimateLayout 
                ? { duration: 0.45, ease: 'easeOut', delay: Math.min(index, 8) * 0.045 }
                : { duration: 0.3, ease: 'easeOut', delay: index < 8 ? index * 0.05 : 0 }
            }}
            style={{
              contain: 'layout paint',
              boxShadow: isInstalled
                ? 'inset 0 -0.25rem var(--ore-library-resourceCard-shadowInstalled), 0 0 0.5rem rgba(0,0,0,0.12)'
                : 'inset 0 -0.25rem var(--ore-library-resourceCard-shadowUninstalled), 0 0 0.5rem rgba(0,0,0,0.10)'
            }}
          >

            <div className="flex w-full items-stretch gap-[0.875rem] p-[0.875rem] pr-[1rem]">
              <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-between">
                <motion.div
                  layoutId={isSelectedForTransition ? `project-icon-container-${project.id}` : undefined}
                  className="relative flex h-[4.75rem] w-[4.75rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[#1E1E1F] bg-[var(--ore-library-resourceCard-iconBg)] shadow-[inset_0_-0.25rem_0_var(--ore-library-resourceCard-iconDepth),inset_0.125rem_0.125rem_0_var(--ore-library-resourceCard-iconHighlight)]"
                >
                  {project.icon_url ? (
                    <motion.img
                      layoutId={isSelectedForTransition ? `project-icon-image-${project.id}` : undefined}
                      src={cachedIconUrl || project.icon_url}
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
                  {loaders.length > 0 ? (
                    loaders.slice(0, 3).map((loader) => {
                      const loaderIcon = LOADER_ICON_MAP[loader.raw.toLowerCase()];
                      if (!loaderIcon) return null;

                      return (
                        <div
                          key={loader.raw}
                          className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-loaderChipBg)] shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-loaderChipDepth)]"
                          title={loader.display}
                        >
                          <img
                            src={loaderIcon}
                            alt=""
                            className="h-[0.75rem] w-[0.75rem] shrink-0 object-contain opacity-90"
                          />
                        </div>
                      );
                    })
                  ) : project.project_type === 'resourcepack' ? (
                    <div
                      className="flex h-[1.375rem] max-w-full items-center gap-1 overflow-hidden border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-loaderChipBg)] px-1.5 text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-loaderChipDepth)]"
                      title="资源包"
                    >
                      <Package className="h-3 w-3 shrink-0 text-black/75" strokeWidth={2.5} />
                      <span className="font-minecraft text-[9px] uppercase tracking-[0.08em] leading-none whitespace-nowrap">
                        资源包
                      </span>
                    </div>
                  ) : project.project_type === 'shader' ? (
                    <div
                      className="flex h-[1.375rem] max-w-full items-center gap-1 overflow-hidden border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-loaderChipBg)] px-1.5 text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-loaderChipDepth)]"
                      title="光影包"
                    >
                      <Globe2 className="h-3 w-3 shrink-0 text-black/75" strokeWidth={2.5} />
                      <span className="font-minecraft text-[9px] uppercase tracking-[0.08em] leading-none whitespace-nowrap">
                        光影包
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="flex min-w-0 items-center gap-[0.75rem]">
                  <div className="flex min-w-0 flex-1 items-center gap-[0.625rem]">
                    <div className="min-w-0 truncate font-minecraft text-[1.25rem] font-bold leading-[1.15] text-[var(--ore-library-resourceCard-textTitle)]">
                      {project.title}
                    </div>
                    {onClickAuthor ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onClickAuthor(authorLabel);
                        }}
                        className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[var(--ore-library-resourceCard-textAuthor)] hover:text-[var(--ore-library-resourceCard-textAuthorHover)] hover:underline cursor-pointer transition-colors"
                        title={t('download.actions.searchAuthor', { defaultValue: 'Search mods by {{author}}', author: authorLabel })}
                      >
                        {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author: authorLabel })}
                      </button>
                    ) : (
                      <div className="min-w-0 truncate text-[0.875rem] font-bold leading-none text-[var(--ore-library-resourceCard-textAuthor)]">
                        {t('download.meta.byAuthor', { defaultValue: 'by {{author}}', author: authorLabel })}
                      </div>
                    )}
                  </div>
 
                  {(isInstalled || supportsClient || supportsServer) && (
                    <div className="ml-auto flex shrink-0 items-center justify-end gap-[0.375rem]">
                      {isInstalled && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-border-color)] bg-[var(--ore-color-background-success-default)] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-[var(--ore-color-text-onLight-default)] shadow-[inset_0_-0.125rem_0_var(--ore-color-background-success-hover)]">
                          <CheckCircle2 className="h-[11px] w-[11px]" />
                          {t('download.status.installed', { defaultValue: 'Installed' })}
                        </div>
                      )}
                      {supportsClient && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-library-resourceCard-envBorder)] bg-[var(--ore-library-resourceCard-envBg)] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_var(--ore-library-resourceCard-envHighlight)]">
                          <Monitor className="h-[11px] w-[11px]" />
                          {t('download.env.client', { defaultValue: 'Client' })}
                        </div>
                      )}
                      {supportsServer && (
                        <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-library-resourceCard-envBorder)] bg-[var(--ore-library-resourceCard-envBg)] px-[6px] text-[10px] leading-none font-minecraft uppercase tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_var(--ore-library-resourceCard-envHighlight)]">
                          <Server className="h-[11px] w-[11px]" />
                          {t('download.env.server', { defaultValue: 'Server' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
 
                <p className="my-auto truncate text-[0.9375rem] leading-[1.35] text-[var(--ore-library-resourceCard-textSummary)]">
                  {summary}
                </p>

                <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
                  <div className="flex h-full min-w-0 flex-wrap items-center gap-[0.4375rem] overflow-hidden">
                    {features.map((feature) => {
                      const configuredFeature = findDownloadTagOption(categoryOptions || [], feature.raw, feature.display);
                      return (
                        <span
                          key={`${feature.raw}-${feature.display}`}
                          className="inline-flex h-[1.375rem] items-center gap-[5px] whitespace-nowrap border-[0.125rem] border-[#262729] bg-[var(--ore-library-resourceCard-infoChipBg)] px-[6px] text-[11px] font-minecraft uppercase tracking-[0.14em] text-[var(--ore-color-text-onLight-default)] shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-infoChipDepth)]"
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
 
                  <div className="flex h-full shrink-0 items-center justify-end gap-x-[0.875rem] gap-y-[0.25rem] text-[0.8125rem] font-minecraft uppercase tracking-[0.08em] text-[var(--ore-library-resourceCard-textMeta)]">
                    <span className="flex h-full items-center gap-[0.375rem]">
                      <Download className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                      <span className="leading-none">{formatNumber(project.downloads)}</span>
                    </span>
                    <span className="flex h-full items-center gap-[0.375rem]">
                      <Heart className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                      <span className="leading-none">{formatNumber(followerCount)}</span>
                    </span>
                    <span className="flex h-full items-center gap-[0.375rem] text-[var(--ore-library-resourceCard-textTimestamp)]">
                      <Clock3 className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                      <span className="font-bold leading-none">{timeAgo(project.date_modified)}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            {isSelected && (
              <>
                <span className="pointer-events-none absolute inset-0 z-20 bg-[var(--ore-library-resourceCard-overlaySelected)]" />
                <span className="pointer-events-none absolute right-3 top-3 z-40 inline-flex h-8 items-center gap-1.5 border-2 border-[var(--ore-library-resourceCard-borderSelected)] bg-[var(--ore-color-background-success-default)] px-2 font-minecraft text-[0.6875rem] uppercase tracking-[0.12em] text-[var(--ore-color-text-onLight-soft)] shadow-[inset_0_-0.1875rem_0_var(--ore-color-background-success-hover),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.24)]">
                  <Check size={13} strokeWidth={3} />
                  {t('download.status.selected', { defaultValue: '已选' })}
                </span>
              </>
            )}
          </motion.div>
        );
      }}
    </FocusItem>
  );
});

ResourceCard.displayName = 'ResourceCard';
