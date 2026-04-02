import React, { useMemo } from 'react';
import type { StarredItem, SnapshotPayload, StatePayload } from '../../../types/library';
import { OreButton } from '../../../ui/primitives/OreButton';

interface LibraryItemCardProps {
  item: StarredItem;
}

export const LibraryItemCard: React.FC<LibraryItemCardProps> = ({ item }) => {
  // Parse JSON payloads safely
  const snapshot = useMemo<SnapshotPayload>(() => {
    try { return JSON.parse(item.snapshot); } catch { return { title: 'Unknown' }; }
  }, [item.snapshot]);

  const state = useMemo<StatePayload>(() => {
    try { return JSON.parse(item.state); } catch { return { hasUpdate: false }; }
  }, [item.state]);

  const displayTitle = snapshot.title || item.title || 'Unknown Item';
  const displayAuthor = snapshot.author || item.author;

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-white/20 hover:bg-white/10 hover:shadow-lg group">
      <div className="flex items-start space-x-4">
        {/* Icon */}
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-black/40">
          {snapshot.iconUrl ? (
            <img src={snapshot.iconUrl} alt={displayTitle} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl">📦</div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h3 className="truncate text-base font-bold text-white group-hover:text-ore-primary transition-colors">
              {displayTitle}
            </h3>
            {state.hasUpdate && (
              <span className="flex h-2.5 w-2.5 rounded-full bg-ore-danger ml-2" title="有可用的更新!" />
            )}
          </div>
          
          <p className="truncate text-sm text-white/50">
            {displayAuthor ? `By ${displayAuthor}` : item.source}
          </p>
          
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] font-medium text-white/70 uppercase">
              {item.type}
            </span>
            {snapshot.loaders?.slice(0, 2).map((loader) => (
              <span key={loader} className="rounded bg-ore-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-ore-primary uppercase">
                {loader}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Hover ActionsOverlay */}
      <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-end space-x-2 bg-gradient-to-t from-black/80 to-transparent p-3 pt-8 pb-3 transition-transform duration-200 group-hover:translate-y-0">
        <OreButton 
          variant="secondary" 
          size="sm" 
          className="shadow-sm backdrop-blur-md bg-white/10"
        >
          设 置
        </OreButton>
        <OreButton 
          variant="primary" 
          size="sm" 
          className="shadow-md"
        >
          查看
        </OreButton>
      </div>

      {/* Date Updated */}
      <div className="mt-4 text-right text-[10px] text-white/30 transition-opacity duration-200 group-hover:opacity-0">
        更新于 {new Date(item.updatedAt * 1000).toLocaleDateString()}
      </div>
    </div>
  );
};
