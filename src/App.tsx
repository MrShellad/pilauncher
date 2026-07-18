import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initGamepadModRegistry } from './services/gamepadModService';
import { AnimatePresence, motion } from 'motion/react';

import { useLauncherStore } from './store/useLauncherStore';
import { useNewsStore } from './store/useNewsStore';
import { useSettingsStore } from './store/useSettingsStore';
import { useGameLogStore } from './store/useGameLogStore';
import { useTerracottaSession } from './features/multiplayer/hooks/useTerracottaSession';
import { useDownloadSelectionStore } from './features/Download/stores/useDownloadSelectionStore';
import { OreMotionTokens } from './style/tokens/motion';
import { injectDesignTokens } from './style/tokens/designToken';
import { FocusProvider } from './ui/focus/FocusProvider';
import { OreToastContainer } from './ui/primitives/OreToast';
import i18n from './ui/i18';
import { TitleBar } from './ui/layout/TitleBar';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import './ui/i18';

import Home from './pages/Home';
import { OreBackground } from './ui/layout/OreBackground';
import { DownloadManager } from './features/Download/components/DownloadManager';
import { GameLogService } from './features/GameLog/components/GameLogService';
import { GameLogSidebar } from './features/GameLog/components/GameLogSidebar';
import { LaunchingAnimation } from './features/GameLog/components/LaunchingAnimation';
import { StartupNewsModal } from './features/home/components/StartupNewsModal';
import { StartupArticlePushModal } from './features/home/components/StartupArticlePushModal';
import { GamepadModPrompt } from './features/Instances/components/GamepadModPrompt';
import { SetupWizard } from './features/Setup/components/SetupWizard';
import { JavaGuard } from './features/runtime/components/JavaGuard';
import { JavaEnvironmentChangedDialog } from './features/runtime/components/JavaEnvironmentChangedDialog';
import { RuntimeRepairDialogHost } from './features/runtime/components/RuntimeRepairDialogHost';
import { StartupUpdateChecker } from './features/Settings/components/StartupUpdateChecker';
import { useWebDavAutoSync } from './hooks/useWebDavAutoSync';
import { useScreenDensity } from './hooks/ui/useScreenDensity';

const News = lazy(() => import('./pages/News'));
const Instances = lazy(() => import('./pages/Instances'));
const Multiplayer = lazy(() => import('./pages/Multiplayer'));
const Wardrobe = lazy(() => import('./pages/Wardrobe'));
const NewInstance = lazy(() => import('./pages/NewInstance'));
const Settings = lazy(() => import('./pages/Settings'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'));
const ResourceDownloadPage = lazy(() => import('./pages/ResourceDownloadPage'));
const InstanceModDownloadPage = lazy(() => import('./pages/InstanceModDownloadPage'));
const LibraryPage = lazy(() => import('./pages/LibraryPage'));

let deferredServicesRequested = false;
let clientInstallationTelemetryRequested = false;

const PageLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <span className="animate-pulse font-minecraft text-ore-text-muted">Loading...</span>
  </div>
);

const MultiplayerGuard: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const session = useTerracottaSession();
  const isStarted = session.lifecycle !== 'idle';
  const isActive = activeTab === 'multiplayer';

  if (!isStarted && !isActive) return null;

  return (
    <div
      className="absolute inset-0 flex transition-opacity duration-300"
      style={{
        zIndex: isActive ? 10 : -1,
        pointerEvents: isActive ? 'auto' : 'none',
        opacity: isActive ? 1 : 0
      }}
    >
      <Suspense fallback={<PageLoader />}>
        <Multiplayer />
      </Suspense>
    </div>
  );
};

const InstanceDetailGuard: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const isActive = activeTab === 'instance-detail';
  const shouldKeepMounted = isActive || activeTab === 'instance-mod-download';

  if (!shouldKeepMounted) return null;

  return (
    <div
      className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'}`}
      style={{ zIndex: isActive ? 10 : -1 }}
      aria-hidden={!isActive}
    >
      <Suspense fallback={<PageLoader />}>
        <InstanceDetail />
      </Suspense>
    </div>
  );
};

const InstanceModDownloadGuard: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  if (activeTab !== 'instance-mod-download') return null;

  return (
    <div className="absolute inset-0 z-20 flex">
      <Suspense fallback={<PageLoader />}>
        <InstanceModDownloadPage />
      </Suspense>
    </div>
  );
};

const ResourceDownloadGuard: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const selectedCount = useDownloadSelectionStore((state) => state.selectedCount);
  const isActive = activeTab === 'downloads';
  const shouldKeepMounted = isActive || selectedCount > 0;

  if (!shouldKeepMounted) return null;

  return (
    <div
      className={`absolute inset-0 ${isActive ? 'flex' : 'hidden'}`}
      style={{ zIndex: isActive ? 10 : -1 }}
      aria-hidden={!isActive}
    >
      <Suspense fallback={<PageLoader />}>
        <ResourceDownloadPage />
      </Suspense>
    </div>
  );
};

const App: React.FC = () => {
  useScreenDensity();
  useWebDavAutoSync();
  const activeTab = useLauncherStore((state) => state.activeTab);
  const ensureSessionRefresh = useNewsStore((state) => state.ensureSessionRefresh);
  const { appearance, general, game } = useSettingsStore((state) => state.settings);
  const hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const telemetryUploadEnabled = general?.telemetryUploadEnabled ?? true;
  const javaAutoDetect = useSettingsStore((state) => state.settings.java.autoDetect);
  const triggerJavaAutoDetect = useSettingsStore((state) => state.triggerJavaAutoDetect);
  const startupJavaScanDoneRef = useRef(false);
  const [isJavaEnvChangedDialogOpen, setIsJavaEnvChangedDialogOpen] = useState(false);

  // Whether to show the log sidebar (default true for backwards-compat)
  const showGameLog = game?.showGameLog ?? true;
  const isCrashed = useGameLogStore((s) => s.gameState === 'crashed');
  const shouldShowSidebar = showGameLog || isCrashed;

  useLayoutEffect(() => {
    injectDesignTokens();
  }, []);

  useLayoutEffect(() => {
    const currentFont = appearance?.fontFamily || 'Minecraft';
    document.documentElement.style.setProperty('--ore-global-font', `"${currentFont}"`);
  }, [appearance?.fontFamily]);

  useLayoutEffect(() => {
    const theme = appearance?.theme || 'system';
    const root = document.documentElement;

    const applyTheme = (isDark: boolean) => {
      if (isDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches);

      const listener = (e: MediaQueryListEvent) => {
        applyTheme(e.matches);
      };
      mediaQuery.addEventListener('change', listener);
      return () => mediaQuery.removeEventListener('change', listener);
    } else {
      applyTheme(theme === 'dark');
    }
  }, [appearance?.theme]);

  useEffect(() => {
    const language = general?.language || 'zh-CN';
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
  }, [general?.language]);

  useEffect(() => {
    if (!hasHydrated || startupJavaScanDoneRef.current) return;
    startupJavaScanDoneRef.current = true;

    if (!javaAutoDetect) return;
    const timer = setTimeout(() => {
      void (async () => {
        const result = await triggerJavaAutoDetect({ source: 'startup', notifyIfChanged: false });
        if (result?.changed && result.hasPreviousSnapshot) {
          setIsJavaEnvChangedDialogOpen(true);
        }
      })();
    }, 5000);
    return () => clearTimeout(timer);
  }, [hasHydrated, javaAutoDetect, triggerJavaAutoDetect]);

  useEffect(() => {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isMobile) {
      // Force fullscreen via Tauri appWindow
      try {
        const appWindow = getCurrentWebviewWindow();
        appWindow.setFullscreen(true).catch((err: any) => {
          console.warn('[App] Failed to set fullscreen via Tauri:', err);
        });
      } catch (err) {
        console.warn('[App] Failed to access Tauri getCurrentWebviewWindow:', err);
      }

      // Force landscape orientation via Screen Orientation API
      const orientation = screen.orientation as any;
      if (orientation && typeof orientation.lock === 'function') {
        orientation.lock('landscape').catch((err: any) => {
          console.warn('[App] Orientation lock failed:', err);
        });
      }
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      void ensureSessionRefresh();
    }, 2000);
    return () => clearTimeout(timer);
  }, [ensureSessionRefresh]);

  useEffect(() => {
    if (!hasHydrated || !telemetryUploadEnabled) return;
    if (clientInstallationTelemetryRequested) return;
    clientInstallationTelemetryRequested = true;

    const timer = setTimeout(() => {
      import('@tauri-apps/api/core').then(({ invoke }) => {
        invoke('track_client_installation').catch((err) => {
          console.warn('[App] Client installation telemetry upload skipped or failed:', err);
        });
      });
    }, 15000);
    return () => clearTimeout(timer);
  }, [hasHydrated, telemetryUploadEnabled]);

  useEffect(() => {
    if (deferredServicesRequested) return;

    let cancelled = false;
    let secondFrame = 0;
    let timeoutId = 0;

    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        timeoutId = window.setTimeout(() => {
          if (cancelled || deferredServicesRequested) return;
          deferredServicesRequested = true;

          import('@tauri-apps/api/core').then(({ invoke }) => {
            invoke('start_deferred_services').catch((err) => {
              console.warn('[App] Deferred background services failed to start:', err);
            });
          });
        }, 0);
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  // ✅ 启动时从本地 JSON 文件恢复上次选中的实例 (全局一次性初始化)
  useEffect(() => {
    // 仅在 Store 初始值为 null 时从磁盘恢复
    const currentId = useLauncherStore.getState().selectedInstanceId;
    if (currentId) return;

    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string | null>('load_selected_instance')
        .then((id) => {
          if (id) useLauncherStore.setState({ selectedInstanceId: id });
        })
        .catch(() => {});
    });
  }, []);

  // ✅ 监听全局 Store 中的选中实例 ID 变化并保存到磁盘
  useEffect(() => {
    const unsub = useLauncherStore.subscribe(
      (state) => state.selectedInstanceId,
      (id) => {
        if (!id) return;
        import('@tauri-apps/api/core').then(({ invoke }) => {
          invoke('save_selected_instance', { instanceId: id }).catch(() => {});
        });
      }
    );
    return unsub;
  }, []);

  // ✅ 启动时初始化手柄 Mod 注册表（从 Modrinth/CurseForge API 拉取版本信息）
  useEffect(() => {
    const timer = setTimeout(() => {
      initGamepadModRegistry().catch((err) => {
        console.warn('[App] 手柄 Mod 注册表初始化失败（不影响使用）:', err);
      });
    }, 10000);
    return () => clearTimeout(timer);
  }, []);

  // 允许输入框/文本区域使用右键菜单，对于其他区域进行禁用，保证无障碍剪贴板操作
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // 禁用全局触控动作（如双指缩放、下拉刷新等），仅通过 CSS touch-action 样式，不再注册 touchmove 的 preventDefault 监听
  useEffect(() => {
    const preventTouch = general?.preventTouchAction ?? true;
    if (preventTouch) {
      document.documentElement.style.touchAction = 'none';
      return () => {
        document.documentElement.style.touchAction = '';
      };
    } else {
      document.documentElement.style.touchAction = '';
      return () => {};
    }
  }, [general?.preventTouchAction]);

  const [announcement, setAnnouncement] = useState('');
  useEffect(() => {
    const tabNames: Record<string, string> = {
      home: '首页',
      news: '新闻',
      instances: '实例列表',
      library: '资源库',
      'new-instance': '新建实例',
      wardrobe: '衣柜',
      settings: '设置',
      multiplayer: '多人游戏',
      'instance-detail': '实例详情',
      'instance-mod-download': '模组下载',
      downloads: '下载管理',
    };
    const name = tabNames[activeTab] || activeTab;
    setAnnouncement(`已切换到${name}页面`);
  }, [activeTab]);

  return (
    <FocusProvider>
      <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden text-ore-text">
        <OreBackground />
        
        {/* 跳过导航链接 */}
        <a 
          href="#main-content" 
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-ore-green focus:text-white"
        >
          跳过导航
        </a>

        {/* 全局无障碍状态公告区域 */}
        <div aria-live="polite" aria-atomic="true" className="sr-only" id="announcer">
          {announcement}
        </div>

        <TitleBar />

        <main id="main-content" aria-label="主内容" className="relative flex flex-1">
          <AnimatePresence mode="wait">
            {!['multiplayer', 'instance-detail', 'instance-mod-download', 'downloads'].includes(activeTab) && (
              <motion.div
                key={activeTab}
                initial={OreMotionTokens.pageInitial}
                animate={OreMotionTokens.pageAnimate}
                exit={OreMotionTokens.pageExit}
                className="absolute inset-0 flex"
              >
                {activeTab === 'home' ? (
                  <Home />
                ) : (
                  <Suspense fallback={<PageLoader />}>
                    {activeTab === 'news' && <News />}
                    {activeTab === 'instances' && <Instances />}
                    {activeTab === 'library' && <LibraryPage />}

                    {activeTab === 'new-instance' && <NewInstance />}
                    {activeTab === 'wardrobe' && <Wardrobe />}
                    {activeTab === 'settings' && <Settings />}
                  </Suspense>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <InstanceDetailGuard activeTab={activeTab} />
          <InstanceModDownloadGuard activeTab={activeTab} />
          <ResourceDownloadGuard activeTab={activeTab} />
          <MultiplayerGuard activeTab={activeTab} />
        </main>

        <DownloadManager />
        <JavaGuard />
        <SetupWizard />
        <StartupUpdateChecker />

        {/* Always-mounted event listener — feeds logs into the store */}
        <GameLogService />
        {/* Game log UI: sidebar when enabled, progress animation when disabled */}
        {shouldShowSidebar ? <GameLogSidebar /> : <LaunchingAnimation />}

        <StartupNewsModal />
        <StartupArticlePushModal />
        <GamepadModPrompt />
        <RuntimeRepairDialogHost />
        <JavaEnvironmentChangedDialog
          isOpen={isJavaEnvChangedDialogOpen}
          onClose={() => setIsJavaEnvChangedDialogOpen(false)}
        />

        <OreToastContainer />
      </div>
    </FocusProvider>
  );
};

export default App;
