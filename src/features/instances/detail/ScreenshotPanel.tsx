import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownWideNarrow,
  Check,
  FolderOpen,
  ImageOff,
  Images,
  LayoutGrid,
  List,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../ui/focus/FocusItem';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreOverlayScrollArea } from '../../../ui/primitives/OreOverlayScrollArea';
import { OreSegmentedControl } from '../../../ui/primitives/OreSegmentedControl';
import type { ScreenshotItem } from './logic/screenshotService';
import { ScreenshotPreviewModal } from './screenshots/ScreenshotPreviewModal';
import {
  useScreenshotPanel,
  type ScreenshotSort,
  type ScreenshotView,
} from './screenshots/useScreenshotPanel';

interface ScreenshotPanelProps {
  instanceId: string;
  isActive: boolean;
  onCoverChanged: (absolutePath: string) => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const formatDate = (timestamp: number, locale: string) =>
  timestamp > 0
    ? new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(timestamp)
    : '未知时间';

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
          aria-label={`${item.fileName}，${formatDate(item.capturedAt, locale)}`}
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
            view === 'list' ? 'flex h-[80px] w-full items-center' : 'grid w-full grid-rows-[auto_62px]'
          }`}
        >
          <div className={`relative shrink-0 overflow-hidden bg-[#111214] ${view === 'list' ? 'h-full w-[128px]' : 'aspect-video w-full'}`}>
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

          <div className={`min-w-0 ${view === 'list' ? 'flex-1 px-3 py-2' : 'flex h-[62px] flex-col justify-center px-3 py-2'}`}>
            <div className="truncate font-minecraft text-xs text-[#F2F2F2]">{item.fileName}</div>
            <div className={`mt-1 flex min-w-0 text-[11px] text-[#B1B2B5] ${view === 'list' ? 'items-center gap-2' : 'justify-between gap-2'}`}>
              <span className="truncate">{formatDate(item.capturedAt, locale)}</span>
              {view === 'list' && item.width && item.height && (
                <span className="shrink-0 text-[#8C8D90]">{item.width}×{item.height}</span>
              )}
              <span className="shrink-0">{formatBytes(item.sizeBytes)}</span>
            </div>
          </div>
        </button>
      )}
    </FocusItem>
  );
};

export const ScreenshotPanel: React.FC<ScreenshotPanelProps> = ({
  instanceId,
  isActive,
  onCoverChanged,
}) => {
  const { t, i18n } = useTranslation();
  const panel = useScreenshotPanel({ instanceId, isActive, onCoverChanged });
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const sortOptions = useMemo(() => [
    { value: 'newest', label: t('instanceDetail.screenshots.sortNewest', '最新优先') },
    { value: 'oldest', label: t('instanceDetail.screenshots.sortOldest', '最旧优先') },
    { value: 'name', label: t('instanceDetail.screenshots.sortName', '名称 A–Z') },
    { value: 'size', label: t('instanceDetail.screenshots.sortSize', '文件最大优先') },
  ], [t]);

  const viewTabs = useMemo(() => [
    { id: 'grid', label: t('instanceDetail.screenshots.gridView', '网格'), icon: <LayoutGrid size={14} /> },
    { id: 'list', label: t('instanceDetail.screenshots.listView', '列表'), icon: <List size={14} /> },
  ], [t]);

  const latestTimestamp = panel.items.reduce(
    (latest, item) => Math.max(latest, item.capturedAt),
    0,
  );
  const pendingDeleteSize = panel.items
    .filter((item) => panel.pendingDeleteIds.includes(item.id))
    .reduce((total, item) => total + item.sizeBytes, 0);

  const activateItem = useCallback((item: ScreenshotItem) => {
    if (panel.selectionMode) panel.toggleSelection(item.id);
    else panel.setPreviewId(item.id);
  }, [panel]);

  const focusFirstContentItem = useCallback(() => {
    const firstItem = panel.sortedItems[0];
    const candidates = firstItem
      ? [`screenshot-card-${firstItem.id}`]
      : panel.error
        ? ['screenshot-btn-retry']
        : ['screenshot-empty-folder'];

    const target = candidates.find(doesFocusableExist);
    if (!target) return false;
    setFocus(target);
    return true;
  }, [panel.error, panel.sortedItems]);

  const handleToolbarArrow = useCallback((direction: string) => {
    if (direction !== 'down') return true;
    focusFirstContentItem();
    return false;
  }, [focusFirstContentItem]);

  const handleHeaderArrow = useCallback((targetKey: string, direction: string, fallbackKey = 'screenshot-sort') => {
    if (direction !== 'down') return true;
    if (doesFocusableExist(targetKey)) setFocus(targetKey);
    else if (doesFocusableExist(fallbackKey)) setFocus(fallbackKey);
    return false;
  }, []);

  const handleSelectionBarArrow = useCallback((direction: string) => {
    if (direction !== 'up') return true;
    const lastItem = panel.sortedItems[panel.sortedItems.length - 1];
    if (lastItem) setFocus(`screenshot-card-${lastItem.id}`);
    return false;
  }, [panel.sortedItems]);

  const handleCardArrow = useCallback((itemId: string, direction: string) => {
    if (!['left', 'right', 'up', 'down'].includes(direction)) return true;
    const currentIndex = panel.sortedItems.findIndex((item) => item.id === itemId);
    if (currentIndex < 0) return false;

    if (panel.view === 'list') {
      if (direction === 'up') {
        if (currentIndex === 0) setFocus('screenshot-sort');
        else setFocus(`screenshot-card-${panel.sortedItems[currentIndex - 1].id}`);
      } else if (direction === 'down') {
        const nextItem = panel.sortedItems[currentIndex + 1];
        if (nextItem) setFocus(`screenshot-card-${nextItem.id}`);
        else if (panel.selectionMode) setFocus('screenshot-selection-all');
      }
      return false;
    }

    const cardElements = Array.from(
      itemsContainerRef.current?.querySelectorAll<HTMLElement>('[data-screenshot-id]') ?? [],
    );
    const currentElement = cardElements.find((element) => element.dataset.screenshotId === itemId);
    if (!currentElement) return false;

    const currentRect = currentElement.getBoundingClientRect();
    const currentCenterX = currentRect.left + currentRect.width / 2;
    const currentCenterY = currentRect.top + currentRect.height / 2;
    const candidates = cardElements
      .filter((element) => element !== currentElement)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          id: element.dataset.screenshotId ?? '',
          centerX: rect.left + rect.width / 2,
          centerY: rect.top + rect.height / 2,
        };
      });

    let eligible = candidates.filter((candidate) => {
      if (direction === 'left') return candidate.centerX < currentCenterX && Math.abs(candidate.centerY - currentCenterY) < currentRect.height / 3;
      if (direction === 'right') return candidate.centerX > currentCenterX && Math.abs(candidate.centerY - currentCenterY) < currentRect.height / 3;
      if (direction === 'up') return candidate.centerY < currentCenterY;
      return candidate.centerY > currentCenterY;
    });

    if (direction === 'left' || direction === 'right') {
      eligible.sort((left, right) => Math.abs(left.centerX - currentCenterX) - Math.abs(right.centerX - currentCenterX));
    } else {
      const nearestRowDistance = eligible.reduce(
        (distance, candidate) => Math.min(distance, Math.abs(candidate.centerY - currentCenterY)),
        Number.POSITIVE_INFINITY,
      );
      eligible = eligible
        .filter((candidate) => Math.abs(Math.abs(candidate.centerY - currentCenterY) - nearestRowDistance) < 4)
        .sort((left, right) => Math.abs(left.centerX - currentCenterX) - Math.abs(right.centerX - currentCenterX));
    }

    const target = eligible[0];
    if (target?.id) {
      setFocus(`screenshot-card-${target.id}`);
    } else if (direction === 'up') {
      setFocus('screenshot-sort');
    } else if (direction === 'down' && panel.selectionMode) {
      setFocus('screenshot-selection-all');
    }
    return false;
  }, [panel.selectionMode, panel.sortedItems, panel.view]);

  useEffect(() => {
    if (!isActive || !panel.selectionMode) return;
    const handleSelectionKeyDown = (event: KeyboardEvent) => {
      if (panel.previewItem || panel.pendingDeleteIds.length > 0) return;
      const isSelectAll = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';
      const isDelete = event.key === 'Delete' && panel.selectedIds.size > 0;
      const isEscape = event.key === 'Escape';
      if (!isSelectAll && !isDelete && !isEscape) return;

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (isSelectAll) panel.selectAll();
      else if (isDelete) panel.setPendingDeleteIds([...panel.selectedIds]);
      else panel.exitSelectionMode();
    };
    window.addEventListener('keydown', handleSelectionKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleSelectionKeyDown, { capture: true });
  }, [isActive, panel]);

  return (
    <FocusBoundary
      id="screenshot-panel-boundary"
      className="flex flex-1 min-h-0 flex-col overflow-hidden p-3 gap-3 select-none"
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-2 border-[#2A2A2C] bg-[#18181B] px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#58B2DC]/50 bg-[#10232C]">
            <Images size={22} className="text-[#58B2DC]" />
          </div>
          <div className="min-w-0">
            <h3 className="font-minecraft text-base text-white">
              {t('instanceDetail.screenshots.title', '截图库')}
            </h3>
            <p className="mt-0.5 truncate text-xs text-[#B1B2B5]">
              {panel.items.length} 张 · {formatBytes(panel.totalSize)}
              {latestTimestamp > 0 ? ` · 最新 ${formatDate(latestTimestamp, i18n.language)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <OreButton
            focusKey="screenshot-btn-refresh"
            variant="secondary"
            size="sm"
            disabled={panel.isLoading}
            onArrowPress={(direction) => handleHeaderArrow('screenshot-sort', direction)}
            onClick={() => void panel.load(true)}
            prefixIcon={<RefreshCw size={15} className={panel.isRefreshing ? 'animate-spin' : ''} />}
          >
            {t('instanceDetail.screenshots.refresh', '刷新')}
          </OreButton>
          <OreButton
            focusKey="screenshot-btn-folder"
            variant="secondary"
            size="sm"
            onArrowPress={(direction) => handleHeaderArrow('screenshot-view-1', direction)}
            onClick={() => void panel.openFolder()}
            prefixIcon={<FolderOpen size={15} />}
          >
            {t('instanceDetail.screenshots.openFolder', '打开截图目录')}
          </OreButton>
        </div>
      </div>

      <div className="flex min-h-[58px] shrink-0 flex-wrap items-center justify-between gap-2 border-2 border-[#27272A] bg-[#1C1C1F] px-2.5 py-2">
        <div className="w-[168px] shrink-0">
          <OreDropdown
            focusKey="screenshot-sort"
            value={panel.sort}
            onChange={(value) => panel.setSort(value as ScreenshotSort)}
            options={sortOptions}
            className="!h-10 !w-full !rounded-none"
            panelWidth="trigger"
            prefixNode={<ArrowDownWideNarrow size={15} />}
            onArrowPress={handleToolbarArrow}
          />
        </div>

        <div className="flex h-10 items-center">
          <OreSegmentedControl
            tabs={viewTabs}
            activeTab={panel.view}
            onChange={(value) => panel.setView(value as ScreenshotView)}
            focusKeyPrefix="screenshot-view"
            onArrowPress={handleToolbarArrow}
            style={{
              '--seg-height': '40px',
              '--seg-min-width': '94px',
              '--seg-px': '12px',
              '--seg-font-size': '14px',
            } as React.CSSProperties}
          />
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-[#27272A] bg-[#141416]">
        {panel.isLoading ? (
          <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-2 overflow-hidden p-2.5">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="aspect-[16/10] animate-pulse border border-[#27272A] bg-[#18181B]" />
            ))}
          </div>
        ) : panel.error ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <ImageOff size={42} className="mb-3 text-[#C33636]" />
            <h4 className="font-minecraft text-sm text-white">无法读取截图</h4>
            <p className="mt-2 max-w-lg text-xs leading-relaxed text-[#B1B2B5]">{panel.error}</p>
            <OreButton
              focusKey="screenshot-btn-retry"
              variant="primary"
              size="sm"
              className="mt-4"
              onClick={() => void panel.load(false)}
            >
              重试
            </OreButton>
          </div>
        ) : panel.sortedItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
            <Images size={46} className="mb-3 text-[#68696B]" />
            <h4 className="font-minecraft text-base text-[#D0D1D4]">
              {t('instanceDetail.screenshots.emptyTitle', '还没有截图')}
            </h4>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-[#8C8D90]">
              {t('instanceDetail.screenshots.emptyDescription', '在游戏中按 F2 拍摄，截图会显示在这里。')}
            </p>
            <OreButton
              focusKey="screenshot-empty-folder"
              variant="secondary"
              size="sm"
              className="mt-4"
              onClick={() => void panel.openFolder()}
              prefixIcon={<FolderOpen size={15} />}
            >
              {t('instanceDetail.screenshots.openFolder', '打开截图目录')}
            </OreButton>
          </div>
        ) : (
          <OreOverlayScrollArea
            className="flex-1 min-h-0"
            viewportClassName="h-full"
            contentClassName={panel.view === 'grid'
              ? 'grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] content-start gap-2 p-2.5'
              : 'flex flex-col gap-2 p-2.5'}
          >
            <div ref={itemsContainerRef} className="contents" role="listbox" aria-multiselectable={panel.selectionMode || undefined}>
              {panel.sortedItems.map((item) => (
                <ScreenshotCard
                  key={item.id}
                  item={item}
                  locale={i18n.language}
                  view={panel.view}
                  selectionMode={panel.selectionMode}
                  selected={panel.selectedIds.has(item.id)}
                  onActivate={() => activateItem(item)}
                  onContextSelect={() => panel.toggleSelectionFromContext(item.id)}
                  onArrowPress={(direction) => handleCardArrow(item.id, direction)}
                />
              ))}
            </div>
          </OreOverlayScrollArea>
        )}

        {panel.selectionMode && panel.items.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-t-2 border-[#1E1E1F] bg-[#313233] px-3 py-2.5 shadow-[inset_0_2px_rgba(255,255,255,0.08)]">
            <span className="mr-auto font-minecraft text-xs text-white">
              已选 {panel.selectedIds.size} 张 · 右键截图可继续选择
            </span>
            <OreButton
              focusKey="screenshot-selection-done"
              variant="secondary"
              size="sm"
              onClick={panel.exitSelectionMode}
              onArrowPress={handleSelectionBarArrow}
            >
              完成
            </OreButton>
            <OreButton
              focusKey="screenshot-selection-all"
              variant="secondary"
              size="sm"
              onClick={panel.selectAll}
              onArrowPress={handleSelectionBarArrow}
            >
              {panel.selectedIds.size === panel.items.length ? '取消全选' : '全选'}
            </OreButton>
            <OreButton
              focusKey="screenshot-selection-clear"
              variant="secondary"
              size="sm"
              disabled={panel.selectedIds.size === 0}
              onClick={() => panel.selectedIds.forEach((id) => panel.toggleSelection(id))}
              onArrowPress={handleSelectionBarArrow}
            >
              取消选择
            </OreButton>
            <OreButton
              focusKey="screenshot-selection-delete"
              variant="danger"
              size="sm"
              disabled={panel.selectedIds.size === 0}
              onClick={() => panel.setPendingDeleteIds([...panel.selectedIds])}
              onArrowPress={handleSelectionBarArrow}
              prefixIcon={<Trash2 size={15} />}
            >
              删除 {panel.selectedIds.size} 张
            </OreButton>
          </div>
        )}
      </div>

      <ScreenshotPreviewModal
        item={panel.pendingDeleteIds.length > 0 ? null : panel.previewItem}
        index={panel.previewIndex}
        total={panel.sortedItems.length}
        isSettingCover={panel.isSettingCover}
        isCopying={panel.isCopying}
        onClose={() => panel.setPreviewId(null)}
        onPrevious={() => {
          const previous = panel.sortedItems[panel.previewIndex - 1];
          if (previous) panel.setPreviewId(previous.id);
        }}
        onNext={() => {
          const next = panel.sortedItems[panel.previewIndex + 1];
          if (next) panel.setPreviewId(next.id);
        }}
        onReveal={() => void panel.revealPreview()}
        onCopy={() => void panel.copyPreview()}
        onDelete={() => panel.previewItem && panel.setPendingDeleteIds([panel.previewItem.id])}
        onSetAsCover={() => void panel.setAsCover()}
      />

      <OreConfirmDialog
        isOpen={panel.pendingDeleteIds.length > 0}
        onClose={() => panel.setPendingDeleteIds([])}
        onConfirm={() => void panel.confirmDelete()}
        title={panel.pendingDeleteIds.length === 1 ? '删除这张截图？' : `删除选中的 ${panel.pendingDeleteIds.length} 张截图？`}
        headline={`将释放 ${formatBytes(pendingDeleteSize)} 空间`}
        description="截图将被永久删除，无法从启动器或系统回收站恢复。"
        confirmationNote="删除操作不可撤销，请确认已不再需要这些文件。"
        confirmationNoteTone="danger"
        confirmLabel="永久删除"
        cancelLabel="取消"
        confirmVariant="danger"
        confirmFocusKey="screenshot-delete-confirm"
        cancelFocusKey="screenshot-delete-cancel"
        isConfirming={panel.isDeleting}
        closeOnOutsideClick={!panel.isDeleting}
      />
    </FocusBoundary>
  );
};

