import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Copy, FolderSearch, Image as ImageIcon, Trash2 } from 'lucide-react';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { ScreenshotItem } from '../logic/screenshotService';

interface ScreenshotPreviewModalProps {
  item: ScreenshotItem | null;
  index: number;
  total: number;
  isSettingCover: boolean;
  isCopying: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReveal: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onSetAsCover: () => void;
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const ScreenshotPreviewModal: React.FC<ScreenshotPreviewModalProps> = ({
  item,
  index,
  total,
  isSettingCover,
  isCopying,
  onClose,
  onPrevious,
  onNext,
  onReveal,
  onCopy,
  onDelete,
  onSetAsCover,
}) => {
  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Delete') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onDelete();
        return;
      }
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === 'BUTTON' || active?.tagName === 'INPUT') return;
      if (event.key === 'ArrowLeft' && index > 0) {
        event.preventDefault();
        onPrevious();
      }
      if (event.key === 'ArrowRight' && index < total - 1) {
        event.preventDefault();
        onNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [index, item, onDelete, onNext, onPrevious, total]);

  return (
    <OreModal
      isOpen={Boolean(item)}
      onClose={onClose}
      title={item?.fileName ?? '截图预览'}
      className="w-[92vw] h-[88vh] max-w-[1700px]"
      contentClassName="!p-0"
      disableScrollArea
      defaultFocusKey="screenshot-preview-cover"
      actionsClassName="!px-4 !py-3 flex-wrap gap-2"
      actions={
        item ? (
          <>
            <div className="mr-auto min-w-0 text-xs text-[#B1B2B5]">
              <span className="text-white">{index + 1} / {total}</span>
              <span className="mx-2 text-[#58585A]">·</span>
              <span>{item.width && item.height ? `${item.width}×${item.height}` : item.format.toUpperCase()}</span>
              <span className="mx-2 text-[#58585A]">·</span>
              <span>{formatBytes(item.sizeBytes)}</span>
            </div>
            <OreButton
              focusKey="screenshot-preview-copy"
              variant="secondary"
              size="sm"
              loading={isCopying}
              onClick={onCopy}
              prefixIcon={<Copy size={15} />}
            >
              复制图片
            </OreButton>
            <OreButton
              focusKey="screenshot-preview-reveal"
              variant="secondary"
              size="sm"
              onClick={onReveal}
              prefixIcon={<FolderSearch size={15} />}
            >
              定位文件
            </OreButton>
            <OreButton
              focusKey="screenshot-preview-delete"
              variant="danger"
              size="sm"
              onClick={onDelete}
              prefixIcon={<Trash2 size={15} />}
            >
              删除
            </OreButton>
            <OreButton
              focusKey="screenshot-preview-cover"
              variant="primary"
              size="sm"
              loading={isSettingCover}
              onClick={onSetAsCover}
              prefixIcon={<ImageIcon size={15} />}
            >
              设为实例封面
            </OreButton>
          </>
        ) : null
      }
    >
      {item && (
        <div className="relative flex h-full min-h-0 items-center justify-center overflow-hidden bg-[#111214] p-3 sm:p-5">
          <img
            src={item.assetUrl}
            alt={`${item.fileName} 截图`}
            className="h-full w-full select-none object-contain"
            draggable={false}
          />

          <div className="absolute inset-y-0 left-2 flex items-center">
            <OreButton
              focusKey="screenshot-preview-prev"
              variant="secondary"
              size="icon"
              iconOnly
              disabled={index <= 0}
              onClick={onPrevious}
              aria-label="上一张截图"
              className="!h-11 !w-11 !min-w-11"
            >
              <ChevronLeft size={24} />
            </OreButton>
          </div>

          <div className="absolute inset-y-0 right-2 flex items-center">
            <OreButton
              focusKey="screenshot-preview-next"
              variant="secondary"
              size="icon"
              iconOnly
              disabled={index >= total - 1}
              onClick={onNext}
              aria-label="下一张截图"
              className="!h-11 !w-11 !min-w-11"
            >
              <ChevronRight size={24} />
            </OreButton>
          </div>
        </div>
      )}
    </OreModal>
  );
};

