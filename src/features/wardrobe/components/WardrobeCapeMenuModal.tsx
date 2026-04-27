import React from 'react';
import { useTranslation } from 'react-i18next';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { WardrobeCape } from '../types';
import { WardrobeCapeCardPreview } from './WardrobeCapeCardPreview';

export interface WardrobeCapeMenuModalProps {
  capeMenuAsset: WardrobeCape | null;
  activeCape: WardrobeCape | null;
  isApplying: boolean;
  onClose: () => void;
  onApply: () => void;
}

export const WardrobeCapeMenuModal: React.FC<WardrobeCapeMenuModalProps> = ({
  capeMenuAsset,
  activeCape,
  isApplying,
  onClose,
  onApply,
}) => {
  const { t } = useTranslation();
  const isCurrentlyActive = activeCape?.id === capeMenuAsset?.id;

  return (
    <OreModal
      isOpen={!!capeMenuAsset}
      onClose={onClose}
      title={t('wardrobe.capeMenu.titleDefault')}
      hideCloseButton
      defaultFocusKey="wardrobe-cape-menu-apply"
      className="w-full max-w-[500px]"
      contentClassName="p-6"
    >
      {capeMenuAsset && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-center items-center p-4 bg-black/20 rounded-lg h-64">
            <WardrobeCapeCardPreview capeUrl={capeMenuAsset.url} className="w-full h-full drop-shadow-lg" />
          </div>

          <div className="flex flex-col gap-2 relative z-10">
            <h3 className="text-xl font-bold text-white mb-2 text-center">
              {isCurrentlyActive ? t('wardrobe.capeMenu.activeCape') : t('wardrobe.capeMenu.applyCapeHint')}
            </h3>
            
            <div className="flex gap-4">
              <OreButton
                focusKey="wardrobe-cape-menu-apply"
                variant={isCurrentlyActive ? 'danger' : 'primary'}
                onClick={onApply}
                disabled={isApplying}
                className="flex-1"
              >
                {isCurrentlyActive ? t('wardrobe.capeMenu.unequipAction') : t('wardrobe.capeMenu.applyAction')}
              </OreButton>
              <OreButton
                focusKey="wardrobe-cape-menu-cancel"
                variant="secondary"
                onClick={onClose}
                disabled={isApplying}
                className="flex-1"
              >
                {t('wardrobe.capeMenu.cancelAction')}
              </OreButton>
            </div>
          </div>
        </div>
      )}
    </OreModal>
  );
};
