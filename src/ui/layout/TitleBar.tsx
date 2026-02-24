// /src/ui/layout/TitleBar.tsx
import React from 'react';
import { X, Minus, Square } from 'lucide-react'; 
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useLauncherStore } from '../../store/useLauncherStore';
// 注意这里：使用 type 关键字导入 TabItem 修复 verbatimModuleSyntax 报错
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { Home as HomeIcon, Server, Download, Settings } from 'lucide-react';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  // 从全局 Store 获取状态和切换方法
  const { activeTab, setActiveTab } = useLauncherStore();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  // 定义全局导航数据
  const navTabs: TabItem[] = [
    { id: 'home', label: '首页', icon: <HomeIcon size={16} /> },
    { id: 'instances', label: '实例管理', icon: <Server size={16} /> },
    { id: 'downloads', label: '资源下载', icon: <Download size={16} /> },
    { id: 'settings', label: '设置', icon: <Settings size={16} /> },
  ];

  return (
    <div className="w-full flex flex-col z-50">
      {/* 顶部：拖拽区与窗口控制 */}
      <div 
        data-tauri-drag-region 
        className="w-full h-10 flex justify-between items-center px-4 bg-transparent select-none"
      >
        <div 
          data-tauri-drag-region 
          className="text-ore-text font-minecraft text-sm tracking-wider pointer-events-none"
        >
          MINECRAFT LAUNCHER
        </div>

        <div className="flex space-x-2">
          <button onClick={handleMinimize} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-ore-text transition-colors">
            <Minus size={16}/>
          </button>
          <button onClick={handleMaximize} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-ore-text transition-colors">
            <Square size={14}/>
          </button>
          <button onClick={handleClose} className="p-1 hover:bg-red-600 active:bg-red-700 rounded text-ore-text transition-colors">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* 底部：全局分段导航 */}
      {/* 这一层不需要 data-tauri-drag-region，防止误触拖动 */}
      <div className="w-full flex justify-center pb-2 pt-1 select-none">
        <OreSegmentedControl 
          tabs={navTabs} 
          activeTab={activeTab} 
          onChange={setActiveTab} 
        />
      </div>
    </div>
  );
};