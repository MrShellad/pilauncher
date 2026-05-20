import React from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Archive, Globe, History, Loader2, ShieldCheck, Trash2 } from 'lucide-react';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { OreAssetRow } from '../../../../../ui/primitives/OreAssetRow';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { type SaveDetail } from '../../../logic/saveService';
import { formatTrigger, getActionFocusKey, getRowFocusKey, type RowAction } from './useSavePanel';

export interface SaveListRowProps {
  index: number;
  save: SaveDetail;
  summary: { count: number; latest: any | null };
  operationRowIndex: number | null;
  isBackingUp: boolean;
  isRestoring: boolean;
  isCurrentBackupTarget: boolean;
  formatSize: (bytes: number) => string;
  formatDate: (ts: number) => string;
  onEnterContext: (index: number) => void;
  onArrowPress: (direction: string) => boolean | undefined;
  onActionArrow: (index: number, action: RowAction, direction: string) => boolean | undefined;
  onBackup: (index: number, save: SaveDetail) => void;
  onHistory: (index: number, save: SaveDetail) => void;
  onDelete: (index: number, save: SaveDetail, e: React.MouseEvent) => void;
}

export const SaveListRow: React.FC<SaveListRowProps> = ({
  index,
  save,
  summary,
  operationRowIndex,
  isBackingUp,
  isRestoring,
  isCurrentBackupTarget,
  formatSize,
  formatDate,
  onEnterContext,
  onArrowPress,
  onActionArrow,
  onBackup,
  onHistory,
  onDelete,
}) => {
  const latestBackup = summary.latest;

  return (
    <FocusItem
      focusKey={getRowFocusKey(index)}
      onEnter={() => onEnterContext(index)}
      onArrowPress={onArrowPress}
    >
      {({ ref, focused }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          <OreAssetRow
            focusable={false}
            focused={focused}
            operationActive={operationRowIndex === index}
            title={save.worldName}
            description={
              latestBackup
                ? `最近备份：${formatDate(latestBackup.createdAt)} · ${formatTrigger(latestBackup.trigger)}`
                : `最后游玩：${formatDate(save.lastPlayedTime)}`
            }
            metaItems={[
              `文件夹：${save.folderName}`,
              `世界大小：${formatSize(save.sizeBytes)}`,
              summary.count > 0 ? `备份 ${summary.count} 个` : '暂无备份',
            ]}
            leading={
              save.iconPath ? (
                <img
                  src={`${convertFileSrc(save.iconPath)}?t=${save.lastPlayedTime}`}
                  alt="Save Icon"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Globe size={28} className="text-[var(--ore-downloadDetail-labelText)] drop-shadow-md" />
              )
            }
            badges={
              latestBackup?.state.safeBackup ? (
                <span className="inline-flex items-center gap-1 rounded-sm border border-ore-green/40 bg-ore-green/10 px-2 py-0.5 text-[11px] text-ore-green">
                  <ShieldCheck size={12} />
                  安全快照
                </span>
              ) : null
            }
            trailingClassName="flex items-center space-x-3"
            trailing={
              <>
                <OreButton
                  focusKey={getActionFocusKey(index, 'backup')}
                  variant="secondary"
                  size="auto"
                  className="!h-10 !min-h-10"
                  onArrowPress={(direction) => onActionArrow(index, 'backup', direction)}
                  onClick={() => onBackup(index, save)}
                  disabled={isBackingUp || isRestoring}
                >
                  {isCurrentBackupTarget ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Archive size={16} className="mr-2" />
                  )}
                  立即备份
                </OreButton>

                <OreButton
                  focusKey={getActionFocusKey(index, 'history')}
                  variant="secondary"
                  size="auto"
                  className="!h-10 !min-h-10"
                  onArrowPress={(direction) => onActionArrow(index, 'history', direction)}
                  onClick={() => onHistory(index, save)}
                >
                  <History size={16} className="mr-2" />
                  查看历史
                </OreButton>

                <OreButton
                  focusKey={getActionFocusKey(index, 'delete')}
                  variant="danger"
                  size="auto"
                  className="!h-10 !min-h-10"
                  onArrowPress={(direction) => onActionArrow(index, 'delete', direction)}
                  onClick={(e) => onDelete(index, save, e)}
                >
                  <Trash2 size={16} className="mr-2" />
                  删除
                </OreButton>
              </>
            }
          />
        </div>
      )}
    </FocusItem>
  );
};
