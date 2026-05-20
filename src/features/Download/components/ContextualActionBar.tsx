import React from 'react';
import { Download, Heart, Layers3, X } from 'lucide-react';

import { OreButton } from '../../../ui/primitives/OreButton';

interface ContextualActionBarProps {
  selectedCount: number;
  showBulkDownload: boolean;
  onBulkDownload: () => void;
  onAddFavorite: () => void;
  onClear: () => void;
  focusKeyPrefix?: string;
  favoriteLabel?: string;
}

export const getContextualActionBarFocusKey = (prefix = 'download-context-actions', showBulkDownload = false) =>
  showBulkDownload ? `${prefix}-bulk-download` : `${prefix}-favorite`;

export const ContextualActionBar: React.FC<ContextualActionBarProps> = ({
  selectedCount,
  showBulkDownload,
  onBulkDownload,
  onAddFavorite,
  onClear,
  focusKeyPrefix = 'download-context-actions',
  favoriteLabel = '加入收藏',
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-6 z-40 flex justify-center px-6">
      <div className="pointer-events-auto flex max-w-[calc(100vw-3rem)] flex-wrap items-center gap-3 border-[0.1875rem] border-[#1E1E1F] bg-[#313233] px-4 py-3 shadow-[0_1rem_2.25rem_rgba(0,0,0,0.42),inset_0_0.125rem_0_rgba(255,255,255,0.14),inset_0_-0.25rem_0_rgba(0,0,0,0.28)]">
        <div className="flex h-10 min-w-[10rem] items-center gap-3 border-2 border-[#1E1E1F] bg-[#1E1E1F] px-3 text-white shadow-[inset_0_0.125rem_0_rgba(255,255,255,0.08)]">
          <Layers3 size={18} className="text-[#6CC349]" />
          <div className="font-minecraft text-sm leading-none">
            已选择 <span className="text-[#6CC349]">{selectedCount}</span> 项
          </div>
        </div>

        {showBulkDownload && (
          <OreButton
            focusKey={`${focusKeyPrefix}-bulk-download`}
            variant="primary"
            size="auto"
            onClick={onBulkDownload}
            className="!min-w-0 !px-0"
          >
            <span className="flex h-full min-w-[11rem] items-center justify-center gap-2 px-3 text-sm">
              <Download size={15} />
              批量下载
            </span>
          </OreButton>
        )}

        <OreButton
          focusKey={`${focusKeyPrefix}-favorite`}
          variant="secondary"
          size="auto"
          onClick={onAddFavorite}
          className="!min-w-0 !px-0"
        >
          <span className="flex h-full min-w-[10rem] items-center justify-center gap-2 px-3 text-sm">
            <Heart size={15} />
            {favoriteLabel}
          </span>
        </OreButton>

        <OreButton
          focusKey={`${focusKeyPrefix}-clear`}
          variant="ghost"
          size="auto"
          onClick={onClear}
          title="清空选择"
          className="!h-10 !w-10 !min-w-0 !border-[#1E1E1F] !bg-[#48494A] !px-0 !text-[#D0D1D4] shadow-[inset_0_-0.25rem_0_rgba(0,0,0,0.32),inset_0.125rem_0.125rem_0_rgba(255,255,255,0.12)] hover:!bg-[#58585A] hover:!text-white"
        >
          <X size={17} />
        </OreButton>
      </div>
    </div>
  );
};
