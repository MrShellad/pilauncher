// /src/ui/layout/TitleBar.tsx
import React from 'react';
import { X, Minus, Square } from 'lucide-react'; 
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useLauncherStore } from '../../store/useLauncherStore';
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { Home as HomeIcon, Server, Download, Settings } from 'lucide-react';
import { useInputAction } from '../focus/InputDriver'; 

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  const { activeTab, setActiveTab } = useLauncherStore();

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const navTabs: TabItem[] = [
    { id: 'home', label: '首页', icon: <HomeIcon size={16} /> },
    { id: 'instances', label: '实例管理', icon: <Server size={16} /> },
    { id: 'downloads', label: '资源下载', icon: <Download size={16} /> },
    { id: 'settings', label: '设置', icon: <Settings size={16} /> },
  ];

  // ==========================================
  // ✅ 全局主导航快捷翻页逻辑 ([ / ] 或 LB / RB)
  // ==========================================
  const currentIndex = navTabs.findIndex(t => t.id === activeTab);

  const handleSwitchTab = (direction: -1 | 1) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) nextIndex = navTabs.length - 1;
    if (nextIndex >= navTabs.length) nextIndex = 0;
    
    setActiveTab(navTabs[nextIndex].id as any);
  };

  useInputAction('TAB_LEFT', () => handleSwitchTab(-1));
  useInputAction('TAB_RIGHT', () => handleSwitchTab(1));

  return (
    <div className="w-full flex flex-col z-50">
      
      {/* 顶部：拖拽区与窗口控制 */}
      <div data-tauri-drag-region className="w-full h-10 flex justify-between items-center px-4 bg-transparent select-none">
        <div data-tauri-drag-region className="text-ore-text font-minecraft text-sm tracking-wider pointer-events-none">
          PiLauncher
        </div>

        <div className="flex space-x-2">
          <button onClick={handleMinimize} tabIndex={-1} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-ore-text transition-colors outline-none">
            <Minus size={16}/>
          </button>
          
          <button onClick={handleMaximize} tabIndex={-1} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-ore-text transition-colors outline-none">
            <Square size={14}/>
          </button>

          <button onClick={handleClose} tabIndex={-1} className="p-1 hover:bg-red-600 active:bg-red-700 rounded text-ore-text transition-colors outline-none">
            <X size={16}/>
          </button>
        </div>
      </div>

      {/* 底部：全局分段导航与动态键位提示 */}
      <div className="w-full flex justify-center items-center pb-2 pt-1 select-none gap-4">
        
        {/* 👈 左侧按键提示区 */}
        <div className="flex items-center justify-center pointer-events-none">
          {/* 手柄模式隐现 LB */}
          <span className="hidden intent-gamepad:flex px-2.5 py-0.5 bg-[#141415] border border-[#2A2A2C] border-b-[3px] rounded-md text-xs font-minecraft font-bold text-gray-300 shadow-sm transition-transform active:scale-95">LB</span>
          {/* 键鼠模式隐现 [ */}
          <span className="flex intent-gamepad:hidden px-2.5 py-0.5 bg-[#141415] border border-[#2A2A2C] border-b-[3px] rounded-md text-xs font-minecraft font-bold text-gray-300 shadow-sm transition-transform active:scale-95">[</span>
        </div>

        <OreSegmentedControl 
          tabs={navTabs} 
          activeTab={activeTab} 
          onChange={(id) => setActiveTab(id as any)}
        />

        {/* 👉 右侧按键提示区 */}
        <div className="flex items-center justify-center pointer-events-none">
          {/* 手柄模式隐现 RB */}
          <span className="hidden intent-gamepad:flex px-2.5 py-0.5 bg-[#141415] border border-[#2A2A2C] border-b-[3px] rounded-md text-xs font-minecraft font-bold text-gray-300 shadow-sm transition-transform active:scale-95">RB</span>
          {/* 键鼠模式隐现 ] */}
          <span className="flex intent-gamepad:hidden px-2.5 py-0.5 bg-[#141415] border border-[#2A2A2C] border-b-[3px] rounded-md text-xs font-minecraft font-bold text-gray-300 shadow-sm transition-transform active:scale-95">]</span>
        </div>

      </div>
      
    </div>
  );
};