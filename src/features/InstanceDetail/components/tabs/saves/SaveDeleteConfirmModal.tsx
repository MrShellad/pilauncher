import React from 'react';
import { Trash2 } from 'lucide-react';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../ui/primitives/OreModal';

export interface SaveDeleteConfirmModalProps {
  saveToDelete: string | null;
  onClose: () => void;
  onDelete: (save: string, permanent: boolean) => void;
}

export const SaveDeleteConfirmModal: React.FC<SaveDeleteConfirmModalProps> = ({
  saveToDelete,
  onClose,
  onDelete,
}) => {
  return (
    <OreModal
      isOpen={saveToDelete !== null}
      onClose={onClose}
      title="删除存档确认"
      actions={
        <>
          <OreButton
            focusKey="save-del-cancel"
            variant="secondary"
            onClick={() => {
              if (!saveToDelete) return;
              onDelete(saveToDelete, false);
            }}
            className="flex-1"
          >
            移入回收站
          </OreButton>
          <OreButton
            focusKey="save-del-confirm"
            variant="danger"
            onClick={() => {
              if (!saveToDelete) return;
              onDelete(saveToDelete, true);
            }}
            className="flex-1"
          >
            彻底删除
          </OreButton>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center space-y-4 p-6 text-center">
        <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/20 bg-red-500/10 text-red-500 shadow-[inset_0_0_15px_rgba(239,68,68,0.2)]">
          <Trash2 size={32} />
        </div>
        <h3 className="font-minecraft text-xl font-bold text-white">确认删除这个世界？</h3>
        <p className="px-4 font-minecraft text-ore-text-muted">
          目标世界：
          <span className="font-bold text-red-300">“{saveToDelete}”</span>
          。您可以先移入回收站保留一段时间，也可以直接彻底删除。
        </p>
      </div>
    </OreModal>
  );
};
