import React from 'react';
import {
  Archive,
  BellDot,
  Blocks,
  Box,
  CheckCircle2,
  Clock3,
  Globe2,
  Package,
  Pin,
  Server,
  Tags,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

import fabricIcon from '../../../assets/icons/tags/loaders/fabric.svg';
import forgeIcon from '../../../assets/icons/tags/loaders/forge.svg';
import liteloaderIcon from '../../../assets/icons/tags/loaders/liteloader.svg';
import neoforgeIcon from '../../../assets/icons/tags/loaders/neoforge.svg';
import quiltIcon from '../../../assets/icons/tags/loaders/quilt.svg';
import type { LibraryDensity } from '../data/libraryPageData';
import type { LibraryResourceViewModel } from '../logic/libraryItems';
import type { ModSetTrackerItemStatus } from '../stores/useModSetTrackerStore';
import { FocusItem } from '../../../ui/focus/FocusItem';

interface LibraryItemCardProps {
  item: LibraryResourceViewModel;
  density: LibraryDensity;
  focusKey: string;
  trackerStatus?: ModSetTrackerItemStatus;
  onContextMenu?: (event: React.MouseEvent<HTMLElement>, item: LibraryResourceViewModel) => void;
  onOpen?: (item: LibraryResourceViewModel) => void;
  onArrowPress?: (direction: string) => boolean | void;
  contextMenuActive?: boolean;
}

const LOADER_ICON_MAP: Record<string, string> = {
  fabric: fabricIcon,
  forge: forgeIcon,
  neoforge: neoforgeIcon,
  quilt: quiltIcon,
  liteloader: liteloaderIcon,
};

const typeIconMap: Record<string, React.ElementType> = {
  modpack: Package,
  mod: Box,
  resourcepack: Package,
  shader: Globe2,
  server: Server,
};

const sourceLabelMap: Record<string, string> = {
  curseforge: 'CurseForge',
  modrinth: 'Modrinth',
  custom: 'Custom',
};

const getSourceLabel = (source: string) => sourceLabelMap[source.toLowerCase()] ?? source;

export const LibraryItemCard: React.FC<LibraryItemCardProps> = ({
  item,
  density,
  focusKey,
  trackerStatus,
  onContextMenu,
  onOpen,
  onArrowPress,
  contextMenuActive = false,
}) => {
  const { t } = useTranslation();
  const TypeIcon = typeIconMap[item.type] ?? Package;
  const compact = density === 'compact';
  const isTrackerItemReady = trackerStatus === 'ready';
  const authorLabel = item.author || getSourceLabel(item.source);
  const typeLabel = t(`libraryPage.types.${item.type}`, { defaultValue: item.type });
  const summary = item.description?.trim() || item.note?.trim() || t('libraryPage.item.noSummary');
  const featureLabels = (item.categories.length > 0 ? item.categories : [getSourceLabel(item.source)]).slice(
    0,
    compact ? 2 : 4,
  );
  const versionLabel = item.installedVersion || item.version || item.lastKnownVersion;
  const versionPrefix = item.installedVersion ? t('libraryPage.item.installed') : t('libraryPage.item.version');
  const loaderIconItems = item.loaders
    .map((loader) => ({
      label: loader,
      icon: LOADER_ICON_MAP[loader.toLowerCase()],
    }))
    .filter((loader) => loader.icon)
    .slice(0, 3);

  return (
    <FocusItem
      focusKey={focusKey}
      onEnter={() => onOpen?.(item)}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused }) => (
        <article
          ref={ref as React.RefObject<HTMLElement>}
          data-library-resource-focus-key={focusKey}
          tabIndex={-1}
          className={[
            'group relative flex w-full overflow-hidden border-[0.125rem] border-[var(--ore-color-border-primary-default)] text-left outline-none transition-none',
            focused
              ? 'z-20 bg-[var(--ore-color-background-neutral-soft)] brightness-[1.01]'
              : 'bg-[var(--ore-color-background-neutral-muted)] hover:bg-[var(--ore-color-background-neutral-subtle)] hover:brightness-[1.01]',
            contextMenuActive ? '!border-white ring-2 ring-white/70' : '',
            compact ? 'min-h-[7.75rem]' : 'min-h-[8.5rem]',
          ].join(' ')}
          style={{
            contain: 'layout paint',
            boxShadow: item.hasUpdate
              ? 'inset 0 -0.25rem var(--ore-library-resourceCard-updateDepth), 0 0 0.5rem rgba(0,0,0,0.12)'
              : 'inset 0 -0.25rem var(--ore-color-border-neutral-subtle), 0 0 0.5rem rgba(0,0,0,0.10)',
          }}
          onClick={() => onOpen?.(item)}
          onContextMenu={(event) => onContextMenu?.(event, item)}
        >
      <div className="absolute inset-x-0 top-0 h-[0.25rem] bg-white/25" />
      {isTrackerItemReady && (
        <div className="absolute right-[0.625rem] top-[0.625rem] z-20 inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-success-default)] px-[0.5rem] font-minecraft text-[length:var(--ore-typography-size-micro)] uppercase leading-none tracking-[0.14em] text-[var(--ore-color-text-onLight-soft)] shadow-[inset_0_0.0625rem_0_rgba(255,255,255,0.35),inset_0_-0.125rem_0_var(--ore-color-background-primary-default),0_0.25rem_0.5rem_rgba(0,0,0,0.28)]">
          <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
          {t('libraryPage.item.ready')}
        </div>
      )}

      <div className={['flex w-full items-stretch gap-[0.875rem]', compact ? 'p-[0.75rem]' : 'p-[0.875rem] pr-[1rem]'].join(' ')}>
        <div className={['flex shrink-0 flex-col items-center justify-between', compact ? 'w-[4.25rem]' : 'w-[4.75rem]'].join(' ')}>
          <div
            className={[
              'relative flex shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[var(--ore-color-border-primary-default)]',
              'bg-[var(--ore-color-background-surface-default)] shadow-[inset_0_-0.25rem_0_var(--ore-color-background-surface-raised),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.15)]',
              compact ? 'h-[4.25rem] w-[4.25rem]' : 'h-[4.75rem] w-[4.75rem]',
            ].join(' ')}
          >
            {item.iconUrl ? (
              <img src={item.iconUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <TypeIcon className={compact ? 'h-[2rem] w-[2rem] text-white/75' : 'h-[2.25rem] w-[2.25rem] text-white/75'} />
            )}
          </div>

          <div className="flex h-[1.375rem] w-full items-center justify-center gap-[0.25rem] overflow-hidden">
            {loaderIconItems.length > 0 ? (
              loaderIconItems.map((loader) => (
                <div
                  key={loader.label}
                  className="flex h-[1.375rem] w-[1.375rem] shrink-0 items-center justify-center overflow-hidden border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-loaderChipBg)] shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-loaderChipDepth)]"
                  title={loader.label}
                >
                  <img src={loader.icon} alt="" className="h-[0.75rem] w-[0.75rem] shrink-0 object-contain opacity-90" />
                </div>
              ))
            ) : (
              <div
                className="flex h-[1.375rem] max-w-full items-center gap-[0.25rem] overflow-hidden border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-loaderChipBg)] px-[0.25rem] text-[length:var(--ore-typography-size-micro)] font-minecraft uppercase tracking-[0.08em] text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-loaderChipDepth)]"
                title={typeLabel}
              >
                <TypeIcon className="h-[0.6875rem] w-[0.6875rem] shrink-0" strokeWidth={2.5} />
                <span className="truncate leading-none">{typeLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between">
          <div className="flex min-w-0 items-center gap-[0.75rem]">
            <div className="flex min-w-0 flex-1 items-center gap-[0.625rem]">
              <div className="min-w-0 truncate font-minecraft text-[length:var(--ore-typography-size-xl)] font-bold leading-[var(--ore-typography-lineHeight-headingCompact)] text-black">
                {item.title}
              </div>
              <div className="min-w-0 truncate text-[length:var(--ore-typography-size-sm)] font-bold leading-none text-[var(--ore-color-text-onLight-muted)]">
                {t('libraryPage.item.byAuthor', { author: authorLabel })}
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center justify-end gap-[0.375rem]">
              {item.hasUpdate && (
                <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-library-resourceCard-warningBg)] px-[var(--ore-spacing-sm)] font-minecraft text-[length:var(--ore-typography-size-micro)] uppercase leading-none tracking-[0.16em] text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-warningDepth)]">
                  <BellDot className="h-3 w-3" />
                  {t('libraryPage.item.updated')}
                </div>
              )}
              {item.pinned && (
                <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-success-default)] px-[var(--ore-spacing-sm)] font-minecraft text-[length:var(--ore-typography-size-micro)] uppercase leading-none tracking-[0.16em] text-black shadow-[inset_0_-0.125rem_0_var(--ore-color-background-primary-default)]">
                  <Pin className="h-3 w-3" />
                  {t('libraryPage.item.pinned')}
                </div>
              )}
              {item.archived && (
                <div className="inline-flex h-[1.625rem] items-center gap-1 border-[0.125rem] border-[var(--ore-color-border-primary-default)] bg-[var(--ore-color-background-surface-raised)] px-[var(--ore-spacing-sm)] font-minecraft text-[length:var(--ore-typography-size-micro)] uppercase leading-none tracking-[0.16em] text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.12)]">
                  <Archive className="h-3 w-3" />
                  {t('libraryPage.item.archived')}
                </div>
              )}
            </div>
          </div>

          <p className="my-auto truncate text-[length:var(--ore-typography-size-bodySm)] leading-[var(--ore-typography-lineHeight-bodyCompact)] text-[var(--ore-library-resourceCard-summaryText)]">
            {summary}
          </p>

          <div className="flex h-[1.375rem] min-w-0 items-center justify-between gap-[1rem]">
            <div className="flex h-full min-w-0 flex-wrap items-center gap-[var(--ore-spacing-sm)] overflow-hidden">
              <span className="inline-flex h-[1.375rem] items-center gap-[var(--ore-spacing-xs)] whitespace-nowrap border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-infoChipBg)] px-[var(--ore-spacing-sm)] font-minecraft text-[length:var(--ore-typography-size-caption)] uppercase tracking-[0.14em] text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-infoChipDepth)]">
                <Globe2 className="h-[0.6875rem] w-[0.6875rem]" strokeWidth={2.5} />
                {getSourceLabel(item.source)}
              </span>
              {featureLabels.map((label) => (
                <span
                  key={label}
                  className="inline-flex h-[1.375rem] items-center gap-[var(--ore-spacing-xs)] whitespace-nowrap border-[0.125rem] border-[var(--ore-library-resourceCard-chipBorder)] bg-[var(--ore-library-resourceCard-infoChipBg)] px-[var(--ore-spacing-sm)] font-minecraft text-[length:var(--ore-typography-size-caption)] uppercase tracking-[0.14em] text-black shadow-[inset_0_-0.125rem_0_var(--ore-library-resourceCard-infoChipDepth)]"
                >
                  <Tags className="h-[0.6875rem] w-[0.6875rem]" strokeWidth={2.5} />
                  {label}
                </span>
              ))}
            </div>

            <div className="flex h-full shrink-0 items-center justify-end gap-x-[0.875rem] gap-y-[0.25rem] font-minecraft text-[length:var(--ore-typography-size-meta)] uppercase tracking-[0.08em] text-[var(--ore-library-resourceCard-metaText)]">
              <span className="flex h-full items-center gap-[0.375rem]">
                <Blocks className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                <span className="leading-none">{typeLabel}</span>
              </span>
              {versionLabel && (
                <span className="flex h-full items-center gap-[0.375rem]">
                  <CheckCircle2 className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                  <span className="leading-none">{versionPrefix} {versionLabel}</span>
                </span>
              )}
              <span className="flex h-full items-center gap-[0.375rem] text-[var(--ore-library-resourceCard-timestampText)]">
                <Clock3 className="h-[0.8125rem] w-[0.8125rem]" strokeWidth={2.5} />
                <span className="font-bold leading-none">{item.updatedLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
        </article>
      )}
    </FocusItem>
  );
};
