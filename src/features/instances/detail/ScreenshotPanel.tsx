import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ArrowDownWideNarrow,
  FolderOpen,
  Images,
  LayoutGrid,
  List,
  RefreshCw,
} from 'lucide-react';
import { doesFocusableExist, setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreConfirmDialog } from '../../../ui/primitives/OreConfirmDialog';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';
import { OreSegmentedControl } from '../../../ui/primitives/OreSegmentedControl';
import type { ScreenshotItem } from './logic/screenshotService';
import { ScreenshotGallery } from './screenshots/ScreenshotGallery';
import { ScreenshotPreviewModal } from './screenshots/ScreenshotPreviewModal';
import { formatScreenshotBytes, formatScreenshotDate } from './screenshots/screenshotPresentation';
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
              {panel.items.length} 张 · {formatScreenshotBytes(panel.totalSize)}
              {latestTimestamp > 0
                ? ` · 最新 ${formatScreenshotDate(latestTimestamp, i18n.language)}`
                : ''}
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

      <ScreenshotGallery
        itemsContainerRef={itemsContainerRef}
        items={panel.items}
        sortedItems={panel.sortedItems}
        selectedIds={panel.selectedIds}
        locale={i18n.language}
        view={panel.view}
        selectionMode={panel.selectionMode}
        isLoading={panel.isLoading}
        error={panel.error}
        onRetry={() => void panel.load(false)}
        onOpenFolder={() => void panel.openFolder()}
        onActivate={activateItem}
        onContextSelect={panel.toggleSelectionFromContext}
        onCardArrow={handleCardArrow}
        onExitSelectionMode={panel.exitSelectionMode}
        onSelectAll={panel.selectAll}
        onClearSelection={() =>
          panel.selectedIds.forEach((id) => panel.toggleSelection(id))
        }
        onDeleteSelection={() => panel.setPendingDeleteIds([...panel.selectedIds])}
        onSelectionBarArrow={handleSelectionBarArrow}
      />

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
        headline={`将释放 ${formatScreenshotBytes(pendingDeleteSize)} 空间`}
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

