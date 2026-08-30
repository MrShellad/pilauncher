import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Info, Tag, Type, Upload, User } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';

import { FocusItem } from '../../../../../ui/focus/FocusItem';
import { useToastStore } from '../../../../../store/useToastStore';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import type { ExportData } from './ExportPanel';

interface ExportBasicStepProps {
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportBasicStep: React.FC<ExportBasicStepProps> = ({ data, onChange }) => {
  const { t } = useTranslation();
  const [isSelectingLogo, setIsSelectingLogo] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const addToast = useToastStore((s) => s.addToast);

  const handleSelectHeroLogo = async () => {
    setIsSelectingLogo(true);
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'],
          },
        ],
      });

      if (selectedPath && typeof selectedPath === 'string') {
        onChange({ heroLogo: convertFileSrc(selectedPath) });
      }
    } catch (error) {
      console.error('Failed to open dialog', error);
      addToast(
        'error',
        t('instanceDetail.export.basic.openImagePickerFailed', {
          defaultValue: '打开图片选择器失败，请检查系统权限',
        })
      );
    } finally {
      setIsSelectingLogo(false);
    }
  };

  return (
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto flex flex-col space-y-5 font-minecraft select-none">
      {/* 3D 浮雕主要参数表单卡片 (水平居中，弹性空间) */}
      <div className="border-[3px] border-[#1E1E1F] bg-[#48494A] p-5 sm:p-6 lg:p-7 shadow-[inset_0_2px_0_rgba(255,255,255,0.12),inset_0_-2px_0_rgba(0,0,0,0.35)] space-y-5">
        {/* 1. 整合包名称 (作为核心身份，享受全宽最大显示空间) */}
        <div className="space-y-1.5">
          <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            <Type size={16} className="mr-2 text-[#6CC349]" />
            <span>{t('instanceDetail.export.basic.packName', { defaultValue: '整合包名称' })}</span>
            <span className="ml-1 text-[#FF9E9E]">*</span>
          </label>
          <OreInput
            value={data.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder={t('instanceDetail.export.basic.packNamePlaceholder', {
              defaultValue: '例如：我的冒险整合包',
            })}
            className="w-full text-sm sm:text-base font-bold"
          />
        </div>

        {/* 2. 版本号、作者与 Hero Logo 弹性并列行 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
          {/* 左侧：版本与作者 */}
          <div className="flex flex-col space-y-4">
            <div className="space-y-1.5">
              <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
                <Tag size={15} className="mr-2 text-[#6CC349]" />
                <span>{t('instanceDetail.export.basic.version', { defaultValue: '版本号' })}</span>
                <span className="ml-1 text-[#FF9E9E]">*</span>
              </label>
              <OreInput
                value={data.version}
                onChange={(event) => onChange({ version: event.target.value })}
                placeholder={t('instanceDetail.export.basic.versionPlaceholder', {
                  defaultValue: '例如：1.0.0',
                })}
                className="w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
                <User size={15} className="mr-2 text-[#6CC349]" />
                <span>{t('instanceDetail.export.basic.author', { defaultValue: '作者' })}</span>
              </label>
              <OreInput
                value={data.author}
                onChange={(event) => onChange({ author: event.target.value })}
                placeholder={t('instanceDetail.export.basic.authorPlaceholder', {
                  defaultValue: '填写作者名称',
                })}
                className="w-full"
              />
            </div>
          </div>

          {/* 右侧：Hero Logo 槽 */}
          <div className="flex flex-col space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
                <ImageIcon size={15} className="mr-2 text-[#6CC349]" />
                <span>{t('instanceDetail.export.basic.heroLogo', { defaultValue: 'Hero Logo' })}</span>
              </label>
              <span className="text-xs text-[#8C8D90]">可选</span>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 border-[2px] border-[#1E1E1F] bg-[#313233] p-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]">
              <div className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)]">
                {data.heroLogo ? (
                  <img
                    src={data.heroLogo}
                    alt="Hero Logo"
                    className="h-full w-full object-contain p-1"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-[#8C8D90]">
                    <ImageIcon size={28} className="opacity-40" />
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-center space-y-2 flex-1 w-full sm:w-auto">
                <p className="text-xs text-[#8C8D90]">
                  {data.heroLogo ? '已加载封面图' : '未设置封面图片'}
                </p>
                <OreButton
                  variant="secondary"
                  size="sm"
                  onClick={handleSelectHeroLogo}
                  disabled={isSelectingLogo}
                >
                  <Upload size={14} className="mr-1.5 shrink-0" />
                  <span>
                    {data.heroLogo
                      ? t('instanceDetail.export.basic.changeImage', { defaultValue: '更换图片' })
                      : t('instanceDetail.export.basic.selectImage', { defaultValue: '选择图片' })}
                  </span>
                </OreButton>
              </div>
            </div>
          </div>
        </div>

        {/* 3. 详细描述 (全宽平铺多行框) */}
        <div className="space-y-1.5 border-t-[2px] border-[#1E1E1F] pt-4">
          <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
            <Info size={15} className="mr-2 text-[#6CC349]" />
            <span>{t('instanceDetail.export.basic.description', { defaultValue: '整合包详细描述' })}</span>
          </label>
          <FocusItem onEnter={() => textareaRef.current?.focus()}>
            {({ ref: focusRef, focused }) => (
              <div
                ref={focusRef as any}
                className={`transition-none ${
                  focused ? 'ring-2 ring-white outline-none brightness-105' : ''
                }`}
              >
                <textarea
                  ref={textareaRef}
                  value={data.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-28 sm:h-32 w-full resize-none border-[2px] border-[#1E1E1F] bg-[#141517] p-3 text-xs sm:text-sm leading-relaxed text-white font-minecraft shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] focus:border-white focus:outline-none"
                  placeholder={t('instanceDetail.export.basic.descriptionPlaceholder', {
                    defaultValue: '简要介绍这个整合包的主题、玩法特色或环境定位。',
                  })}
                />
              </div>
            )}
          </FocusItem>
        </div>
      </div>
    </div>
  );
};

export default ExportBasicStep;