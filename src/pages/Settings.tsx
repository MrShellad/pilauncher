// /src/pages/Settings.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Monitor, Gamepad2, Coffee, Download, Users, Archive, Wrench, Info } from 'lucide-react';
import { doesFocusableExist } from '@noriginmedia/norigin-spatial-navigation';

import { lazy, Suspense } from 'react';
import { INITIAL_DOWNLOAD_FOCUS_KEY } from '../features/Settings/components/tabs/download/downloadSettings.constants';

const GeneralSettings    = lazy(() => import('../features/Settings/components/tabs/GeneralSettings').then(m => ({ default: m.GeneralSettings })));
const JavaSettings       = lazy(() => import('../features/Settings/components/tabs/JavaSettings').then(m => ({ default: m.JavaSettings })));
const AppearanceSettings = lazy(() => import('../features/Settings/components/tabs/AppearanceSettings').then(m => ({ default: m.AppearanceSettings })));
const GameSettings       = lazy(() => import('../features/Settings/components/tabs/GameSettings').then(m => ({ default: m.GameSettings })));
const DownloadSettings   = lazy(() => import('../features/Settings/components/tabs/DownloadSettings').then(m => ({ default: m.DownloadSettings })));
const AccountSettings    = lazy(() => import('../features/Settings/components/tabs/AccountSettings').then(m => ({ default: m.AccountSettings })));
const AboutSettings      = lazy(() => import('../features/Settings/components/tabs/AboutSettings').then(m => ({ default: m.AboutSettings })));

import { OreToggleButton, type ToggleOption } from '../ui/primitives/OreToggleButton';
import { FocusBoundary } from '../ui/focus/FocusBoundary';
import { focusManager } from '../ui/focus/FocusManager';
import { useInputAction } from '../ui/focus/InputDriver';

const SETTINGS_TABS: ToggleOption[] = [
  { value: 'general', label: (<div className="flex items-center justify-center space-x-2"><SettingsIcon size={16} /><span className="font-minecraft tracking-wider">常规</span></div>) },
  { value: 'appearance', label: (<div className="flex items-center justify-center space-x-2"><Monitor size={16} /><span className="font-minecraft tracking-wider">界面</span></div>) },
  { value: 'game', label: (<div className="flex items-center justify-center space-x-2"><Gamepad2 size={16} /><span className="font-minecraft tracking-wider">游戏</span></div>) },
  { value: 'java', label: (<div className="flex items-center justify-center space-x-2"><Coffee size={16} /><span className="font-minecraft tracking-wider">Java</span></div>) },
  { value: 'download', label: (<div className="flex items-center justify-center space-x-2"><Download size={16} /><span className="font-minecraft tracking-wider">下载</span></div>) },
  { value: 'account', label: (<div className="flex items-center justify-center space-x-2"><Users size={16} /><span className="font-minecraft tracking-wider">账户</span></div>) },
  { value: 'data', label: (<div className="flex items-center justify-center space-x-2"><Archive size={16} /><span className="font-minecraft tracking-wider">数据</span></div>) },
  { value: 'about', label: (<div className="flex items-center justify-center space-x-2"><Info size={16} /><span className="font-minecraft tracking-wider">关于</span></div>) },
];

export const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('general');
  const activeBoundaryId = useMemo(() => `settings-page-boundary:${activeTab}`, [activeTab]);

  const tabFallbackFocusKeys = useMemo<Record<string, string | undefined>>(() => ({
    general: 'settings-device-name',
    appearance: 'color-preset-0',
    game: 'settings-game-window-title',
    java: 'settings-java-autodetect',
    download: INITIAL_DOWNLOAD_FOCUS_KEY,
    account: 'btn-add-ms',
    data: undefined,
    about: 'settings-about-github'
  }), []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const targetKey = tabFallbackFocusKeys[activeTab];

      if (targetKey && doesFocusableExist(targetKey)) {
        focusManager.focus(targetKey);
        return;
      }

      focusManager.restoreFocus(activeBoundaryId, targetKey);
    }, 320);

    return () => clearTimeout(timer);
  }, [activeTab, activeBoundaryId, tabFallbackFocusKeys]);

  const isTextEntryActive = useCallback(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
  }, []);

  useInputAction('PAGE_LEFT', () => {
    if (isTextEntryActive()) return;
    const currentIndex = SETTINGS_TABS.findIndex(t => t.value === activeTab);
    const prevIndex = (currentIndex - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    setActiveTab(SETTINGS_TABS[prevIndex].value);
  });

  useInputAction('PAGE_RIGHT', () => {
    if (isTextEntryActive()) return;
    const currentIndex = SETTINGS_TABS.findIndex(t => t.value === activeTab);
    const nextIndex = (currentIndex + 1) % SETTINGS_TABS.length;
    setActiveTab(SETTINGS_TABS[nextIndex].value);
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'java': return <JavaSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'game': return <GameSettings />;
      case 'download': return <DownloadSettings />;
      case 'account': return <AccountSettings />;
      case 'about': return <AboutSettings />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ore-text-muted font-minecraft border-2 border-dashed border-ore-gray-border mx-8 mt-8">
          <Wrench size={48} className="mb-4 opacity-50" />
          <span className="text-lg tracking-widest">设置模块开发中...</span>
        </div>
      );
    }
  };

  return (
    <FocusBoundary
      id={activeBoundaryId}
      trapFocus={true}
      defaultFocusKey={tabFallbackFocusKeys[activeTab]}
      className="flex flex-col w-full h-full overflow-hidden"
    >
      <div className="flex-shrink-0 pt-6 px-6 md:px-8 z-10">
        <div className="max-w-5xl mx-auto w-full">
          <div className="w-full overflow-x-auto custom-scrollbar pb-2">
            <OreToggleButton
              options={SETTINGS_TABS}
              value={activeTab}
              onChange={setActiveTab}
              size="lg"
              focusable={false}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 w-full overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="absolute inset-0"
          >
            <Suspense fallback={<div className="absolute inset-0" />}>
              {renderContent()}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </FocusBoundary>
  );
};

export default Settings;
