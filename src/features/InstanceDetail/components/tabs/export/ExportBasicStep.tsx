import React, { useRef, useState } from 'react';
import { Image as ImageIcon, Info, Tag, Type, Upload, User } from 'lucide-react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

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
      addToast('error', '打开图片选择器失败，请检查系统权限');
    } finally {
      setIsSelectingLogo(false);
    }
  };

  return (
    <div className="flex flex-col space-y-5">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="flex flex-col space-y-4">
          <div className="flex flex-col space-y-2">
            <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
              <Type size={14} className="mr-2 text-[#B1B2B5]" />
              整合包名称
            </label>
            <OreInput
              value={data.name}
              onChange={(event) => onChange({ name: event.target.value })}
              placeholder="例如：我的冒险整合包"
              className="w-full border-[#18181B] bg-[#1E1E1F]"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
              <Tag size={14} className="mr-2 text-[#B1B2B5]" />
              版本号
            </label>
            <OreInput
              value={data.version}
              onChange={(event) => onChange({ version: event.target.value })}
              placeholder="例如：1.0.0"
              className="w-full border-[#18181B] bg-[#1E1E1F]"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
              <User size={14} className="mr-2 text-[#B1B2B5]" />
              作者
            </label>
            <OreInput
              value={data.author}
              onChange={(event) => onChange({ author: event.target.value })}
              placeholder="填写作者名称"
              className="w-full border-[#18181B] bg-[#1E1E1F]"
            />
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
            <ImageIcon size={14} className="mr-2 text-[#B1B2B5]" />
            Hero Logo
          </label>
          <div className="flex flex-col space-y-4">
            <div className="relative flex h-36 w-full items-center justify-center overflow-hidden rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] shadow-[inset_2px_2px_rgba(255,255,255,0.05)]">
              {data.heroLogo ? (
                <img src={data.heroLogo} alt="Hero Logo" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center space-y-2 text-[#B1B2B5] opacity-50">
                  <ImageIcon size={28} />
                  <span className="text-xs">无 Logo 图片</span>
                </div>
              )}
            </div>
            <OreButton
              variant="secondary"
              size="sm"
              onClick={handleSelectHeroLogo}
              disabled={isSelectingLogo}
              className="w-full"
            >
              <Upload size={14} className="mr-2" />
              {data.heroLogo ? '更换图片' : '选择图片'}
            </OreButton>
          </div>
        </div>

        <div className="flex flex-col space-y-2 md:col-span-2">
          <label className="flex items-center text-sm font-bold text-[#D0D1D4]">
            <Info size={14} className="mr-2 text-[#B1B2B5]" />
            描述
          </label>
          <FocusItem
            onEnter={() => textareaRef.current?.focus()}
          >
            {({ ref: focusRef, focused }) => (
              <div
                ref={focusRef as any}
                className={`transition-all rounded-sm w-full ${focused ? 'ring-2 ring-white scale-[1.01] z-20 shadow-lg brightness-110' : ''}`}
              >
                <textarea
                  ref={textareaRef}
                  value={data.description}
                  onChange={(event) => onChange({ description: event.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="h-24 w-full resize-none rounded-sm border-2 border-[#18181B] bg-[#1E1E1F] p-3 text-sm text-white shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-all focus:border-white focus:outline-none font-minecraft"
                  placeholder="简要介绍这个整合包的主题、玩法或定位。"
                />
              </div>
            )}
          </FocusItem>
        </div>
      </div>
    </div>
  );
};
