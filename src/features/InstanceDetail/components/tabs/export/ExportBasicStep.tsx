// src/features/InstanceDetail/components/tabs/export/ExportBasicStep.tsx
import React, { useState } from 'react';
import { User, Tag, Info, Type, Image as ImageIcon, Upload } from 'lucide-react';
import { OreInput } from '../../../../../ui/primitives/OreInput';
import { OreButton } from '../../../../../ui/primitives/OreButton';
import type { ExportData } from './ExportPanel';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

interface ExportBasicStepProps {
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportBasicStep: React.FC<ExportBasicStepProps> = ({ data, onChange }) => {
  const [isSelectingLogo, setIsSelectingLogo] = useState(false);

  const handleSelectHeroLogo = async () => {
    setIsSelectingLogo(true);
    try {
      const selectedPath = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
        }]
      });

      if (selectedPath && typeof selectedPath === 'string') {
        const url = convertFileSrc(selectedPath);
        onChange({ heroLogo: url });
      }
    } catch (e) {
      console.error("Failed to open dialog", e);
    }
    setIsSelectingLogo(false);
  };

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex items-center space-x-3 border-b-2 border-[#18181B] pb-3">
        <span className="w-1.5 h-4 bg-[#3C8527] shadow-[0_0_8px_rgba(56,133,39,0.4)]" />
        <div>
          <h3 className="text-lg font-bold tracking-widest text-white">基本信息</h3>
          <p className="text-xs text-[#B1B2B5] tracking-wider">配置展示在启动器中的源信息</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col space-y-2">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <Type size={14} className="mr-2 text-[#B1B2B5]" />
            整合包名称
          </label>
          <OreInput 
            value={data.name} 
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="例如: 我的大冒险"
            className="w-full bg-[#1E1E1F] border-[#18181B]"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <Tag size={14} className="mr-2 text-[#B1B2B5]" />
            版本号
          </label>
          <OreInput 
            value={data.version} 
            onChange={(e) => onChange({ version: e.target.value })}
            placeholder="例如: 1.0.0"
            className="w-full bg-[#1E1E1F] border-[#18181B]"
          />
        </div>

        <div className="flex flex-col space-y-2">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <User size={14} className="mr-2 text-[#B1B2B5]" />
            作者
          </label>
          <OreInput 
            value={data.author} 
            onChange={(e) => onChange({ author: e.target.value })}
            placeholder="您的名称"
            className="w-full bg-[#1E1E1F] border-[#18181B]"
          />
        </div>

        <div className="flex flex-col space-y-2 md:col-span-1">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <ImageIcon size={14} className="mr-2 text-[#B1B2B5]" />
            Hero Logo
          </label>
          <div className="flex items-center space-x-4">
            <div className="w-24 h-12 bg-[#1E1E1F] border-2 border-[#18181B] rounded-sm flex items-center justify-center overflow-hidden relative shadow-[inset_2px_2px_rgba(255,255,255,0.05)]">
              {data.heroLogo ? (
                <img src={data.heroLogo} alt="Hero Logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon size={20} className="text-[#B1B2B5] opacity-50" />
              )}
            </div>
            <OreButton variant="secondary" onClick={handleSelectHeroLogo} disabled={isSelectingLogo} size="sm">
              <Upload size={14} className="mr-2" /> {data.heroLogo ? '更改' : '选择图片'}
            </OreButton>
          </div>
        </div>

        <div className="flex flex-col space-y-2 md:col-span-2">
          <label className="text-sm text-[#D0D1D4] font-bold flex items-center">
            <Info size={14} className="mr-2 text-[#B1B2B5]" />
            描述
          </label>
          <textarea 
            value={data.description} 
            onChange={(e) => onChange({ description: e.target.value })}
            className="w-full bg-[#1E1E1F] border-2 border-[#18181B] p-3 text-sm focus:outline-none focus:border-[#D0D1D4] transition-all rounded-sm shadow-[inset_2px_2px_rgba(255,255,255,0.05),inset_-2px_-2px_rgba(0,0,0,0.2)] h-24 resize-none text-white font-minecraft"
            placeholder="简要介绍这个整合包的特色..."
          />
        </div>
      </div>
    </div>
  );
};
