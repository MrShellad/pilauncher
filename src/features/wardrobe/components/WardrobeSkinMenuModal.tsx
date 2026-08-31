import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Trash2, X } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreTag } from '../../../ui/primitives/OreTag';
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
    : t('wardrobe.skinMenu.titleDefault', { defaultValue: '皮肤设置与管理' });

  return (
    <OreModal
      isOpen={!!skinMenuAsset}
      onClose={onClose}
      title={modalTitle}
      defaultFocusKey={
        skinMenuAsset
          ? skinMenuAsset.isActive || skinMenuAsset.kind === 'profile'
            ? 'wardrobe-skin-menu-close'
            : 'wardrobe-skin-menu-apply'
          : undefined
      }
      className="w-full max-w-2xl font-minecraft select-none"
      contentClassName="p-5"
    >
      {skinMenuAsset && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* 左侧：3D 立体全身角色预览下沉矿槽 */}
          <div className="flex w-full md:w-56 shrink-0 flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]">
            <div className="h-64 sm:h-72 w-full flex items-center justify-center">
              <WardrobeSkinCardPreview
                skinUrl={skinMenuAsset.skinUrl}
                model={skinMenuModel}
                fullBody={true}
                className="h-full w-full object-contain"
              />
            </div>
            {skinMenuAsset.isActive && (
              <div className="mt-2">
                <OreTag variant="success" size="sm" weight="bold">
                  {t('wardrobe.activeBadge', { defaultValue: '已穿戴' })}
                </OreTag>
              </div>
            )}
          </div>

          {/* 右侧：参数配置与动作区 */}
          <div className="flex flex-1 flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* 文件名提示 */}
              {skinMenuAsset.originalTitle && (
                <div className="border-[2px] border-[#1E1E1F] bg-[#222324] px-3 py-2 text-xs text-[#D0D1D4] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                  <span className="text-[#8C8D90] mr-1">源文件名:</span>
                  <span
                    className="font-['JetBrains_Mono',monospace]"
                    style={{ fontFamily: '"JetBrains Mono", monospace' }}
                  >
                    {skinMenuAsset.originalTitle}.png
                  </span>
                </div>
              )}

              {/* 版型选择 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                  {t('wardrobe.skinMenu.modelLabel', { defaultValue: '模型手臂版型' })}
                </label>
                <OreToggleButton
                  options={[
                    {
                      label: t('wardrobe.skinMenu.modelClassic', { defaultValue: '经典 (4px)' }),
                      value: 'classic',
                    },
                    {
                      label: t('wardrobe.skinMenu.modelSlim', { defaultValue: '纤细 (3px)' }),
                      value: 'slim',
                    },
                  ]}
                  value={skinMenuModel}
                  onChange={(value) => onChangeModel(value as WardrobeSkinModel)}
                  size="md"
                  focusKeyPrefix="wardrobe-skin-menu-model"
                  className="w-full"
                />
              </div>

              {/* 皮肤自定义备注 */}
              {skinMenuAsset.kind === 'library' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                    {t('wardrobe.skinMenu.noteLabel', { defaultValue: '皮肤备注名称' })}
                  </label>
                  <OreInput
                    focusKey="wardrobe-skin-menu-note"
                    value={skinNote}
                    maxLength={MAX_NOTE_LENGTH}
                    onChange={(event) => onChangeNote(event.target.value)}
                    placeholder={t('wardrobe.skinMenu.notePlaceholder', {
                      defaultValue: '为此皮肤填写个性化备注',
                    })}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* 底部动作按钮栏 */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t-[2px] border-[#1E1E1F]">
              {!skinMenuAsset.isActive && skinMenuAsset.kind === 'library' && (
                <OreButton
                  focusKey="wardrobe-skin-menu-apply"
                  variant="primary"
                  size="md"
                  onClick={onApply}
                  disabled={isApplying}
                  className="flex-1 min-w-[8rem]"
                >
                  <Sparkles size={16} className="mr-1.5" />
                  <span>{t('wardrobe.skinMenu.applyAction', { defaultValue: '立即穿戴' })}</span>
                </OreButton>
              )}

              {!skinMenuAsset.isActive && skinMenuAsset.kind === 'library' && skinMenuAsset.canDelete && (
                <OreButton
                  focusKey="wardrobe-skin-menu-delete"
                  variant="danger"
                  size="md"
                  onClick={onDelete}
                  disabled={isApplying}
                  className="px-3"
                >
                  <Trash2 size={16} className="mr-1.5" />
                  <span>{t('wardrobe.skinMenu.deleteAction', { defaultValue: '删除' })}</span>
                </OreButton>
              )}

              {(skinMenuAsset.isActive || skinMenuAsset.kind === 'profile') && (
                <OreButton
                  focusKey="wardrobe-skin-menu-close"
                  variant="secondary"
                  size="md"
                  onClick={onClose}
                  className="w-full"
                >
                  <X size={16} className="mr-1.5" />
                  <span>{t('common.close', { defaultValue: '关闭' })}</span>
                </OreButton>
              )}
            </div>
          </div>
        </div>
      )}
    </OreModal>
  );
};

export default WardrobeSkinMenuModal;