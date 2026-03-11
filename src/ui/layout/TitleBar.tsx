import React, { useEffect, useState } from 'react';
import { X, Minus, Square } from 'lucide-react'; 
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useLauncherStore } from '../../store/useLauncherStore';
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { Home as HomeIcon, Server, Download, Settings } from 'lucide-react';
import { useInputAction } from '../focus/InputDriver'; 
import { ControlHint } from '../components/ControlHint';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  const { activeTab, setActiveTab } = useLauncherStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const [pressingLB, setPressingLB] = useState(false);
  const [pressingRB, setPressingRB] = useState(false);

  useEffect(() => {
    // Check initial full-screen state
    appWindow.isFullscreen().then(setIsFullscreen);

    // Listen for resize events to detect full-screen toggle (F11/Tauri API)
    const unlisten = appWindow.onResized(async () => {
      const fullscreen = await appWindow.isFullscreen();
      setIsFullscreen(fullscreen);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, [appWindow]);

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
  // ✅ 全局主导航快捷翻页逻辑 (LB / RB)
  // ==========================================
  const currentIndex = navTabs.findIndex(t => t.id === activeTab);

  const handleSwitchTab = (direction: -1 | 1) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return; // Check for open modals

    // Provide visual flash feedback on the bumpers
    if (direction === -1) {
      setPressingLB(true);
      setTimeout(() => setPressingLB(false), 150);
    } else {
      setPressingRB(true);
      setTimeout(() => setPressingRB(false), 150);
    }

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
      <div 
        data-tauri-drag-region 
        className="w-full h-10 flex justify-between items-center px-4 bg-transparent select-none"
      >
        <div data-tauri-drag-region className="font-minecraft text-sm tracking-wider pointer-events-none text-white drop-shadow-md">
          PiLauncher
        </div>

        {/* 若处于全屏模式，则隐藏窗口控制按钮 (如 SteamDeck 模式下) */}
        {!isFullscreen && (
          <div className="flex space-x-2">
            <button onClick={handleMinimize} tabIndex={-1} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-white transition-colors outline-none drop-shadow-md">
              <Minus size={16}/>
            </button>
            <button onClick={handleMaximize} tabIndex={-1} className="p-1 hover:bg-white/10 active:bg-white/20 rounded text-white transition-colors outline-none drop-shadow-md">
              <Square size={14}/>
            </button>
            <button onClick={handleClose} tabIndex={-1} className="p-1 hover:bg-red-600 active:bg-red-700 rounded text-white transition-colors outline-none drop-shadow-md">
              <X size={16}/>
            </button>
          </div>
        )}
      </div>

      {/* 底部：全局分段导航与动态键位提示 */}
      <div className="w-full flex justify-center items-center pb-2 pt-1 select-none gap-4">
        
        {/* 👈 左侧按键提示区 */}
        <div 
          className={`flex items-center justify-center cursor-pointer mb-1 transition-transform duration-150 ${pressingLB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'}`}
          onClick={() => handleSwitchTab(-1)}
          onPointerDown={() => setPressingLB(true)}
          onPointerUp={() => setPressingLB(false)}
          onPointerLeave={() => setPressingLB(false)}
        >
          <ControlHint label="LB" variant="bumper" tone={pressingLB ? 'green' : 'neutral'} />
        </div>

        <OreSegmentedControl 
          tabs={navTabs} 
          activeTab={activeTab} 
          onChange={(id) => setActiveTab(id as any)}
        />

        {/* 👉 右侧按键提示区 */}
        <div 
          className={`flex items-center justify-center cursor-pointer mb-1 transition-transform duration-150 ${pressingRB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'}`}
          onClick={() => handleSwitchTab(1)}
          onPointerDown={() => setPressingRB(true)}
          onPointerUp={() => setPressingRB(false)}
          onPointerLeave={() => setPressingRB(false)}
        >
          <ControlHint label="RB" variant="bumper" tone={pressingRB ? 'green' : 'neutral'} />
        </div>

      </div>
      
    </div>
  );
};