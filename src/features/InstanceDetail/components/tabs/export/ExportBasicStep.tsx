import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Info, Tag, Type, Upload, User, X } from 'lucide-react';
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
    <div className="w-full max-w-4xl xl:max-w-5xl mx-auto flex flex-col space-y-3 font-minecraft select-none">
      {/* =========================================================================
          1. 上层：Hero Logo 宽幅视觉展台 (Top Layer - 满宽居中紧凑)
          ========================================================================= */}
      <div className="w-full border-[2px] border-b-[4px] border-[#1E1E1F] bg-[#3B3C3D] p-3.5 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            <ImageIcon size={15} className="mr-1.5 text-[#6CC349]" />
            <span>{t('instanceDetail.export.basic.heroLogo', { defaultValue: '整合包 Hero Logo' })}</span>
          </label>
          <span className="text-[11px] text-[#8C8D90]">横向宽幅 • 建议 3.5:1 ~ 4:1</span>
        </div>

        {/* 宽幅横向展示视口 (内嵌 hover/focus 浮层操作按钮) */}
        <div
          className="relative flex w-full h-20 sm:h-24 md:h-28 items-center justify-center overflow-hidden border-[2px] border-[#1E1E1F] bg-[#141517] shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] group select-none"
        >
          {data.heroLogo ? (
            <img
              src={data.heroLogo}
              alt="Hero Logo"
              className="h-full w-full object-contain p-2 transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="flex items-center justify-center gap-2 text-[#8C8D90] p-3 text-center">
              <ImageIcon size={22} className="opacity-40 shrink-0" />
              <span className="text-xs font-bold">未设置 Hero Logo（悬停或聚焦以上传）</span>
            </div>
          )}

          {/* 浮动操作层：仅在 hover 或 focus-within 时显示 */}
          <div className="absolute inset-0 flex items-center justify-center gap-3 bg-black/65 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 p-2">
            <OreButton
              variant="primary"
              size="sm"
              focusKey="export-basic-btn-select-logo"
              onClick={handleSelectHeroLogo}
              disabled={isSelectingLogo}
              className="!h-8 !px-3.5 font-minecraft text-xs font-bold text-white shadow-md"
            >
              <Upload size={13} className="mr-1.5 shrink-0" />
              <span>
                {data.heroLogo
                  ? t('instanceDetail.export.basic.changeImage', { defaultValue: '更换图片' })
                  : t('instanceDetail.export.basic.selectImage', { defaultValue: '选择图片' })}
              </span>
            </OreButton>

            {data.heroLogo && (
              <OreButton
                variant="danger"
                size="sm"
                focusKey="export-basic-btn-clear-logo"
                onClick={() => onChange({ heroLogo: undefined })}
                className="!h-8 !px-3 font-minecraft text-xs font-bold text-white shadow-md"
              >
                <X size={13} className="mr-1 shrink-0" />
                <span>清除</span>
              </OreButton>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          2. 下层：整合包详细信息表单 (Bottom Layer - 满宽居中紧凑)
          ========================================================================= */}
      <div className="w-full border-[2px] border-b-[4px] border-[#1E1E1F] bg-[#3B3C3D] p-3.5 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] space-y-3">
        {/* 整合包名称 */}
        <div className="space-y-1">
          <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-white">
            <Type size={14} className="mr-1.5 text-[#6CC349]" />
            <span>{t('instanceDetail.export.basic.packName', { defaultValue: '整合包名称' })}</span>
            <span className="ml-1 text-[#FF9E9E]">*</span>
          </label>
          <OreInput
            focusKey="export-basic-input-name"
            value={data.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder={t('instanceDetail.export.basic.packNamePlaceholder', {
              defaultValue: '例如：我的冒险整合包',
            })}
            className="w-full text-xs sm:text-sm font-bold"
          />
        </div>

        {/* 版本号与作者 (双列并排) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
              <Tag size={13} className="mr-1.5 text-[#6CC349]" />
              <span>{t('instanceDetail.export.basic.version', { defaultValue: '版本号' })}</span>
              <span className="ml-1 text-[#FF9E9E]">*</span>
            </label>
            <OreInput
              focusKey="export-basic-input-version"
              value={data.version}
              onChange={(event) => onChange({ version: event.target.value })}
              placeholder={t('instanceDetail.export.basic.versionPlaceholder', {
                defaultValue: '例如：1.0.0',
              })}
              className="w-full text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
              <User size={13} className="mr-1.5 text-[#6CC349]" />
              <span>{t('instanceDetail.export.basic.author', { defaultValue: '作者' })}</span>
            </label>
            <OreInput
              focusKey="export-basic-input-author"
              value={data.author}
              onChange={(event) => onChange({ author: event.target.value })}
              placeholder={t('instanceDetail.export.basic.authorPlaceholder', {
                defaultValue: '填写作者名称',
              })}
              className="w-full text-xs"
            />
          </div>
        </div>

        {/* 详细描述 */}
        <div className="space-y-1">
          <label className="flex items-center text-xs sm:text-sm font-bold uppercase tracking-wider text-[#D0D1D4]">
            <Info size={13} className="mr-1.5 text-[#6CC349]" />
            <span>{t('instanceDetail.export.basic.description', { defaultValue: '详细描述' })}</span>
          </label>
          <FocusItem focusKey="export-basic-input-desc" onEnter={() => textareaRef.current?.focus()}>
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
                  className="h-16 sm:h-20 w-full resize-none border-[2px] border-[#1E1E1F] bg-[#141517] p-2.5 text-xs leading-relaxed text-white font-minecraft shadow-[inset_0_2px_6px_rgba(0,0,0,0.6)] focus:border-white focus:outline-none"
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