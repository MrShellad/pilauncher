// /src/pages/Settings.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Monitor, Gamepad2, Coffee, Download, Users, Archive, Wrench } from 'lucide-react';

// 引入选项卡组件
import { GeneralSettings } from '../features/Settings/components/tabs/GeneralSettings';
import { JavaSettings } from '../features/Settings/components/tabs/JavaSettings';
import { AppearanceSettings } from '../features/Settings/components/tabs/AppearanceSettings';
import { GameSettings } from '../features/Settings/components/tabs/GameSettings';
import { DownloadSettings } from '../features/Settings/components/tabs/DownloadSettings';
import { AccountSettings } from '../features/Settings/components/tabs/AccountSettings';
// 引入新的顶部 Toggle 按钮
import { OreToggleButton, type ToggleOption } from '../ui/primitives/OreToggleButton';

// 将原有的菜单配置转化为 ToggleOption 格式
const SETTINGS_TABS: ToggleOption[] = [
  { 
    value: 'general', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <SettingsIcon size={16} />
        <span className="font-minecraft tracking-wider">常规</span>
      </div>
    ) 
  },
  { 
    value: 'appearance', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Monitor size={16} />
        <span className="font-minecraft tracking-wider">界面</span>
      </div>
    ) 
  },
  { 
    value: 'game', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Gamepad2 size={16} />
        <span className="font-minecraft tracking-wider">游戏</span>
      </div>
    ) 
  },
  { 
    value: 'java', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Coffee size={16} />
        <span className="font-minecraft tracking-wider">Java</span>
      </div>
    ) 
  },
  { 
    value: 'download', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Download size={16} />
        <span className="font-minecraft tracking-wider">下载</span>
      </div>
    ) 
  },
  { 
    value: 'accounts', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Users size={16} />
        <span className="font-minecraft tracking-wider">账户</span>
      </div>
    ) 
  },
  { 
    value: 'backup', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Archive size={16} />
        <span className="font-minecraft tracking-wider">备份</span>
      </div>
    ) 
  },
  { 
    value: 'advanced', 
    label: (
      <div className="flex items-center space-x-2 px-2 py-1">
        <Wrench size={16} />
        <span className="font-minecraft tracking-wider">高级</span>
      </div>
    ) 
  },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  // 路由渲染函数
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
    <div className="flex flex-col w-full h-full bg-[#1E1E1F] overflow-hidden">
      
      {/* ================= 顶部：导航栏 ================= */}
      {/* ✅ 去除了 bg-[#141415], border-b-2 和 shadow-sm，使其完全融入背景 */}
      {/* ✅ 将 pt-8 改为 pt-6，进一步缩减无标题后的顶部留白 */}
      <div className="flex-shrink-0 pt-6 px-6 md:px-8 z-10">
        <div className="max-w-5xl mx-auto w-full">
          
          {/* 核心控件：支持横向滑动的 Toggle 组 */}
          <div className="w-full overflow-x-auto no-scrollbar pb-2">
            <OreToggleButton 
              options={SETTINGS_TABS}
              value={activeTab}
              onChange={setActiveTab}
            />
          </div>

        </div>
      </div>

      {/* ================= 底部：设置内容区 ================= */}
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

    </div>
  );
};

export default Settings;