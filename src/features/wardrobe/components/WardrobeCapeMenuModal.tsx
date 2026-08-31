import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ShieldOff } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreTag } from '../../../ui/primitives/OreTag';
import type { WardrobeCape, WardrobeSkinModel } from '../types';
import { WardrobeCapeCardPreview } from './WardrobeCapeCardPreview';

export interface WardrobeCapeMenuModalProps {
  capeMenuAsset: WardrobeCape | null;
  activeCape: WardrobeCape | null;
  currentSkinUrl: string | null;
  currentSkinModel: WardrobeSkinModel;
  isApplying: boolean;
  onClose: () => void;
  onApply: () => void;
}

export const WardrobeCapeMenuModal: React.FC<WardrobeCapeMenuModalProps> = ({
  capeMenuAsset,
  activeCape,
  currentSkinUrl,
  currentSkinModel,
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
      title={t('wardrobe.capeMenu.titleDefault', { defaultValue: '披风设置与管理' })}
      defaultFocusKey="wardrobe-cape-menu-apply"
      className="w-full max-w-lg font-minecraft select-none"
      contentClassName="p-5"
    >
      {capeMenuAsset && (
        <div className="flex flex-col space-y-5">
          {/* 下沉式披风 3D 角色背影视口 */}
          <div className="relative flex h-52 sm:h-60 w-full items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]">
            <WardrobeCapeCardPreview
              capeUrl={capeMenuAsset.url}
              skinUrl={currentSkinUrl}
              skinModel={currentSkinModel}
              className="h-full w-full object-contain"
            />
            {isCurrentlyActive && (
              <div className="absolute top-2 left-2 z-10">
                <OreTag variant="success" size="sm" weight="bold">
                  {t('wardrobe.activeBadge', { defaultValue: '已穿戴' })}
                </OreTag>
              </div>
            )}
          </div>

          <div className="text-center space-y-1">
            <h4 className="text-base font-bold text-white">
              {isCurrentlyActive
                ? t('wardrobe.capeMenu.activeCape', { defaultValue: '当前已佩戴此官方披风' })
                : t('wardrobe.capeMenu.applyCapeHint', { defaultValue: '确认将此官方披风佩戴至角色？' })}
            </h4>
            <p className="text-xs text-[#8C8D90]">
              {capeMenuAsset.id.replace(/^cape-/i, '')}
            </p>
          </div>

          {/* 动作按钮 */}
          <div className="flex gap-3 pt-2 border-t-[2px] border-[#1E1E1F]">
            <OreButton
              focusKey="wardrobe-cape-menu-apply"
              variant={isCurrentlyActive ? 'danger' : 'primary'}
              size="md"
              onClick={onApply}
              disabled={isApplying}
              className="flex-1"
            >
              {isCurrentlyActive ? (
                <>
                  <ShieldOff size={16} className="mr-1.5" />
                  <span>{t('wardrobe.capeMenu.unequipAction', { defaultValue: '卸下披风' })}</span>
                </>
              ) : (
                <>
                  <Check size={16} className="mr-1.5" />
                  <span>{t('wardrobe.capeMenu.applyAction', { defaultValue: '穿戴披风' })}</span>
                </>
              )}
            </OreButton>
            <OreButton
              focusKey="wardrobe-cape-menu-cancel"
              variant="secondary"
              size="md"
              onClick={onClose}
              disabled={isApplying}
              className="flex-1"
            >
              <span>{t('wardrobe.capeMenu.cancelAction', { defaultValue: '取消' })}</span>
            </OreButton>
          </div>
        </div>
      )}
    </OreModal>
  );
};

export default WardrobeCapeMenuModal;