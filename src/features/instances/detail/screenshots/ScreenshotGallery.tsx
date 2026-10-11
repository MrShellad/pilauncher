import React, { useState } from 'react';
import { Check, FolderOpen, ImageOff, Images, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '@/ui/focus/FocusItem';
import { OreButton } from '@/ui/primitives/OreButton';
import { OreOverlayScrollArea } from '@/ui/primitives/OreOverlayScrollArea';
import type { ScreenshotItem } from '../logic/screenshotService';
import { formatScreenshotBytes, formatScreenshotDate } from './screenshotPresentation';
import type { ScreenshotView } from './useScreenshotPanel';

interface ScreenshotCardProps {
  item: ScreenshotItem;
  locale: string;
  view: ScreenshotView;
  selectionMode: boolean;
  selected: boolean;
  onActivate: () => void;
  onContextSelect: () => void;
  onArrowPress: (direction: string) => boolean | void;
}

const ScreenshotCard: React.FC<ScreenshotCardProps> = ({
  item,
  locale,
  view,
  selectionMode,
  selected,
  onActivate,
  onContextSelect,
  onArrowPress,
}) => {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <FocusItem
      focusKey={`screenshot-card-${item.id}`}
      onEnter={onActivate}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused, tabIndex }) => (
        <button
          ref={ref as React.RefObject<HTMLButtonElement>}
          type="button"
          tabIndex={tabIndex}
          role={selectionMode ? 'option' : undefined}
          aria-selected={selectionMode ? selected : undefined}
          aria-label={`${item.fileName}，${formatScreenshotDate(item.capturedAt, locale)}`}
          data-screenshot-id={item.id}
          onClick={onActivate}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextSelect();
          }}
          className={`relative min-w-0 cursor-pointer border-2 bg-[#18181B] text-left outline-none transition-none hover:bg-[#242526] ${
            focused ? 'z-10 outline outline-2 outline-white outline-offset-[-2px]' : ''
          } ${selected ? 'border-[#3C8527] shadow-[inset_3px_0_0_#3C8527]' : 'border-[#27272A]'} ${
            view === 'list'
              ? 'flex h-[80px] w-full items-center'
              : 'grid w-full grid-rows-[auto_62px]'
          }`}
        >
          <div
            className={`relative shrink-0 overflow-hidden bg-[#111214] ${
              view === 'list' ? 'h-full w-[128px]' : 'aspect-video w-full'
            }`}
          >
            {imageFailed ? (
              <div className="flex h-full w-full items-center justify-center text-[#68696B]">
                <ImageOff size={view === 'list' ? 26 : 34} />
              </div>
            ) : (
              <img
                src={item.assetUrl}
                alt=""
                loading="lazy"
                draggable={false}
                onError={() => setImageFailed(true)}
                className="h-full w-full object-cover"
              />
            )}

            {selectionMode && (
              <span
                className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center border-2 ${
                  selected
                    ? 'border-[#1D4D13] bg-[#3C8527] text-white'
                    : 'border-[#D0D1D4] bg-[#18181B]/90 text-transparent'
                }`}
                aria-hidden="true"
              >
                <Check size={16} strokeWidth={3} />
              </span>
            )}
          </div>

          <div
            className={`min-w-0 ${
              view === 'list'
                ? 'flex-1 px-3 py-2'
                : 'flex h-[62px] flex-col justify-center px-3 py-2'
            }`}
          >
            <div className="truncate font-minecraft text-xs text-[#F2F2F2]">
              {item.fileName}
            </div>
            <div
              className={`mt-1 flex min-w-0 text-[11px] text-[#B1B2B5] ${
                view === 'list' ? 'items-center gap-2' : 'justify-between gap-2'
              }`}
            >
              <span className="truncate">
                {formatScreenshotDate(item.capturedAt, locale)}
              </span>
              {view === 'list' && item.width && item.height && (
                <span className="shrink-0 text-[#8C8D90]">
                  {item.width}×{item.height}
                </span>
              )}
              <span className="shrink-0">{formatScreenshotBytes(item.sizeBytes)}</span>
            </div>
          </div>
        </button>
      )}
    </FocusItem>
  );
};

interface ScreenshotGalleryProps {
  itemsContainerRef: React.RefObject<HTMLDivElement | null>;
  items: ScreenshotItem[];
  sortedItems: ScreenshotItem[];
  selectedIds: Set<string>;
  locale: string;
  view: ScreenshotView;
  selectionMode: boolean;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenFolder: () => void;
  onActivate: (item: ScreenshotItem) => void;
  onContextSelect: (itemId: string) => void;
  onCardArrow: (itemId: string, direction: string) => boolean | void;
  onExitSelectionMode: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDeleteSelection: () => void;
  onSelectionBarArrow: (direction: string) => boolean | void;
}

export const ScreenshotGallery: React.FC<ScreenshotGalleryProps> = ({
  itemsContainerRef,
  items,
  sortedItems,
  selectedIds,
  locale,
  view,
  selectionMode,
  isLoading,
  error,
  onRetry,
  onOpenFolder,
  onActivate,
  onContextSelect,
  onCardArrow,
  onExitSelectionMode,
  onSelectAll,
  onClearSelection,
  onDeleteSelection,
  onSelectionBarArrow,
}) => {
  const { t } = useTranslation();

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-[#27272A] bg-[#141416]">
      {isLoading ? (
        <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-2 overflow-hidden p-2.5">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="aspect-[16/10] animate-pulse border border-[#27272A] bg-[#18181B]"
            />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <ImageOff size={42} className="mb-3 text-[#C33636]" />
          <h4 className="font-minecraft text-sm text-white">无法读取截图</h4>
          <p className="mt-2 max-w-lg text-xs leading-relaxed text-[#B1B2B5]">{error}</p>
          <OreButton
            focusKey="screenshot-btn-retry"
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={onRetry}
          >
            重试
          </OreButton>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
          <Images size={46} className="mb-3 text-[#68696B]" />
          <h4 className="font-minecraft text-base text-[#D0D1D4]">
            {t('instanceDetail.screenshots.emptyTitle', '还没有截图')}
          </h4>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-[#8C8D90]">
            {t(
              'instanceDetail.screenshots.emptyDescription',
              '在游戏中按 F2 拍摄，截图会显示在这里。'
            )}
          </p>
          <OreButton
            focusKey="screenshot-empty-folder"
            variant="secondary"
            size="sm"
            className="mt-4"
            onClick={onOpenFolder}
            prefixIcon={<FolderOpen size={15} />}
          >
            {t('instanceDetail.screenshots.openFolder', '打开截图目录')}
          </OreButton>
        </div>
      ) : (
        <OreOverlayScrollArea
          className="flex-1 min-h-0"
          viewportClassName="h-full"
          contentClassName={
            view === 'grid'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-2 p-2.5'
              : 'flex flex-col gap-2 p-2.5'
          }
        >
          <div
            ref={itemsContainerRef}
            className="contents"
            role="listbox"
            aria-multiselectable={selectionMode || undefined}
          >
            {sortedItems.map((item) => (
              <ScreenshotCard
                key={item.id}
                item={item}
                locale={locale}
                view={view}
                selectionMode={selectionMode}
                selected={selectedIds.has(item.id)}
                onActivate={() => onActivate(item)}
                onContextSelect={() => onContextSelect(item.id)}
                onArrowPress={(direction) => onCardArrow(item.id, direction)}
              />
            ))}
          </div>
        </OreOverlayScrollArea>
      )}

      {selectionMode && items.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t-2 border-[#1E1E1F] bg-[#313233] px-3 py-2.5 shadow-[inset_0_2px_rgba(255,255,255,0.08)]">
          <span className="mr-auto font-minecraft text-xs text-white">
            已选 {selectedIds.size} 张 · 右键截图可继续选择
          </span>
          <OreButton
            focusKey="screenshot-selection-done"
            variant="secondary"
            size="sm"
            onClick={onExitSelectionMode}
            onArrowPress={onSelectionBarArrow}
          >
            完成
          </OreButton>
          <OreButton
            focusKey="screenshot-selection-all"
            variant="secondary"
            size="sm"
            onClick={onSelectAll}
            onArrowPress={onSelectionBarArrow}
          >
            {selectedIds.size === items.length ? '取消全选' : '全选'}
          </OreButton>
          <OreButton
            focusKey="screenshot-selection-clear"
            variant="secondary"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onClearSelection}
            onArrowPress={onSelectionBarArrow}
          >
            取消选择
          </OreButton>
          <OreButton
            focusKey="screenshot-selection-delete"
            variant="danger"
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={onDeleteSelection}
            onArrowPress={onSelectionBarArrow}
            prefixIcon={<Trash2 size={15} />}
          >
            删除 {selectedIds.size} 张
          </OreButton>
        </div>
      )}
    </div>
  );
};
