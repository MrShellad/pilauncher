import React, { useMemo } from 'react';
import { ArrowUpRight, Package, Settings } from 'lucide-react';
import type { SnapshotPayload, StarredItem, StatePayload } from '../../../types/library';
import { OreButton } from '../../../ui/primitives/OreButton';

interface LibraryItemCardProps {
  item: StarredItem;
}

const parseJSON = <T,>(value: string, fallback: T): T => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const LibraryItemCard: React.FC<LibraryItemCardProps> = ({ item }) => {
  const snapshot = useMemo<SnapshotPayload>(
    () => parseJSON(item.snapshot, { title: 'Unknown Item' }),
    [item.snapshot],
  );

  const state = useMemo<StatePayload>(
    () => parseJSON(item.state, { hasUpdate: false }),
    [item.state],
  );

  const displayTitle = snapshot.title || item.title || 'Unknown Item';
  const displayAuthor = snapshot.author || item.author;
  const updatedDate = new Date(item.updatedAt * 1000);
  const updatedLabel = Number.isNaN(updatedDate.getTime())
    ? 'Unknown date'
    : updatedDate.toLocaleDateString();

  return (
    <article
      className="group relative flex min-h-[230px] flex-col justify-between overflow-hidden border-2 border-[color:var(--ore-library-card-border)] bg-[var(--ore-library-card-bg)] p-[var(--ore-spacing-base)] transition-[background-color,border-color,box-shadow] duration-150 hover:border-[color:var(--ore-library-card-borderHover)] hover:bg-[var(--ore-library-card-bgHover)] hover:shadow-[var(--ore-library-card-shadowHover)]"
      style={{ fontFamily: 'var(--ore-typography-family-body)' }}
    >
      <div className="flex items-start gap-[var(--ore-spacing-base)]">
        <div
          className="shrink-0 overflow-hidden border-2 border-[color:var(--ore-color-border-primary-default)] bg-[var(--ore-library-card-mediaBg)]"
          style={{
            width: 'var(--ore-library-card-mediaSize)',
            height: 'var(--ore-library-card-mediaSize)',
          }}
        >
          {snapshot.iconUrl ? (
            <img src={snapshot.iconUrl} alt={displayTitle} className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[var(--ore-library-card-iconFallback)]">
              <Package size={24} />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-[var(--ore-spacing-xs)]">
            <h3 className="truncate text-[length:var(--ore-typography-size-base)] font-bold text-[var(--ore-color-text-primary-default)] group-hover:text-[var(--ore-color-background-primary-default)]">
              {displayTitle}
            </h3>
            {state.hasUpdate && (
              <span
                className="inline-flex h-[10px] w-[10px] shrink-0 rounded-full bg-[var(--ore-library-card-updateDot)]"
                title="Update available"
              />
            )}
          </div>

          <p className="truncate text-[length:var(--ore-typography-size-sm)] text-[var(--ore-library-card-authorText)]">
            {displayAuthor ? `By ${displayAuthor}` : item.source}
          </p>

          <div className="mt-[var(--ore-spacing-sm)] flex flex-wrap gap-[var(--ore-spacing-xs)]">
            <span className="inline-flex items-center rounded-sm border-2 border-[color:var(--ore-color-border-primary-default)] bg-[var(--ore-library-card-tagBg)] px-[var(--ore-spacing-xs)] py-[1px] text-[length:var(--ore-typography-size-xs)] uppercase text-[var(--ore-library-card-tagText)]">
              {item.type}
            </span>
            {snapshot.loaders?.slice(0, 2).map((loader) => (
              <span
                key={loader}
                className="inline-flex items-center rounded-sm border-2 border-[color:var(--ore-color-border-primary-default)] bg-[var(--ore-library-card-loaderTagBg)] px-[var(--ore-spacing-xs)] py-[1px] text-[length:var(--ore-typography-size-xs)] uppercase text-[var(--ore-library-card-loaderTagText)]"
              >
                {loader}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-end gap-[var(--ore-spacing-sm)] px-[var(--ore-spacing-base)] pb-[var(--ore-spacing-base)] pt-[calc(var(--ore-spacing-xl)+var(--ore-spacing-xs))] transition-transform duration-200 group-hover:translate-y-0"
        style={{ backgroundImage: 'var(--ore-library-card-actionsGradient)' }}
      >
        <OreButton variant="secondary" size="sm" className="pointer-events-auto min-w-[7.25rem]">
          <span className="inline-flex items-center gap-[var(--ore-spacing-xs)]">
            <Settings size={14} />
            设置
          </span>
        </OreButton>
        <OreButton variant="primary" size="sm" className="pointer-events-auto min-w-[7.25rem]">
          <span className="inline-flex items-center gap-[var(--ore-spacing-xs)]">
            <ArrowUpRight size={14} />
            查看
          </span>
        </OreButton>
      </div>

      <div className="mt-[var(--ore-spacing-base)] text-right text-[length:var(--ore-typography-size-xs)] text-[var(--ore-library-card-metaText)] transition-opacity duration-200 group-hover:opacity-0">
        更新于 {updatedLabel}
      </div>
    </article>
  );
};
