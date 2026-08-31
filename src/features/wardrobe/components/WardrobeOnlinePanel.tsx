import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { useInputAction } from '../../../ui/focus/InputDriver';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { OreTag } from '../../../ui/primitives/OreTag';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import { determineModelType } from '../utils/wardrobe.utils';
import { fetchOnlineSkins } from '../services/onlineSkinService';
import type { OnlineSkinItem, WardrobeSkinModel } from '../types';

export interface WardrobeOnlinePanelProps {
  onSelectSkin: (item: OnlineSkinItem) => void;
  onPreviewSkin: (item: OnlineSkinItem, model: WardrobeSkinModel) => void;
}

interface OnlineCardItemProps {
  item: OnlineSkinItem;
  onSelect: (item: OnlineSkinItem) => void;
  onPreview: (item: OnlineSkinItem, model: WardrobeSkinModel) => void;
}

const OnlineCardItem = React.memo(({ item, onSelect, onPreview }: OnlineCardItemProps) => {
  const isComponentFocusedRef = React.useRef(false);

  const triggerPreview = useCallback(async () => {
    const realModel = await determineModelType(item.skinUrl);
    onPreview(item, realModel);
  }, [item, onPreview]);

  useInputAction('ACTION_Y', () => {
    if (isComponentFocusedRef.current) {
      void triggerPreview();
    }
  });

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    void triggerPreview();
  };

  return (
    <FocusItem
      focusKey={`wardrobe-online-${item.id}`}
      onEnter={() => onSelect(item)}
    >
      {({ ref, focused }) => {
        isComponentFocusedRef.current = focused;
        return (
          <button
            ref={ref as any}
            type="button"
            className={`group relative flex h-full w-full flex-col justify-between border-[2px] border-[#1E1E1F] bg-[#48494A] p-2 text-left transition-none select-none hover:bg-[#525354] active:translate-y-[2px] focus:outline-none ${
              focused ? 'ring-2 ring-white scale-[1.02] z-10' : ''
            } shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] cursor-pointer`}
            onClick={() => onSelect(item)}
            onContextMenu={handleContextMenu}
          >
            {/* 上方 4:5 比例下沉矿槽 */}
            <div className="relative flex w-full aspect-[4/5] min-h-[156px] items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] mb-2">
              <div className="absolute top-1.5 left-1.5 z-10 flex gap-1">
                {item.source === 'player' && (
                  <OreTag variant="primary" size="sm" weight="bold">
                    正版
                  </OreTag>
                )}
                {typeof item.likes === 'number' && (
                  <span className="bg-[#141517]/85 text-[#6CC349] text-[9px] px-1 py-0.5 border border-[#1E1E1F] font-bold">
                    ♥ {item.likes}
                  </span>
                )}
              </div>

              <WardrobeSkinCardPreview skinUrl={item.skinUrl} model={item.model} />
            </div>

            {/* 底部信息栏 */}
            <div className="flex w-full flex-col min-w-0 px-0.5">
              <span className="truncate text-xs font-bold text-white font-minecraft">
                {item.title}
              </span>
              <span
                className="truncate text-[10px] text-[#8C8D90] font-['JetBrains_Mono',monospace]"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                {item.author || (item.model === 'slim' ? '纤细 (3px)' : '经典 (4px)')}
              </span>
            </div>
          </button>
        );
      }}
    </FocusItem>
  );
});

export const WardrobeOnlinePanel: React.FC<WardrobeOnlinePanelProps> = ({
  onSelectSkin,
  onPreviewSkin,
}) => {
  const [searchInput, setSearchInput] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [items, setItems] = useState<OnlineSkinItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const searchInputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const streamTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStreamTimer = useCallback(() => {
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }
  }, []);

  const streamItemsProgressively = useCallback((newItems: OnlineSkinItem[], isAppend: boolean) => {
    clearStreamTimer();
    if (!isAppend) {
      setItems([]);
    }

    if (newItems.length === 0) {
      setIsStreaming(false);
      return;
    }

    setIsStreaming(true);
    let index = 0;
    const chunkSize = 2; // 每次注入 2 条数据，实现丝滑渐进式流水加载

    const step = () => {
      if (index >= newItems.length) {
        setIsStreaming(false);
        return;
      }

      const nextChunk = newItems.slice(index, index + chunkSize);
      setItems((prev) => (isAppend || index > 0 ? [...prev, ...nextChunk] : nextChunk));
      index += chunkSize;
      streamTimerRef.current = setTimeout(step, 45);
    };

    step();
  }, [clearStreamTimer]);

  const loadSkins = useCallback(async (p: number, search: string, append: boolean = false) => {
    setIsLoading(true);
    try {
      const res = await fetchOnlineSkins(p, search);
      setPage(res.page);
      setHasMore(res.hasMore);
      streamItemsProgressively(res.items, append);
    } catch (e) {
      console.warn('Failed to load online skins', e);
      setIsStreaming(false);
    } finally {
      setIsLoading(false);
    }
  }, [streamItemsProgressively]);

  useEffect(() => {
    void loadSkins(1, appliedSearch, false);
    return () => {
      clearStreamTimer();
    };
  }, [appliedSearch, clearStreamTimer, loadSkins]);

  const handleSearchSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedSearch(searchInput.trim());
  };

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchInputTimerRef.current) clearTimeout(searchInputTimerRef.current);
    searchInputTimerRef.current = setTimeout(() => {
      setAppliedSearch(val.trim());
    }, 600);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setAppliedSearch('');
  };

  const handleLoadMore = () => {
    if (isLoading || isStreaming || !hasMore) return;
    void loadSkins(page + 1, appliedSearch, true);
  };

  return (
    <div className="flex h-full w-full flex-col font-minecraft select-none overflow-hidden">
      {/* 1. 顶部全宽检索栏（独立固定置顶，高度与搜索按钮严格 40px 对齐，不受下方滚动条影响） */}
      <div className="flex flex-col gap-2 shrink-0 pb-3 border-b-2 border-[#1E1E1F]">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full">
          <div className="flex-1 relative">
            <OreInput
              focusKey="wardrobe-online-search"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="搜索皮肤名称、标签或 NameMC 正版玩家 ID..."
              height="40px"
              prefixNode={<Search size={15} className="text-[#8C8D90]" />}
              suffixNode={
                searchInput ? (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="p-1 text-[#8C8D90] hover:text-white transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                ) : null
              }
              className="w-full text-xs"
            />
          </div>
          <OreButton
            focusKey="wardrobe-online-search-btn"
            variant="secondary"
            size="md"
            onClick={() => handleSearchSubmit()}
            className="px-4 shrink-0 h-[40px] flex items-center justify-center font-bold"
          >
            <span>搜索</span>
          </OreButton>
        </form>

        {/* 搜索结果提示条 */}
        {appliedSearch && (
          <div className="flex items-center justify-between border border-[#1E1E1F] bg-[#141517] px-3 py-1.5 text-xs text-[#D0D1D4]">
            <div className="flex items-center gap-1.5">
              <Search size={13} className="text-[#6CC349]" />
              <span>搜索结果: “{appliedSearch}”</span>
              {isStreaming && (
                <span className="flex items-center gap-1 text-[10px] text-[#8C8D90] ml-1.5">
                  <Loader2 size={10} className="animate-spin text-[#6CC349]" />
                  <span>正在逐条加载...</span>
                </span>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-[#8C8D90] hover:text-white underline cursor-pointer"
              onClick={handleClearSearch}
            >
              清除搜索
            </button>
          </div>
        )}
      </div>

      {/* 2. 下方卡片独立滚动视口（直接紧贴分割线，无多余嵌套，滚动时自然滑入分割线下方） */}
      <OreOverlayScrollArea
        className="flex-1 min-h-0 w-full"
        contentClassName="pt-3 pb-3 pr-1"
        safeInsetTop={0}
        safeInsetBottom={0}
        contentSafePaddingRight={10}
      >
          {isLoading && items.length === 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3.5 justify-center content-start">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex w-full flex-col justify-between border-[2px] border-[#1E1E1F] bg-[#222324] p-2 shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)] animate-pulse"
                >
                  <div className="w-full aspect-[4/5] min-h-[156px] bg-[#141517] mb-2" />
                  <div className="h-4 w-3/4 bg-[#313233] mb-1" />
                  <div className="h-3 w-1/2 bg-[#313233]" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && !isStreaming && items.length === 0 && (
            <div className="flex flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#222324] p-10 text-center text-xs text-[#8C8D90] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
              <Sparkles className="mb-2 h-8 w-8 text-[#FFE866]" />
              <span>未搜索到匹配的在线皮肤，可尝试换一个关键词或输入正版玩家 ID。</span>
            </div>
          )}

          {items.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,160px))] gap-3.5 justify-center content-start items-stretch">
              {items.map((item) => (
                <OnlineCardItem
                  key={item.id}
                  item={item}
                  onSelect={onSelectSkin}
                  onPreview={onPreviewSkin}
                />
              ))}
            </div>
          )}

          {/* 加载更多按钮 */}
          {hasMore && (
            <div className="flex justify-center pt-4 pb-2">
              <OreButton
                focusKey="wardrobe-online-loadmore"
                variant="secondary"
                size="sm"
                onClick={handleLoadMore}
                disabled={isLoading || isStreaming}
                className="px-6"
              >
                {isLoading || isStreaming ? '正在加载...' : '加载更多在线皮肤'}
              </OreButton>
            </div>
          )}
        </OreOverlayScrollArea>
    </div>
  );
};

export default WardrobeOnlinePanel;