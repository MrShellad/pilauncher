import React, { useEffect, useState } from 'react';
import { Download, Home as HomeIcon, Minus, Server, Settings, Square, X, Users } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { invoke } from '@tauri-apps/api/core';
import { useLauncherStore } from '../../store/useLauncherStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { useInputAction } from '../focus/InputDriver';
import { ControlHint } from '../components/ControlHint';
import { OreConfirmDialog } from '../primitives/OreConfirmDialog';

export const TitleBar: React.FC = () => {
  const appWindow = getCurrentWindow();
  const { activeTab, setActiveTab } = useLauncherStore();
  const closeBehavior = useSettingsStore((state) => state.settings.general.closeBehavior);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pressingLB, setPressingLB] = useState(false);
  const [pressingRB, setPressingRB] = useState(false);
  const [isExitConfirmOpen, setIsExitConfirmOpen] = useState(false);

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
  const handleClose = async () => {
    if (closeBehavior === 'tray') {
      await appWindow.minimize();
      return;
    }

    setIsExitConfirmOpen(true);
  };

  const handleExitConfirm = async () => {
    setIsExitConfirmOpen(false);
    await invoke('plugin:process|exit', { code: 0 });
  };

  const navTabs: TabItem[] = [
    { id: 'home', label: '首页', icon: <HomeIcon size={18} /> },
    { id: 'instances', label: '实例', icon: <Server size={18} /> },
    { id: 'multiplayer', label: '联机', icon: <Users size={18} /> },
    { id: 'downloads', label: '下载', icon: <Download size={18} /> },
    { id: 'settings', label: '设置', icon: <Settings size={18} /> },
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
    <>
      <div
        data-tauri-drag-region
        className="z-50 flex min-h-[56px] w-full select-none items-center gap-3 px-4 pb-2 pt-[14px]"
      >
        <div
          data-tauri-drag-region
          className="flex min-w-[112px] flex-1 items-center font-minecraft text-sm tracking-wider text-white drop-shadow-md"
        >
          <div data-tauri-drag-region className="pointer-events-none">
            PiLauncher
          </div>
        </div>

        <div
          data-tauri-drag-region
          className="flex shrink-0 items-center justify-center gap-3 py-[2px]"
        >
          <div
            className={`flex cursor-pointer items-center justify-center transition-transform duration-150 ${
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
            className={`flex cursor-pointer items-center justify-center transition-transform duration-150 ${
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

        <div
          data-tauri-drag-region
          className="flex min-w-[112px] flex-1 items-center justify-end"
        >
          {!isFullscreen && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleMinimize}
                tabIndex={-1}
                className="rounded p-1 text-white transition-colors outline-none hover:bg-white/10 active:bg-white/20"
              >
                <Minus size={16} />
              </button>
              <button
                type="button"
                onClick={handleMaximize}
                tabIndex={-1}
                className="rounded p-1 text-white transition-colors outline-none hover:bg-white/10 active:bg-white/20"
              >
                <Square size={14} />
              </button>
              <button
                type="button"
                onClick={() => void handleClose()}
                tabIndex={-1}
                className="rounded p-1 text-white transition-colors outline-none hover:bg-red-600 active:bg-red-700"
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
      <OreConfirmDialog
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirm={handleExitConfirm}
        title="确认退出"
        headline="退出 PiLauncher"
        description="当前关闭按钮行为设置为“退出应用”。确认后会直接结束当前应用进程。"
        confirmLabel="确认退出"
        cancelLabel="取消"
        confirmVariant="danger"
        tone="warning"
        cancelFocusKey="titlebar-exit-cancel"
        confirmFocusKey="titlebar-exit-confirm"
      />
    </>
  );
};
