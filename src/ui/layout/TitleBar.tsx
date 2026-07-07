import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Home as HomeIcon, Library as LibraryIcon, Minus, Server, Settings, Square, X, Users } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logoImage from '../../assets/home/herologo/minecraft_title.webp';
import { invoke } from '@tauri-apps/api/core';
import { useLauncherStore } from '../../store/useLauncherStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { OreSegmentedControl, type TabItem } from '../primitives/OreSegmentedControl';
import { useInputAction } from '../focus/InputDriver';
import { GamepadButtonIcon } from '../components/GamepadButtonIcon';
import { OreConfirmDialog } from '../primitives/OreConfirmDialog';

export const TitleBar: React.FC = () => {
  const { t } = useTranslation();
  const appWindow = getCurrentWindow();
  const { activeTab, setActiveTab } = useLauncherStore();
  const closeBehavior = useSettingsStore((state) => state.settings.general.closeBehavior);
  const hiddenNavTabs = useSettingsStore((state) => state.settings.appearance.hiddenNavTabs);
  const skipExitConfirm = useSettingsStore((state) => state.settings.appearance.skipExitConfirm);
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

    if (skipExitConfirm) {
      await invoke('plugin:process|exit', { code: 0 });
      return;
    }

    setIsExitConfirmOpen(true);
  };

  const handleExitConfirm = async () => {
    setIsExitConfirmOpen(false);
    await invoke('plugin:process|exit', { code: 0 });
  };

  const allNavTabs: TabItem[] = [
    { id: 'home', label: t('nav.home', '首页'), icon: <HomeIcon size={18} /> },
    { id: 'instances', label: t('nav.instances', '实例'), icon: <Server size={18} /> },
    { id: 'multiplayer', label: t('nav.multiplayer', '联机'), icon: <Users size={18} /> },
    { id: 'downloads', label: t('nav.downloads', '下载'), icon: <Download size={18} /> },
    { id: 'library', label: t('nav.library', '收藏'), icon: <LibraryIcon size={18} /> },
    { id: 'settings', label: t('nav.settings', '设置'), icon: <Settings size={18} /> },
  ];

  const navTabs = allNavTabs.filter(
    (tab) => tab.id === 'home' || tab.id === 'settings' || !hiddenNavTabs.includes(tab.id)
  );

  // 子页面 → 父级导航 Tab 映射，进入子页面时父 Tab 保持高亮
  const subPageParentMap: Record<string, string> = {
    'instance-detail': 'instances',
    'instance-mod-download': 'instances',
    'new-instance': 'instances',
    'wardrobe': 'home',
    'news': 'home',
  };

  const visibleActiveTab = subPageParentMap[activeTab] || activeTab;
  const currentIndex = navTabs.findIndex((tab) => tab.id === visibleActiveTab);

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

    const allIndex = allNavTabs.findIndex((tab) => tab.id === visibleActiveTab);
    let nextIndex = -1;

    if (allIndex !== -1) {
      const len = allNavTabs.length;
      for (let i = 1; i <= len; i++) {
        const checkIdx = (allIndex + i * direction + len * 2) % len;
        const targetTab = allNavTabs[checkIdx];
        const foundInNav = navTabs.findIndex((t) => t.id === targetTab.id);
        if (foundInNav !== -1) {
          nextIndex = foundInNav;
          break;
        }
      }
    }

    if (nextIndex === -1) {
      nextIndex = currentIndex + direction;
      if (nextIndex < 0) nextIndex = navTabs.length - 1;
      if (nextIndex >= navTabs.length) nextIndex = 0;
    }

    setActiveTab(navTabs[nextIndex].id as any);
  };

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsMobile(mobile);
  }, []);

  useInputAction('TAB_LEFT', () => handleSwitchTab(-1));
  useInputAction('TAB_RIGHT', () => handleSwitchTab(1));

  return (
    <>
      <div
        data-tauri-drag-region
        className={`z-50 flex min-h-[48px] md:min-h-[56px] w-full select-none items-center gap-3 px-4 pb-1 md:pb-2 pt-[8px] md:pt-[14px] ${isMobile ? 'justify-center' : ''}`}
      >
        {!isMobile && (
          <div
            data-tauri-drag-region
            className="flex min-w-[112px] flex-1 items-center drop-shadow-md"
          >
            <div data-tauri-drag-region className="pointer-events-none flex items-center">
              <img
                src={logoImage}
                alt="PiLauncher"
                className="h-[1.125rem] md:h-[1.375rem] w-auto object-contain select-none pointer-events-none"
                data-tauri-drag-region
              />
            </div>
          </div>
        )}

        <nav
          aria-label="主导航"
          className="flex shrink-0 items-center justify-center gap-3 py-[2px]"
        >
          <button
            type="button"
            aria-label="上一个标签页"
            className={`flex cursor-pointer items-center justify-center transition-transform duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white rounded ${pressingLB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'
              }`}
            onClick={() => handleSwitchTab(-1)}
            onPointerDown={() => setPressingLB(true)}
            onPointerUp={() => setPressingLB(false)}
            onPointerLeave={() => setPressingLB(false)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleSwitchTab(-1);
              }
            }}
          >
            <GamepadButtonIcon button="LB" tone={pressingLB ? 'green' : 'dark'} size="lg" />
          </button>

          <OreSegmentedControl
            tabs={navTabs}
            activeTab={visibleActiveTab}
            onChange={(id) => setActiveTab(id as any)}
            focusable={false}
          />

          <button
            type="button"
            aria-label="下一个标签页"
            className={`flex cursor-pointer items-center justify-center transition-transform duration-150 outline-none focus-visible:ring-2 focus-visible:ring-white rounded ${pressingRB ? 'scale-75' : 'scale-90 hover:scale-95 active:scale-75'
              }`}
            onClick={() => handleSwitchTab(1)}
            onPointerDown={() => setPressingRB(true)}
            onPointerUp={() => setPressingRB(false)}
            onPointerLeave={() => setPressingRB(false)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                handleSwitchTab(1);
              }
            }}
          >
            <GamepadButtonIcon button="RB" tone={pressingRB ? 'green' : 'dark'} size="lg" />
          </button>
        </nav>

        {!isMobile && (
          <div
            data-tauri-drag-region
            className="flex min-w-[112px] flex-1 items-center justify-end"
          >
            {!isFullscreen && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={handleMinimize}
                  aria-label="最小化窗口"
                  className="rounded p-1 text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white hover:bg-white/10 active:bg-white/20"
                >
                  <Minus size={16} />
                </button>
                <button
                  type="button"
                  onClick={handleMaximize}
                  aria-label="最大化/还原窗口"
                  className="rounded p-1 text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white hover:bg-white/10 active:bg-white/20"
                >
                  <Square size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => void handleClose()}
                  aria-label="关闭窗口"
                  className="rounded p-1 text-white transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white hover:bg-red-600 active:bg-red-700"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <OreConfirmDialog
        isOpen={isExitConfirmOpen}
        onClose={() => setIsExitConfirmOpen(false)}
        onConfirm={handleExitConfirm}
        title={t('titlebar.exit.title', '确认退出')}
        headline={t('titlebar.exit.headline', '退出 PiLauncher')}
        description={t('titlebar.exit.description', '当前关闭按钮行为设置为“退出应用”。确认后会直接结束当前应用进程。')}
        confirmLabel={t('common.confirm_exit', '确认退出')}
        cancelLabel={t('common.cancel', '取消')}
        confirmVariant="danger"
        tone="warning"
        cancelFocusKey="titlebar-exit-cancel"
        confirmFocusKey="titlebar-exit-confirm"
      />
    </>
  );
};
