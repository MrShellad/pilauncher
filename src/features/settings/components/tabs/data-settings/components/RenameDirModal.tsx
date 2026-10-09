import React from 'react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../../ui/primitives/OreInput';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import type { ArrowPressHandler } from '../types';

interface RenameDirModalProps {
  isOpen: boolean;
  newName: string;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => Promise<void>;
  onArrowPress: ArrowPressHandler;
}

export const RenameDirModal: React.FC<RenameDirModalProps> = ({
  isOpen,
  newName,
  onNameChange,
  onClose,
  onSubmit,
  onArrowPress
}) => {
  const { t } = useTranslation();

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('settings.data.renameModalTitle')}
      defaultFocusKey="settings-rename-input"
      actions={
        <div className="flex w-full justify-center gap-3">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
            focusKey="settings-rename-cancel"
            onArrowPress={onArrowPress}
            className="flex-1"
          >
            {t('settings.data.btnCancel')}
          </OreButton>
          <OreButton
            variant="primary"
            size="full"
            onClick={() => void onSubmit()}
            focusKey="settings-rename-submit"
            onArrowPress={onArrowPress}
            className="flex-1"
          >
            {t('settings.data.btnConfirmRename')}
          </OreButton>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-ore-text-muted">{t('settings.data.renameModalDesc')}</p>
        <OreInput
          focusKey="settings-rename-input"
          onArrowPress={onArrowPress}
          value={newName}
          onChange={e => onNameChange(e.target.value)}
          placeholder={t('settings.data.renameModalPlaceholder')}
        />
      </div>
    </OreModal>
  );
};
