import React from 'react';
import { useTranslation } from 'react-i18next';

import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../ui/primitives/OreModal';
import type { LibraryResourceViewModel } from '../../logic/libraryItems';

interface FavoriteDeleteModalProps {
  target: LibraryResourceViewModel | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const FavoriteDeleteModal: React.FC<FavoriteDeleteModalProps> = ({
  target,
  isDeleting,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  return (
  <OreModal
    isOpen={!!target}
    onClose={onClose}
    title={t('libraryPage.deleteFavorite.title')}
    defaultFocusKey="favorite-delete-confirm"
    className="w-[32rem] max-w-[calc(100vw-2rem)]"
    actionsClassName="!justify-center"
    actions={(
      <>
        <OreButton
          variant="secondary"
          disabled={isDeleting}
          onClick={onClose}
        >
          {t('common.cancel')}
        </OreButton>
        <OreButton
          focusKey="favorite-delete-confirm"
          variant="danger"
          disabled={isDeleting}
          onClick={onConfirm}
        >
          {isDeleting ? t('libraryPage.deleteFavorite.deleting') : t('libraryPage.deleteFavorite.confirm')}
        </OreButton>
      </>
    )}
  >
    <div className="border-2 border-[var(--ore-color-border-danger-default)] bg-[var(--ore-color-background-danger-subtle)] p-4 text-sm leading-6 text-[var(--ore-color-text-danger-default)]">
      {t('libraryPage.deleteFavorite.desc', { title: target?.title || '' })}
    </div>
  </OreModal>
  );
};
