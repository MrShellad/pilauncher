// src/features/InstanceDetail/components/tabs/mods/components/dialogs/components/ModDeleteConfirmModal.tsx
import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import { useTranslation } from 'react-i18next';

import { OreModal } from '../../../../../../../../ui/primitives/OreModal';
import { OreButton } from '../../../../../../../../ui/primitives/OreButton';
import { FocusBoundary } from '../../../../../../../../ui/focus/FocusBoundary';

interface ModDeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string | undefined;
  onConfirm: () => void;
}

export const ModDeleteConfirmModal: React.FC<ModDeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onConfirm
}) => {
  const { t } = useTranslation();

  // Set focus to cancel button when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setFocus('btn-delete-cancel'), 100);
    }
  }, [isOpen]);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('instanceDetail.mods.deleteConfirm.title', { defaultValue: '删除模组' })}
      className="w-[95vw] max-w-md"
    >
      <FocusBoundary
        id="mod-delete-confirm-boundary"
        trapFocus
        onEscape={onClose}
        className="flex flex-col bg-[#141415] font-minecraft"
      >
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 mb-8 text-center sm:text-left">
          <div className="p-3 bg-red-500/10 rounded-sm border border-red-500/20 shrink-0">
            <AlertTriangle className="text-red-500" size={28} />
          </div>
          <div className="flex-1 mt-1">
            <h3 className="text-white font-minecraft text-base mb-2 relative">
              {t('instanceDetail.mods.deleteConfirm.confirmPrefix', { defaultValue: '确定要删除' })}
              <span className="font-bold underline decoration-red-500/50 underline-offset-4 mx-1.5 inline-block text-base align-baseline leading-none break-all">
                {fileName}
              </span>
              {t('instanceDetail.mods.deleteConfirm.confirmSuffix', { defaultValue: '吗？' })}
            </h3>
            <p className="text-gray-400 text-sm">{t('instanceDetail.mods.deleteConfirm.description', { defaultValue: '此操作将会把该模组从实例的 mods 文件夹中移除，删除后无法通过启动器撤销恢复该文件。' })}</p>
          </div>
        </div>
        <div className="flex flex-col-reverse sm:flex-row justify-center gap-3 mt-auto">
          <OreButton focusKey="btn-delete-cancel" variant="secondary" size="auto" onClick={onClose} className="w-full sm:w-24">
            {t('instanceDetail.mods.deleteConfirm.cancel', { defaultValue: '取消' })}
          </OreButton>
          <OreButton focusKey="btn-delete-confirm" variant="danger" size="auto" onClick={onConfirm} className="w-full sm:w-36 font-bold">
            {t('instanceDetail.mods.deleteConfirm.confirm', { defaultValue: '确认删除' })}
          </OreButton>
        </div>
      </FocusBoundary>
    </OreModal>
  );
};
