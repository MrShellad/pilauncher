// src/features/Setup/components/DirectoryStep.tsx
import React from 'react';
import { ShieldCheck, FolderOpen } from 'lucide-react';
import { useTranslation, Trans } from 'react-i18next';
import { FocusItem } from '../../../../ui/focus/FocusItem';
import { OreButton } from '../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../ui/primitives/OreDropdown';
import { useSettingsStore } from '../../../../store/useSettingsStore';

interface DirectoryStepProps {
  basePath: string;
  setBasePath: (path: string) => void;
  onBrowse: () => void;
  onConfirm: () => void;
}

export const DirectoryStep: React.FC<DirectoryStepProps> = ({ basePath, setBasePath, onBrowse, onConfirm }) => {
  const { t } = useTranslation();
  const { settings, updateGeneralSetting } = useSettingsStore();
  const { general } = settings;

  const languageOptions = [
    { label: '简体中文', value: 'zh-CN' },
    { label: 'English', value: 'en-US' },
  ];

  return (
    <>
      {/* 语言选择器，绝对定位在向导容器的右上角 */}
      <div className="absolute top-4 right-4 z-30 w-32">
        <OreDropdown
          focusKey="setup-lang-select"
          options={languageOptions}
          value={general.language}
          onChange={(value) => updateGeneralSetting('language', value)}
          className="w-full text-xs"
        />
      </div>

      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-ore-green/20 blur-3xl pointer-events-none" />
      <ShieldCheck size="3rem" className="text-ore-green mb-4 relative z-10" />
      <h2 className="text-2xl text-white mb-2 relative z-10">{t('setup.directory.title')}</h2>
      <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
        {t('setup.directory.desc1')}<br/>
        <Trans i18nKey="setup.directory.desc2">
          可以是一个<span className="text-white font-bold">全新空目录</span>，也可选择<span className="text-white font-bold">已有的 PiLauncher 旧目录</span>以恢复数据。
        </Trans><br/>
        <span className="text-red-400 font-bold">{t('setup.directory.desc3')}</span>
      </p>

      <div className="flex w-full space-x-2 mb-6 relative z-10">
        <FocusItem focusKey="setup-input-path">
          {({ ref, focused }) => (
            <input 
              ref={ref as any}
              type="text" 
              value={basePath}
              onChange={(e) => setBasePath(e.target.value)}
              placeholder={t('setup.directory.placeholder')}
              className={`flex-1 bg-[#141415] border ${focused ? 'border-ore-green ring-1 ring-ore-green' : 'border-ore-gray-border'} text-white px-3 py-2 outline-none transition-colors`}
            />
          )}
        </FocusItem>

        <OreButton focusKey="setup-btn-browse" onClick={onBrowse} variant="secondary" size="auto">
          <FolderOpen size="1rem" className="mr-2" /> {t('setup.directory.browse')}
        </OreButton>
      </div>

      <OreButton focusKey="setup-btn-confirm" onClick={onConfirm} variant="primary" size="full" className="relative z-10">
        {t('setup.directory.confirm')}
      </OreButton>
    </>
  );
};