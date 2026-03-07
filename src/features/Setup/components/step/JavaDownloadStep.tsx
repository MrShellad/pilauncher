// src/features/Setup/components/JavaDownloadStep.tsx
import React from 'react';
import { Coffee, Download } from 'lucide-react';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';

const JAVA_OPTIONS = [
  { label: 'Java 21 (适用于 MC 1.21+)', value: '21' },
  { label: 'Java 17 (适用于 MC 1.18 - 1.20)', value: '17' },
  { label: 'Java 16 (适用于 MC 1.17)', value: '16' },
  { label: 'Java 8  (适用于 MC 1.7 - 1.16)', value: '8' },
];

const PROVIDER_OPTIONS = [
  { label: 'Adoptium 官方直连 (推荐)', value: 'adoptium' },
  { label: 'Azul Zulu (备选官方源)', value: 'zulu' }, 
];

interface JavaDownloadStepProps {
  javaVersion: string;
  setJavaVersion: (val: string) => void;
  javaProvider: string;
  setJavaProvider: (val: string) => void;
  onSkip: () => void;
  onDownload: () => void;
}

export const JavaDownloadStep: React.FC<JavaDownloadStepProps> = ({ 
  javaVersion, setJavaVersion, javaProvider, setJavaProvider, onSkip, onDownload 
}) => {
  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 blur-3xl pointer-events-none" />
      <Coffee size={48} className="text-blue-400 mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">未检测到 Java 环境</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        我们发现您的电脑中似乎没有安装 Java。<br/>
        请选择您想玩的 Minecraft 版本，我们将为您自动下载并配置对应的运行时。
      </p>

      {/* ✅ 修复 2：将 z-index 提升为 20 (高于底部按钮的 10)，解决下拉菜单被遮挡问题 */}
      <div className="w-full space-y-4 mb-6 relative z-20 text-left">
        <div>
          <label className="text-xs text-ore-text-muted mb-1 block">目标 Minecraft 版本：</label>
          {/* ✅ 修复 1：去除多余的 FocusItem 包裹，直接把 focusKey 传给内置焦点的 OreDropdown */}
          <OreDropdown 
            focusKey="setup-dropdown-version" 
            options={JAVA_OPTIONS} 
            value={javaVersion} 
            onChange={setJavaVersion} 
            className="w-full"
          />
        </div>
        
        <div>
          <label className="text-xs text-ore-text-muted mb-1 block">下载源 (Provider)：</label>
          {/* ✅ 同上 */}
          <OreDropdown 
            focusKey="setup-dropdown-provider" 
            options={PROVIDER_OPTIONS} 
            value={javaProvider} 
            onChange={setJavaProvider} 
            className="w-full"
          />
        </div>
      </div>

      <div className="flex w-full space-x-3 relative z-10">
        <OreButton focusKey="setup-btn-skip" onClick={onSkip} variant="ghost" size="auto" className="flex-1">
          跳过，稍后手动安装
        </OreButton>
        <OreButton focusKey="setup-btn-download" onClick={onDownload} variant="primary" size="auto" className="flex-1 bg-blue-600 hover:bg-blue-500 !border-blue-700">
          <Download size={16} className="mr-2" /> 自动下载
        </OreButton>
      </div>
    </>
  );
};