import React from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';
import { type SaveBackupMetadata } from '../../../logic/saveService';

export interface BackupDeleteConfirmModalProps {
  backupToDelete: SaveBackupMetadata | null;
  isDeletingBackup: boolean;
  formatDate: (ts: number) => string;
  onClose: () => void;
  onConfirm: () => void;
}

export const BackupDeleteConfirmModal: React.FC<BackupDeleteConfirmModalProps> = ({
  backupToDelete,
  isDeletingBackup,
  formatDate,
  onClose,
  onConfirm,
}) => {
  return (
    <OreModal
      isOpen={backupToDelete !== null}
      onClose={isDeletingBackup ? () => {} : onClose}
      title="删除备份确认"
      closeOnOutsideClick={!isDeletingBackup}
      actions={
        <>
          <OreButton
            focusKey="backup-del-cancel"
            variant="secondary"
            onClick={onClose}
            disabled={isDeletingBackup}
            className="flex-1"
          >
            取消
          </OreButton>
          <OreButton
            focusKey="backup-del-confirm"
            variant="danger"
            onClick={onConfirm}
            disabled={isDeletingBackup}
            className="flex-1"
          >
            {isDeletingBackup ? (
              <Loader2 size={16} className="mr-2 animate-spin" />
            ) : (
              <Trash2 size={16} className="mr-2" />
            )}
            删除备份
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/20 bg-red-500/10 text-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
          <Trash2 size={32} />
        </div>
        <h3 className="font-minecraft text-xl font-bold text-white">确认删除这个备份？</h3>
        <p className="max-w-xl px-4 font-minecraft text-ore-text-muted">
          目标快照：
          <span className="font-bold text-white"> {backupToDelete?.world.name}</span>
          。创建时间为
          <span className="font-bold text-white"> {backupToDelete ? formatDate(backupToDelete.createdAt) : ''}</span>
          ，删除后将无法再从恢复中心还原这个快照，但不会影响当前存档本体。
        </p>
      </div>
    </OreModal>
  );
};
