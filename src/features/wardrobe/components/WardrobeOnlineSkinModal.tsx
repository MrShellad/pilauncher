import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookmarkPlus, Check, Eye, X } from 'lucide-react';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreInput } from '../../../ui/primitives/OreInput';
import { OreModal } from '../../../ui/primitives/OreModal';
import { OreTag } from '../../../ui/primitives/OreTag';
import { OreToggleButton } from '../../../ui/primitives/OreToggleButton';
import { WardrobeSkinCardPreview } from './WardrobeSkinCardPreview';
import { determineModelType } from '../utils/wardrobe.utils';
import type { OnlineSkinItem, WardrobeSkinModel } from '../types';

export interface WardrobeOnlineSkinModalProps {
  skinItem: OnlineSkinItem | null;
  isProcessing: boolean;
  onClose: () => void;
  onPreview: (skinItem: OnlineSkinItem, model: WardrobeSkinModel) => void;
  onSaveToLibrary: (skinItem: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => Promise<void>;
  onApplyAndSave: (skinItem: OnlineSkinItem, model: WardrobeSkinModel, customTitle?: string) => Promise<void>;
}

export const WardrobeOnlineSkinModal: React.FC<WardrobeOnlineSkinModalProps> = ({
  skinItem,
  isProcessing,
  onClose,
  onPreview,
  onSaveToLibrary,
  onApplyAndSave,
}) => {
  const { t } = useTranslation();
  const [selectedModel, setSelectedModel] = useState<WardrobeSkinModel>(skinItem?.model || 'classic');
  const [customTitle, setCustomTitle] = useState<string>(skinItem?.title || '');

  // Reset internal state when skin item changes & auto-detect model accurately
  React.useEffect(() => {
    if (skinItem) {
      setSelectedModel(skinItem.model);
      setCustomTitle(skinItem.title);

      void determineModelType(skinItem.skinUrl).then((detected) => {
        setSelectedModel(detected);
      });
    }
  }, [skinItem]);

  return (
    <OreModal
      isOpen={!!skinItem}
      onClose={onClose}
      title={skinItem?.title || '在线皮肤详情'}
      defaultFocusKey="wardrobe-online-apply"
      className="w-full max-w-2xl font-minecraft select-none"
      contentClassName="p-5"
    >
      {skinItem && (
        <div className="flex flex-col md:flex-row gap-6">
          {/* 左侧：3D 立体全身角色预览下沉矿槽 */}
          <div className="flex w-full md:w-56 shrink-0 flex-col items-center justify-center border-[2px] border-[#1E1E1F] bg-[#141517] p-3 shadow-[inset_0_2px_6px_rgba(0,0,0,0.7)]">
            <div className="h-64 sm:h-72 w-full flex items-center justify-center">
              <WardrobeSkinCardPreview
                skinUrl={skinItem.skinUrl}
                model={selectedModel}
                fullBody={true}
                className="h-full w-full object-contain"
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <OreTag variant={skinItem.source === 'player' ? 'primary' : 'neutral'} size="sm" weight="bold">
                {skinItem.source === 'player' ? '正版玩家' : skinItem.source === 'littleskin' ? 'LittleSkin' : '精选推荐'}
              </OreTag>
            </div>
          </div>

          {/* 右侧：参数配置与操作栏 */}
          <div className="flex flex-1 flex-col justify-between space-y-4">
            <div className="space-y-4">
              {/* 作者与来源信息 */}
              <div className="border-[2px] border-[#1E1E1F] bg-[#222324] px-3 py-2 text-xs text-[#D0D1D4] shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between items-center">
                  <span className="text-[#8C8D90]">创作者:</span>
                  <span className="font-bold text-white">{skinItem.author || '社区创作者'}</span>
                </div>
                {typeof skinItem.likes === 'number' && (
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[#8C8D90]">获赞/热度:</span>
                    <span className="text-[#6CC349] font-bold">♥ {skinItem.likes}</span>
                  </div>
                )}
              </div>

              {/* 手臂模型版型选择 */}
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
                  value={selectedModel}
                  onChange={(value) => setSelectedModel(value as WardrobeSkinModel)}
                  size="md"
                  focusKeyPrefix="wardrobe-online-model"
                  className="w-full"
                />
              </div>

              {/* 自定义保存名称 */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[#D0D1D4]">
                  {t('wardrobe.skinMenu.noteLabel', { defaultValue: '皮肤保存名称' })}
                </label>
                <OreInput
                  focusKey="wardrobe-online-title"
                  value={customTitle}
                  maxLength={28}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="为此皮肤填写保存名称"
                  className="w-full"
                />
              </div>
            </div>

            {/* 底部动作栏 */}
            <div className="flex flex-wrap items-center gap-2.5 pt-3 border-t-[2px] border-[#1E1E1F]">
              <OreButton
                focusKey="wardrobe-online-apply"
                variant="primary"
                size="md"
                onClick={() => void onApplyAndSave(skinItem, selectedModel, customTitle)}
                disabled={isProcessing}
                className="flex-1 min-w-[9rem]"
              >
                <Check size={16} className="mr-1.5" />
                <span>立即穿戴并保存</span>
              </OreButton>

              <OreButton
                focusKey="wardrobe-online-save"
                variant="secondary"
                size="md"
                onClick={() => void onSaveToLibrary(skinItem, selectedModel, customTitle)}
                disabled={isProcessing}
                className="px-3"
              >
                <BookmarkPlus size={16} className="mr-1" />
                <span>仅收藏到库</span>
              </OreButton>

              <OreButton
                focusKey="wardrobe-online-preview"
                variant="secondary"
                size="md"
                onClick={() => {
                  onPreview(skinItem, selectedModel);
                  onClose();
                }}
                disabled={isProcessing}
                className="px-3"
              >
                <Eye size={16} className="mr-1" />
                <span>试穿</span>
              </OreButton>

              <OreButton
                focusKey="wardrobe-online-close"
                variant="secondary"
                size="md"
                onClick={onClose}
                disabled={isProcessing}
                className="px-3"
              >
                <X size={16} />
              </OreButton>
            </div>
          </div>
        </div>
      )}
    </OreModal>
  );
};

export default WardrobeOnlineSkinModal;