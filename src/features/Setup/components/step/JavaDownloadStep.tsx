// src/features/Setup/components/JavaDownloadStep.tsx
import React from 'react';
import { Coffee, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';

import downloadSource from '../../../../assets/config/downloadsource.json';

const PROVIDER_OPTIONS = downloadSource.sources.java.map((source: any) => ({
  label: source.name,
  value: source.id
}));

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
  const { t } = useTranslation();

  const JAVA_OPTIONS = [
    { label: t('settings.java.versions.25', 'Java 25 (适用于较新版本)'), value: '25' },
    { label: t('settings.java.versions.21', 'Java 21 (适用于 MC 1.21+)'), value: '21' },
    { label: t('settings.java.versions.17', 'Java 17 (适用于 MC 1.18 - 1.20)'), value: '17' },
    { label: t('settings.java.versions.16', 'Java 16 (适用于 MC 1.17)'), value: '16' },
    { label: t('settings.java.versions.8', 'Java 8  (适用于 MC 1.7 - 1.16)'), value: '8' },
  ];

  return (
    <>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 blur-3xl pointer-events-none" />
      <Coffee size="3rem" className="text-blue-400 mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">{t('setup.java.title')}</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        {t('setup.java.desc1')}<br/>
        {t('setup.java.desc2')}
      </p>

      {/* ✅ 修复 2：将 z-index 提升为 20 (高于底部按钮 of 10)，解决下拉菜单被遮挡问题 */}
      <div className="w-full space-y-4 mb-6 relative z-20 text-left">
        <div>
          <label className="text-xs text-ore-text-muted mb-1 block">{t('setup.java.targetVersion')}</label>
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
          <label className="text-xs text-ore-text-muted mb-1 block">{t('setup.java.provider')}</label>
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
          {t('setup.java.skip')}
        </OreButton>
        <OreButton focusKey="setup-btn-download" onClick={onDownload} variant="primary" size="auto" className="flex-1">
          <Download size="1rem" className="mr-2" /> {t('setup.java.download')}
        </OreButton>
      </div>
    </>
  );
};