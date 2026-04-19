import React from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import type { SkinCardAsset, WardrobeSkinModel } from '../types';

const MAX_NOTE_LENGTH = 28;

export interface WardrobeSkinMenuModalProps {
  skinMenuAsset: SkinCardAsset | null;
  skinMenuModel: WardrobeSkinModel;
  skinNote: string;
  isApplying: boolean;
  onClose: () => void;
  onChangeModel: (model: WardrobeSkinModel) => void;
  onChangeNote: (note: string) => void;
  onApply: () => void;
  onDelete: () => void;
}

export const WardrobeSkinMenuModal: React.FC<WardrobeSkinMenuModalProps> = ({
  skinMenuAsset,
  skinMenuModel,
  skinNote,
  isApplying,
  onClose,
  onChangeModel,
  onChangeNote,
  onApply,
  onDelete,
}) => {
  const { t } = useTranslation();
  const trimmedNote = skinNote.trim();
  const modalTitle = skinMenuAsset
    ? skinMenuAsset.kind === 'library'
      ? trimmedNote || skinMenuAsset.originalTitle || skinMenuAsset.title
      : skinMenuAsset.title
    : t('wardrobe.skinMenu.titleDefault');

  return (
    <OreModal
      isOpen={!!skinMenuAsset}
      onClose={onClose}
      title={modalTitle}
      className="w-full max-w-[860px]"
      contentClassName="p-0 overflow-hidden"
    >
      {skinMenuAsset && (
        <div className="wardrobe-skin-menu">
          <div className="wardrobe-skin-menu__preview">
            <div className="wardrobe-skin-menu__preview-frame">
              <WardrobeSkinCardPreview
                skinUrl={skinMenuAsset.skinUrl}
                model={skinMenuModel}
                fullBody={true}
                className="wardrobe-skin-menu__preview-card"
              />
            </div>
          </div>

          <div className="wardrobe-skin-menu__body">
            <div className="wardrobe-skin-menu__header">
              <h3>{modalTitle}</h3>
              {skinMenuAsset.originalTitle && skinMenuAsset.originalTitle !== modalTitle && (
                <p className="wardrobe-skin-menu__source-name">{t('wardrobe.skinMenu.filePrefix')}{skinMenuAsset.originalTitle}</p>
              )}
              <p>{skinMenuAsset.isActive ? t('wardrobe.skinMenu.activeSkin') : t('wardrobe.skinMenu.applySkinHint')}</p>
            </div>

            <OreToggleButton
              title={t('wardrobe.skinMenu.modelLabel')}
              options={[
                { label: t('wardrobe.skinMenu.modelClassic'), value: 'classic', description: t('wardrobe.skinMenu.modelClassicDesc') },
                { label: t('wardrobe.skinMenu.modelSlim'), value: 'slim', description: t('wardrobe.skinMenu.modelSlimDesc') },
              ]}
              value={skinMenuModel}
              onChange={(value) => onChangeModel(value as WardrobeSkinModel)}
              size="md"
              focusKeyPrefix="wardrobe-skin-menu-model"
              className="wardrobe-skin-menu__model-toggle"
            />

            {skinMenuAsset.kind === 'library' && (
              <div className="wardrobe-skin-menu__note-editor">
                <OreInput
                  focusKey="wardrobe-skin-menu-note"
                  label={t('wardrobe.skinMenu.noteLabel')}
                  value={skinNote}
                  maxLength={MAX_NOTE_LENGTH}
                  onChange={(event) => onChangeNote(event.target.value)}
                  placeholder={t('wardrobe.skinMenu.notePlaceholder')}
                  description={t('wardrobe.skinMenu.noteDescription')}
                  className="!text-[13px]"
                />
              </div>
            )}

            <div className="wardrobe-skin-menu__actions">
              {!skinMenuAsset.isActive && skinMenuAsset.kind === 'library' && (
                <OreButton
                  focusKey="wardrobe-skin-menu-apply"
                  variant="primary"
                  onClick={onApply}
                  disabled={isApplying}
                >
                  {t('wardrobe.skinMenu.applyAction')}
                </OreButton>
              )}

              {!skinMenuAsset.isActive && skinMenuAsset.kind === 'library' && skinMenuAsset.canDelete && (
                <OreButton
                  focusKey="wardrobe-skin-menu-delete"
                  variant="danger"
                  onClick={onDelete}
                  disabled={isApplying}
                >
                  <Trash2 size={16} />
                  {t('wardrobe.skinMenu.deleteAction')}
                </OreButton>
              )}
            </div>

            {skinMenuAsset.kind === 'profile' && (
              <div className="wardrobe-skin-menu__note">
                {t('wardrobe.skinMenu.onlineProfileNote')}
              </div>
            )}

            {skinMenuAsset.kind === 'library' && skinMenuAsset.isActive && (
              <div className="wardrobe-skin-menu__note">
                {t('wardrobe.skinMenu.activeLibraryNote')}
              </div>
            )}
          </div>
        </div>
      )}
    </OreModal>
  );
};
