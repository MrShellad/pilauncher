// /src/pages/Settings.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings as SettingsIcon, Monitor, Gamepad2, Coffee, Download, Users, Archive, Wrench } from 'lucide-react';

// 引入选项卡组件
import { GeneralSettings } from '../features/Settings/components/tabs/GeneralSettings';
import { JavaSettings } from '../features/Settings/components/tabs/JavaSettings';

// 菜单配置
const MENU_ITEMS = [
  { id: 'general', label: '常规', icon: <SettingsIcon size={18} /> },
  { id: 'appearance', label: '界面', icon: <Monitor size={18} /> },
  { id: 'game', label: '游戏', icon: <Gamepad2 size={18} /> },
  { id: 'java', label: 'Java', icon: <Coffee size={18} /> },
  { id: 'download', label: '下载', icon: <Download size={18} /> },
  { id: 'accounts', label: '账户', icon: <Users size={18} /> },
  { id: 'backup', label: '备份', icon: <Archive size={18} /> },
  { id: 'advanced', label: '高级', icon: <Wrench size={18} /> },
];

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');

  // 路由渲染函数
  const renderContent = () => {
    switch (activeTab) {
      case 'general': return <GeneralSettings />;
      case 'java': return <JavaSettings />;
      // 开发中占位
      default: return (
        <div className="flex flex-col items-center justify-center h-64 text-ore-text-muted font-minecraft border-2 border-dashed border-ore-gray-border">
          <Wrench size={48} className="mb-4 opacity-50" />
          <span className="text-lg tracking-widest">设置模块开发中...</span>
        </div>
      );
    }
  };

  return (
    <div className="flex w-full h-full max-w-7xl mx-auto pt-6 px-6 pb-0 overflow-hidden">
      
      {/* ================= 左侧：导航栏 ================= */}
      <div className="w-56 shrink-0 flex flex-col pr-6 border-r-2 border-ore-gray-border/50 h-full overflow-y-auto no-scrollbar">
        <h1 className="text-3xl font-minecraft font-bold text-white ore-text-shadow mb-6 pl-2">设置</h1>
        
        <div className="space-y-1">
          {MENU_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`
                  w-full flex items-center p-3 font-minecraft text-sm transition-all relative overflow-hidden group focus:outline-none
                  ${isActive ? 'text-white' : 'text-ore-text-muted hover:text-white'}
                `}
              >
                {/* 选中时的左侧绿色边框光标 */}
                {isActive && (
                  <motion.div 
                    layoutId="settings-active-indicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-ore-green"
                  />
                )}
                {/* 选中时的背景高亮 */}
                {isActive && (
                  <div className="absolute inset-0 bg-ore-green/10 pointer-events-none" />
                )}
                
                {/* 悬浮背景 (非选中态) */}
                {!isActive && (
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors pointer-events-none" />
                )}

                <span className={`ml-4 mr-3 transition-transform ${isActive ? 'scale-110 text-ore-green' : ''}`}>
                  {item.icon}
                </span>
                <span className="tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ================= 右侧：设置内容区 ================= */}
      <div className="flex-1 pl-8 h-full overflow-y-auto no-scrollbar relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-3xl"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

    </div>
  );
};

export default Settings;