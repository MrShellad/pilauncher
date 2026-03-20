import React from 'react';
import { Sparkles, FileArchive, ChevronRight } from 'lucide-react';
import { CurseforgeIcon, ModrinthIcon } from '../../../../Download/components/Icons';
import { OreSwitch } from '../../../../../ui/primitives/OreSwitch';
import type { ExportData } from './ExportPanel';

interface ExportOptimizationStepProps {
  data: ExportData;
  onChange: (data: Partial<ExportData>) => void;
}

export const ExportOptimizationStep: React.FC<ExportOptimizationStepProps> = ({ data, onChange }) => {
  const formats: { id: ExportData['format']; label: string; desc: string; icon: React.FC<any>; color: string }[] = [
    { id: 'zip', label: '标准 ZIP', desc: '最佳兼容性，纯文件打包', icon: FileArchive, color: 'text-[#D0D1D4]' },
    { id: 'curseforge', label: 'CurseForge', desc: '包含 manifest.json 文件', icon: CurseforgeIcon, color: 'text-[#F16436]' },
    { id: 'mrpack', label: 'Modrinth (mrpack)', desc: '支持自动解析 Modrinth ID', icon: ModrinthIcon, color: 'text-[#1BD96A]' },
  ];

  return (
    <div className="flex flex-col space-y-6">
      <div className="grid grid-cols-1 gap-4">
        {formats.map((f) => (
          <div
            key={f.id}
            onClick={() => onChange({ format: f.id })}
            className={`cursor-pointer flex items-center p-4 border-2 rounded-sm select-none
              ${data.format === f.id 
                ? 'bg-[#3C8527] border-[#18181B] shadow-[inset_0_-4px_#1D4D13,inset_3px_3px_rgba(255,255,255,0.2),inset_-3px_-7px_rgba(255,255,255,0.1)]' 
                : 'bg-[#1E1E1F] border-[#18181B] shadow-[inset_2px_2px_rgba(255,255,255,0.05)] hover:bg-[#2A2A2C]'}
            `}
          >
            <div className="mr-5 p-2 bg-black/40 rounded-sm border-2 border-[#18181B] shadow-[inset_2px_2px_rgba(255,255,255,0.1)] flex items-center justify-center w-12 h-12">
              <f.icon className={`w-7 h-7 ${data.format === f.id ? 'text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]' : f.color}`} />
            </div>
              
              <div className="flex-1 text-left flex flex-col justify-center">
              <div className={`text-base font-bold tracking-widest ${data.format === f.id ? 'text-white text-shadow' : 'text-[#D0D1D4]'}`}>
                {f.label}
              </div>
              <div className={`text-sm mt-1 ${data.format === f.id ? 'text-white' : 'text-[#B1B2B5]'}`}>
                {f.desc}
              </div>
            </div>

            {data.format === f.id && (
              <div className="ml-4 h-full flex items-center justify-center">
                <ChevronRight size={24} className="text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-5 bg-[#313233] border-2 border-[#18181B] rounded-sm flex items-center justify-between group shadow-[inset_0_4px_8px_-2px_rgba(0,0,0,0.3)]">
        <div className="flex items-center space-x-4">
          <div className="p-2 rounded-sm bg-[#1E1E1F] border-2 border-[#18181B] text-[#A855F7] shadow-[inset_2px_2px_rgba(255,255,255,0.1)]">
            <Sparkles size={24} />
          </div>
          <div className="flex flex-col">
            <div className="text-sm font-bold tracking-widest text-[#D0D1D4]">MANIFEST 模式 (依赖优化)</div>
            <div className="text-xs text-[#B1B2B5] mt-1 space-y-1">
              <p>自动将 Mod 文件转换为对应平台的下载链接引用，大幅减小整合包体积。</p>
              <p className="text-[#3C8527]">注: 平台缺失的 Mod 将自动被完整打包到包体中，避免文件丢失。</p>
            </div>
          </div>
        </div>
        
        <div className="shrink-0 flex items-center justify-center ml-4">
          <OreSwitch 
            checked={data.manifestMode} 
            onChange={(checked) => onChange({ manifestMode: checked })} 
          />
        </div>
      </div>
    </div>
  );
};
