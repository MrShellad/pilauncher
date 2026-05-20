import React, { useState, useEffect } from 'react';
import { CheckCircle2, Gamepad2, Package, Pencil } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

import type { Collection } from '../../../types/library';
import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useModSetTrackerStore } from '../stores/useModSetTrackerStore';
import { resolveCollectionItems, toLibraryResource } from '../logic/libraryItems';
import { convertFileSrc } from '@tauri-apps/api/core';
import { FocusItem } from '../../../ui/focus/FocusItem';

interface CollectionCardProps {
  collection: Collection;
  onClick: () => void;
  onEdit?: (collection: Collection) => void;
  focusKey?: string;
  onArrowPress?: (direction: string) => boolean | void;
}

const TRACKER_META_ICON_COLOR = 'var(--ore-library-collectionCard-trackerAccent)';

const formatLoaderName = (loader: string) => {
  const normalized = loader.trim().toLowerCase();
  if (normalized === 'neoforge') return 'NeoForge';
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 'Loader';
};

const uniqueIcons = (icons: Array<string | undefined>) => {
  const seen = new Set<string>();
  return icons.filter((icon): icon is string => {
    if (!icon || seen.has(icon)) return false;
    seen.add(icon);
    return true;
  });
};

const isHexColor = (value: string) => /^#[0-9A-Fa-f]{6}$/.test(value.trim());

const LoaderGlyph: React.FC<{ loader: string }> = ({ loader }) => {
  const normalized = loader.trim().toLowerCase();
  const commonProps = {
    className: 'h-[1.125rem] w-[1.125rem] shrink-0',
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (normalized === 'fabric') {
    return (
      <svg {...commonProps}>
        <path
          strokeWidth={2}
          d="m820 761-85.6-87.6c-4.6-4.7-10.4-9.6-25.9 1-19.9 13.6-8.4 21.9-5.2 25.4 8.2 9 84.1 89 97.2 104 2.5 2.8-20.3-22.5-6.5-39.7 5.4-7 18-12 26-3 6.5 7.3 10.7 18-3.4 29.7-24.7 20.4-102 82.4-127 103-12.5 10.3-28.5 2.3-35.8-6-7.5-8.9-30.6-34.6-51.3-58.2-5.5-6.3-4.1-19.6 2.3-25 35-30.3 91.9-73.8 111.9-90.8"
          transform="matrix(.08671 0 0 .0867 -49.8 -56)"
        />
      </svg>
    );
  }

  if (normalized === 'forge') {
    return (
      <svg {...commonProps}>
        <path
          strokeWidth={2}
          d="M2 7.5h8v-2h12v2s-7 3.4-7 6 3.1 3.1 3.1 3.1l.9 3.9H5l1-4.1s3.8.1 4-2.9c.2-2.7-6.5-.7-8-6Z"
        />
      </svg>
    );
  }

  if (normalized === 'neoforge') {
    return (
      <svg {...commonProps}>
        <g strokeWidth={2}>
          <path d="m12 19.2v2m0-2v2" />
          <path d="m8.4 1.3c0.5 1.5 0.7 3 0.1 4.6-0.2 0.5-0.9 1.5-1.6 1.5m8.7-6.1c-0.5 1.5-0.7 3-0.1 4.6 0.2 0.6 0.9 1.5 1.6 1.5" />
          <path d="m3.6 15.8h-1.7m18.5 0h1.7" />
          <path d="m3.2 12.1h-1.7m19.3 0h1.8" />
          <path d="m8.1 12.7v1.6m7.8-1.6v1.6" />
          <path d="m10.8 18h1.2m0 1.2-1.2-1.2m2.4 0h-1.2m0 1.2 1.2-1.2" />
          <path d="m4 9.7c-0.5 1.2-0.8 2.4-0.8 3.7 0 3.1 2.9 6.3 5.3 8.2 0.9 0.7 2.2 1.1 3.4 1.1m0.1-17.8c-1.1 0-2.1 0.2-3.2 0.7m11.2 4.1c0.5 1.2 0.8 2.4 0.8 3.7 0 3.1-2.9 6.3-5.3 8.2-0.9 0.7-2.2 1.1-3.4 1.1m-0.1-17.8c1.1 0 2.1 0.2 3.2 0.7" />
          <path d="m4 9.7c-0.2-1.8-0.3-3.7 0.5-5.5s2.2-2.6 3.9-3m11.6 8.5c0.2-1.9 0.3-3.7-0.5-5.5s-2.2-2.6-3.9-3" />
          <path d="m12 21.2-2.4 0.4m2.4-0.4 2.4 0.4" />
        </g>
      </svg>
    );
  }

  if (normalized === 'quilt') {
    return (
      <svg {...commonProps}>
        <path
          strokeWidth={2}
          d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197 .1Z"
          transform="matrix(.03053 0 0 .03046 -3.2 -3.2)"
        />
        <path
          strokeWidth={2}
          d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197 .1Z"
          transform="matrix(.03053 0 0 .03046 -3.2 7)"
        />
        <path
          strokeWidth={2}
          d="M442.5 233.9c0-6.4-5.2-11.6-11.6-11.6h-197c-6.4 0-11.6 5.2-11.6 11.6v197c0 6.4 5.2 11.6 11.6 11.6h197c6.4 0 11.6-5.2 11.6-11.7v-197 .1Z"
          transform="matrix(.03053 0 0 .03046 6.9 -3.2)"
        />
        <path
          strokeWidth={2}
          d="M442.5 234.8c0-7-5.6-12.5-12.5-12.5H234.7c-6.8 0-12.4 5.6-12.4 12.5V430c0 6.9 5.6 12.5 12.4 12.5H430c6.9 0 12.5-5.6 12.5-12.5V234.8Z"
          transform="rotate(45 3.5 24) scale(.02843 .02835)"
        />
      </svg>
    );
  }

  if (normalized === 'liteloader') {
    return (
      <svg {...commonProps}>
        <path strokeWidth={2} d="m3.924 21.537s3.561-1.111 8.076-6.365c2.544-2.959 2.311-1.986 4-4.172" />
        <path
          strokeWidth={2}
          d="m7.778 19s1.208-0.48 4.222 0c2.283 0.364 6.037-4.602 6.825-6.702 1.939-5.165 0.894-10.431 0.894-10.431s-4.277 4.936-6.855 7.133c-5.105 4.352-6.509 11-6.509 11"
        />
      </svg>
    );
  }

  return null;
};

export const CollectionCard: React.FC<CollectionCardProps> = ({
  collection,
  onClick,
  onEdit,
  focusKey,
  onArrowPress,
}) => {
  const { t } = useTranslation();
  const { items, collectionItems } = useLibraryStore();
  const trackers = useModSetTrackerStore((state) => state.trackers);
  const tracker = React.useMemo(
    () => trackers
      .filter((item) => item.collectionId === collection.id)
      .sort((a, b) => b.updatedAt - a.updatedAt)[0],
    [collection.id, trackers],
  );

  const icons = React.useMemo(() => {
    const scopedItems = resolveCollectionItems(collection.id, items, collectionItems);
    const resources = scopedItems.map(toLibraryResource);
    const itemIcons = uniqueIcons(resources.map((resource) => resource.iconUrl));
    const trackerIcons = uniqueIcons(tracker?.projects.map((project) => project.iconUrl) ?? []);
    const coverIcons = collection.type === 'mod_set' && trackerIcons.length > 0 ? trackerIcons : itemIcons;
    return coverIcons.slice(0, 10);
  }, [collection.id, collection.type, collectionItems, items, tracker]);

  const iconSignature = icons.join('\u0000');
  const [iconCycleState, setIconCycleState] = useState(() => ({
    signature: iconSignature,
    index: 0,
  }));
  const currentIconIndex = iconCycleState.signature === iconSignature
    ? iconCycleState.index
    : 0;

  useEffect(() => {
    if (icons.length <= 1) return;
    const interval = setInterval(() => {
      setIconCycleState((current) => {
        const baseIndex = current.signature === iconSignature ? current.index : 0;
        return {
          signature: iconSignature,
          index: (baseIndex + 1) % icons.length,
        };
      });
    }, 2500);
    return () => clearInterval(interval);
  }, [iconSignature, icons.length]);

  const isTrackerReady = tracker?.readinessStatus === 'ready';
  const percent = tracker && tracker.totalCount > 0
    ? Math.round((tracker.readyCount / tracker.totalCount) * 100)
    : 0;
  const trackerLoader = tracker?.loader?.trim().toLowerCase() ?? '';
  const customCoverImage = React.useMemo(() => {
    const cover = collection.coverImage?.trim();
    if (!cover || isHexColor(cover)) return '';
    if (cover.startsWith('http://') || cover.startsWith('https://') || cover.startsWith('data:')) {
      return cover;
    }
    try {
      return convertFileSrc(cover);
    } catch {
      return cover;
    }
  }, [collection.coverImage]);

  return (
    <FocusItem focusKey={focusKey} onEnter={onClick} onArrowPress={onArrowPress}>
      {({ ref, focused }) => (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          data-library-collection-focus-key={focusKey}
          className={[
            'group relative flex cursor-pointer flex-col overflow-hidden rounded-[4px] border-2 bg-[var(--ore-color-background-surface-layer)]',
            'shadow-[inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3)] transition-colors',
            'hover:border-white hover:shadow-[0_8px_16px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.1),inset_0_-2px_0_rgba(0,0,0,0.3)]',
            focused ? 'z-20 border-white ring-2 ring-white/80' : 'border-[var(--ore-color-border-primary-default)]',
          ].join(' ')}
          onClick={onClick}
          role="button"
          tabIndex={-1}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick();
            }
          }}
        >
          {onEdit && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onEdit(collection);
              }}
              className="absolute left-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-[2px] border-2 border-[var(--ore-color-border-primary-strong)] bg-[var(--ore-color-background-surface-panel)] text-[var(--ore-color-text-secondary-soft)] opacity-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35),0_4px_8px_rgba(0,0,0,0.35)] transition-opacity hover:border-white hover:text-white group-hover:opacity-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-white"
              title={t('libraryPage.metadata.title', {
                type: collection.type === 'modpack' ? t('libraryPage.views.modpack') : t('libraryPage.views.modSet'),
              })}
            >
              <Pencil className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
            </button>
          )}

          {tracker && (
            <div
              className={[
                'absolute right-2 top-2 z-10 flex h-7 items-center justify-center gap-1 rounded-[2px]',
                'border-2 border-[var(--ore-color-border-primary-strong)] px-2 font-minecraft text-[length:var(--ore-typography-size-micro)] leading-none shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-2px_0_rgba(0,0,0,0.22),0_4px_8px_rgba(0,0,0,0.35)]',
                isTrackerReady
                  ? 'bg-[var(--ore-color-background-success-default)] text-[var(--ore-color-text-onLight-soft)]'
                  : 'bg-[var(--ore-library-resourceCard-warningBg)] text-[var(--ore-color-text-onLight-soft)]',
              ].join(' ')}
            >
              {isTrackerReady && <CheckCircle2 className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.75} />}
              {isTrackerReady ? t('libraryPage.item.ready') : `${percent}%`}
            </div>
          )}

          <div className="relative flex aspect-square w-full items-center justify-center overflow-hidden bg-[var(--ore-color-background-surface-deep)]">
            {customCoverImage ? (
              <img
                src={customCoverImage}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : icons.length > 0 ? (
              <div className="absolute inset-0">
                {icons.map((icon, index) => (
                  <motion.img
                    key={icon}
                    src={icon}
                    alt=""
                    loading="eager"
                    decoding="async"
                    animate={{
                      opacity: index === currentIconIndex ? 1 : 0,
                    }}
                    transition={{
                      opacity: { duration: 0.55, ease: 'easeInOut' },
                    }}
                    className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]"
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-16 w-16 items-center justify-center border-2 border-[var(--ore-color-background-surface-raised)] bg-[var(--ore-library-collectionCard-fallbackBg)] text-[var(--ore-color-text-secondary-soft)] shadow-[inset_0_-2px_0_rgba(0,0,0,0.35),inset_1px_1px_0_rgba(255,255,255,0.08)]">
                <Package className="h-10 w-10" strokeWidth={2.25} />
              </div>
            )}
          </div>

          <div className="grid min-h-[72px] shrink-0 content-center gap-1 border-t-2 border-[var(--ore-color-border-primary-default)] bg-[var(--ore-library-collectionCard-footerBg)] px-3 py-2 text-center transition-colors group-hover:bg-[var(--ore-color-background-surface-hover)]">
            <div className="font-minecraft text-sm leading-tight text-white">
              <span className="line-clamp-2">{collection.name}</span>
            </div>
            {tracker && (
              <div className="mx-auto flex h-6 max-w-full min-w-0 items-center justify-center gap-1.5 rounded-[2px] border-2 border-[var(--ore-library-collectionCard-trackerBorder)] bg-[var(--ore-library-collectionCard-trackerBg)] px-2 text-[length:var(--ore-typography-size-caption)] leading-none text-[var(--ore-color-text-secondary-strong)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-2px_0_rgba(0,0,0,0.28)]">
                <Gamepad2
                  strokeWidth={2.25}
                  className="h-[1.125rem] w-[1.125rem] shrink-0"
                  style={{ color: TRACKER_META_ICON_COLOR }}
                />
                <span className="truncate font-minecraft text-[var(--ore-color-text-secondary-strong)]">{tracker.gameVersion}</span>
                <span className="text-[var(--ore-library-collectionCard-trackerDivider)]">/</span>
                <span className="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center" style={{ color: TRACKER_META_ICON_COLOR }}>
                  <LoaderGlyph loader={trackerLoader} />
                </span>
                <span className="truncate font-minecraft text-[var(--ore-color-text-secondary-strong)]">{formatLoaderName(tracker.loader)}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </FocusItem>
  );
};
