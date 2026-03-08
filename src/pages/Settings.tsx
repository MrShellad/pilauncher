// /src/pages/Settings.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Monitor, Gamepad2, Coffee, Download, Users, Archive, Wrench } from 'lucide-react';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { GeneralSettings } from '../features/Settings/components/tabs/GeneralSettings';
import { JavaSettings } from '../features/Settings/components/tabs/JavaSettings';
import { AppearanceSettings } from '../features/Settings/components/tabs/AppearanceSettings';
import { GameSettings } from '../features/Settings/components/tabs/GameSettings';
import { DownloadSettings } from '../features/Settings/components/tabs/DownloadSettings';
import { AccountSettings } from '../features/Settings/components/tabs/AccountSettings';
import { OreToggleButton, type ToggleOption } from '../ui/primitives/OreToggleButton';
import { FocusBoundary } from '../ui/focus/FocusBoundary';

// 引入驱动钩子
import { useInputAction } from '../ui/focus/InputDriver';

const SETTINGS_TABS: ToggleOption[] = [
  { value: 'general', label: (<div className="flex items-center justify-center space-x-2"><SettingsIcon size={16} /><span className="font-minecraft tracking-wider">常规</span></div>) },
  { value: 'appearance', label: (<div className="flex items-center justify-center space-x-2"><Monitor size={16} /><span className="font-minecraft tracking-wider">界面</span></div>) },
  { value: 'game', label: (<div className="flex items-center justify-center space-x-2"><Gamepad2 size={16} /><span className="font-minecraft tracking-wider">游戏</span></div>) },
  { value: 'java', label: (<div className="flex items-center justify-center space-x-2"><Coffee size={16} /><span className="font-minecraft tracking-wider">Java</span></div>) },
  { value: 'download', label: (<div className="flex items-center justify-center space-x-2"><Download size={16} /><span className="font-minecraft tracking-wider">下载</span></div>) },
  { value: 'accounts', label: (<div className="flex items-center justify-center space-x-2"><Users size={16} /><span className="font-minecraft tracking-wider">账户</span></div>) },
  { value: 'backup', label: (<div className="flex items-center justify-center space-x-2"><Archive size={16} /><span className="font-minecraft tracking-wider">备份</span></div>) },
  { value: 'advanced', label: (<div className="flex items-center justify-center space-x-2"><Wrench size={16} /><span className="font-minecraft tracking-wider">高级</span></div>) },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  // ==========================================
  // ✅ 核心修复：监听 activeTab 变化，动画结束后回收焦点
  // ==========================================
  useEffect(() => {
    // 动画时长为 150ms，设定 200ms 确保旧页面的 DOM 已经被彻底销毁，
    // 空间导航引擎重新构建树时能精准落到新页面的第一个元素上。
    const timer = setTimeout(() => {
      setFocus('settings-page-boundary');
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab]);

  const currentIndex = SETTINGS_TABS.findIndex(t => t.value === activeTab);

  const handleSwitchTab = (direction: -1 | 1) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = SETTINGS_TABS.length - 1;
    if (nextIndex >= SETTINGS_TABS.length) nextIndex = 0;
    
    setActiveTab(SETTINGS_TABS[nextIndex].value);
  };

  useInputAction('PAGE_LEFT', () => handleSwitchTab(-1));
  useInputAction('PAGE_RIGHT', () => handleSwitchTab(1));

  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'appearance': return <AppearanceSettings />;
      case 'java': return <JavaSettings />;
      case 'game': return <GameSettings />;
      case 'download': return <DownloadSettings />;
      case 'accounts': return <AccountSettings />;
      default: return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-ore-text-muted font-minecraft border-2 border-dashed border-ore-gray-border mx-8 mt-8">
          <Wrench size={48} className="mb-4 opacity-50" />
          <span className="text-lg tracking-widest">设置模块开发中...</span>
        </div>
      );
    }
  };

  return (
    <FocusBoundary id="settings-page-boundary" className="flex flex-col w-full h-full overflow-hidden">
      
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
            transition={{ duration: 0.15 }}
            className="w-full h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

    </FocusBoundary>
  );
};

export default Settings;