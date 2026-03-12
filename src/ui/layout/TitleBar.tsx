import React, { useEffect, useState } from 'react';
import { Download, Home as HomeIcon, Minus, Server, Settings, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useLauncherStore } from '../../store/useLauncherStore';
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { useInputAction } from '../focus/InputDriver';
import { ControlHint } from '../components/ControlHint';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  const { activeTab, setActiveTab } = useLauncherStore();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pressingLB, setPressingLB] = useState(false);
  const [pressingRB, setPressingRB] = useState(false);

  useEffect(() => {
    appWindow.isFullscreen().then(setIsFullscreen);

    const unlisten = appWindow.onResized(async () => {
      const fullscreen = await appWindow.isFullscreen();
      setIsFullscreen(fullscreen);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [appWindow]);

  const handleMinimize = () => appWindow.minimize();
  const handleMaximize = () => appWindow.toggleMaximize();
  const handleClose = () => appWindow.close();

  const navTabs: TabItem[] = [
    { id: 'home', label: '首页', icon: <HomeIcon size={16} /> },
    { id: 'instances', label: '实例', icon: <Server size={16} /> },
    // { id: 'multiplayer', label: '联机', icon: <Users size={16} /> }, // 暂时隐藏
    { id: 'downloads', label: '下载', icon: <Download size={16} /> },
    { id: 'settings', label: '设置', icon: <Settings size={16} /> },
  ];

  const currentIndex = navTabs.findIndex((tab) => tab.id === activeTab);

  const handleSwitchTab = (direction: -1 | 1) => {
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
    if (document.querySelector('.fixed.inset-0')) return;

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
    <div className="z-50 flex w-full flex-col">
      <div
        data-tauri-drag-region
        className="flex h-10 w-full select-none items-center justify-between bg-transparent px-4"
      >
        <div
          data-tauri-drag-region
          className="pointer-events-none font-minecraft text-sm tracking-wider text-white drop-shadow-md"
        >
          PiLauncher
        </div>

        {!isFullscreen && (
          <div className="flex space-x-2">
            <button
              onClick={handleMinimize}
              tabIndex={-1}
              className="rounded p-1 text-white transition-colors outline-none hover:bg-white/10 active:bg-white/20"
            >
              <Minus size={16} />
            </button>
            <button
              onClick={handleMaximize}
              tabIndex={-1}
              className="rounded p-1 text-white transition-colors outline-none hover:bg-white/10 active:bg-white/20"
            >
              <Square size={14} />
            </button>
            <button
              onClick={handleClose}
              tabIndex={-1}
              className="rounded p-1 text-white transition-colors outline-none hover:bg-red-600 active:bg-red-700"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="flex w-full select-none items-center justify-center gap-4 pb-2 pt-1">
        <div
          className={`mb-1 flex cursor-pointer items-center justify-center transition-transform duration-150 ${
            pressingLB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'
          }`}
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

        <div
          className={`mb-1 flex cursor-pointer items-center justify-center transition-transform duration-150 ${
            pressingRB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'
          }`}
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
