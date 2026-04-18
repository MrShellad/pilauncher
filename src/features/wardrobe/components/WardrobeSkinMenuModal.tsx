import React from 'react';
import { Trash2 } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import type { SkinCardAsset, WardrobeSkinModel } from '../types';

export interface WardrobeSkinMenuModalProps {
  skinMenuAsset: SkinCardAsset | null;
  skinMenuModel: WardrobeSkinModel;
  isApplying: boolean;
  onClose: () => void;
  onChangeModel: (model: WardrobeSkinModel) => void;
  onApply: () => void;
  onDelete: () => void;
}

export const WardrobeSkinMenuModal: React.FC<WardrobeSkinMenuModalProps> = ({
  skinMenuAsset,
  skinMenuModel,
  isApplying,
  onClose,
  onChangeModel,
  onApply,
  onDelete,
}) => {
  return (
    <OreModal
      isOpen={!!skinMenuAsset}
      onClose={onClose}
      title={skinMenuAsset?.title || '皮肤资产'}
      className="w-full max-w-[820px]"
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
              <h3>{skinMenuAsset.title}</h3>
              <p>{skinMenuAsset.isActive ? '当前正在使用这套皮肤' : '应用时将使用当前选择的模型'}</p>
            </div>

            <OreToggleButton
              title="模型"
              options={[
                { label: 'Classic', value: 'classic', description: '粗手臂模型' },
                { label: 'Slim', value: 'slim', description: '细手臂模型' },
              ]}
              value={skinMenuModel}
              onChange={(value) => onChangeModel(value as WardrobeSkinModel)}
              size="md"
              focusKeyPrefix="wardrobe-skin-menu-model"
              className="wardrobe-skin-menu__model-toggle"
            />

            <div className="wardrobe-skin-menu__actions">
              {!skinMenuAsset.isActive && skinMenuAsset.kind === 'library' && (
                <OreButton
                  focusKey="wardrobe-skin-menu-apply"
                  variant="primary"
                  onClick={onApply}
                  disabled={isApplying}
                >
                  应用当前皮肤
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
                  删除当前皮肤
                </OreButton>
              )}
            </div>

            {skinMenuAsset.kind === 'profile' && (
              <div className="wardrobe-skin-menu__note">
                这是账号当前正在使用的在线皮肤，只能切换预览模型，不能从资产库删除。
              </div>
            )}

            {skinMenuAsset.kind === 'library' && skinMenuAsset.isActive && (
              <div className="wardrobe-skin-menu__note">
                当前使用中的本地皮肤不会显示删除入口。
              </div>
            )}
          </div>
        </div>
      )}
    </OreModal>
  );
};
