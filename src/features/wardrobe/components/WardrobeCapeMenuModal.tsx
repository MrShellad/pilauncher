import React from 'react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import type { WardrobeCape, WardrobeProfile } from '../types';
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
  const isCurrentlyActive = activeCape?.id === capeMenuAsset?.id;

  return (
    <OreModal
      isOpen={!!capeMenuAsset}
      onClose={onClose}
      title="披风资产"
      className="w-full max-w-[500px]"
      contentClassName="p-6"
    >
      {capeMenuAsset && (
        <div className="flex flex-col gap-6">
          <div className="flex justify-center items-center p-4 bg-black/20 rounded-lg h-64">
            <WardrobeCapeCardPreview capeUrl={capeMenuAsset.url} className="w-full h-full drop-shadow-lg" />
          </div>

          <div className="flex flex-col gap-2 relative z-10">
            <h3 className="text-xl font-bold text-white mb-2">
              {isCurrentlyActive ? '当前正在使用这件披风' : '确定要装备这件披风吗？'}
            </h3>
            
            <div className="flex gap-4">
              <OreButton
                focusKey="wardrobe-cape-menu-apply"
                variant={isCurrentlyActive ? 'danger' : 'primary'}
                onClick={onApply}
                disabled={isApplying}
                className="flex-1"
              >
                {isCurrentlyActive ? '卸下当前披风' : '装备披风'}
              </OreButton>
              <OreButton
                focusKey="wardrobe-cape-menu-cancel"
                variant="secondary"
                onClick={onClose}
                disabled={isApplying}
                className="flex-1"
              >
                取消
              </OreButton>
            </div>
          </div>
        </div>
      )}
    </OreModal>
  );
};
