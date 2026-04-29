import React, { Suspense, lazy, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { initGamepadModRegistry } from './services/gamepadModService';
import { AnimatePresence, motion } from 'framer-motion';

import { useLauncherStore } from './store/useLauncherStore';
import { useNewsStore } from './store/useNewsStore';
import { useSettingsStore } from './store/useSettingsStore';
import { usePiHubSession } from './features/multiplayer/hooks/usePiHubSession';
import { OreMotionTokens } from './style/tokens/motion';
import { injectDesignTokens } from './style/tokens/designToken';
import { FocusProvider } from './ui/focus/FocusProvider';
import { OreToastContainer } from './ui/primitives/OreToast';
import i18n from './ui/i18';
import { TitleBar } from './ui/layout/TitleBar';
import './ui/i18';

import Home from './pages/Home';
import { OreBackground } from './ui/layout/OreBackground';
import { DownloadManager } from './features/Download/components/DownloadManager';
import { GameLogService } from './features/GameLog/components/GameLogService';
import { GameLogSidebar } from './features/GameLog/components/GameLogSidebar';
import { LaunchingAnimation } from './features/GameLog/components/LaunchingAnimation';
import { StartupNewsModal } from './features/home/components/StartupNewsModal';
import { GamepadModPrompt } from './features/Instances/components/GamepadModPrompt';
import { SetupWizard } from './features/Setup/components/SetupWizard';
import { JavaGuard } from './features/runtime/components/JavaGuard';
import { JavaEnvironmentChangedDialog } from './features/runtime/components/JavaEnvironmentChangedDialog';
import { StartupUpdateChecker } from './features/Settings/components/StartupUpdateChecker';

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

const PageLoader = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <span className="animate-pulse font-minecraft text-ore-text-muted">Loading...</span>
  </div>
);

const MultiplayerGuard: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const session = usePiHubSession();
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

const App: React.FC = () => {
  const activeTab = useLauncherStore((state) => state.activeTab);
  const ensureSessionRefresh = useNewsStore((state) => state.ensureSessionRefresh);
  const { appearance, general, game } = useSettingsStore((state) => state.settings);
  const hasHydrated = useSettingsStore((state) => state._hasHydrated);
  const javaAutoDetect = useSettingsStore((state) => state.settings.java.autoDetect);
  const triggerJavaAutoDetect = useSettingsStore((state) => state.triggerJavaAutoDetect);
  const startupJavaScanDoneRef = useRef(false);
  const [isJavaEnvChangedDialogOpen, setIsJavaEnvChangedDialogOpen] = useState(false);

  // Whether to show the log sidebar (default true for backwards-compat)
  const showGameLog = game?.showGameLog ?? true;

  useLayoutEffect(() => {
    injectDesignTokens();
  }, []);

  useLayoutEffect(() => {
    const currentFont = appearance?.fontFamily || 'Minecraft';
    document.documentElement.style.setProperty('--ore-global-font', `"${currentFont}"`);
  }, [appearance?.fontFamily]);

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
    void (async () => {
      const result = await triggerJavaAutoDetect({ source: 'startup', notifyIfChanged: false });
      if (result?.changed && result.hasPreviousSnapshot) {
        setIsJavaEnvChangedDialogOpen(true);
      }
    })();
  }, [hasHydrated, javaAutoDetect, triggerJavaAutoDetect]);

  useEffect(() => {
    void ensureSessionRefresh();
  }, [ensureSessionRefresh]);

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
    initGamepadModRegistry().catch((err) => {
      console.warn('[App] 手柄 Mod 注册表初始化失败（不影响使用）:', err);
    });
  }, []);

  // 禁用默认右键菜单
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);

  // 禁用全局触控动作（如双指缩放、下拉刷新、全屏滚动等）
  useEffect(() => {
    const preventTouch = general?.preventTouchAction ?? true;
    if (preventTouch) {
      document.documentElement.style.touchAction = 'none';
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
      };
      // passive 必须为 false 才能起作用
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      return () => {
        document.documentElement.style.touchAction = '';
        document.removeEventListener('touchmove', handleTouchMove);
      };
    } else {
      document.documentElement.style.touchAction = '';
      return () => {};
    }
  }, [general?.preventTouchAction]);

  return (
    <FocusProvider>
      <div className="relative flex h-screen w-screen flex-col overflow-hidden text-ore-text">
        <OreBackground />
        <TitleBar />

        <main className="relative flex flex-1">
          <AnimatePresence mode="wait">
            {activeTab !== 'multiplayer' && (
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
                    {activeTab === 'instance-detail' && <InstanceDetail />}
                    {activeTab === 'instance-mod-download' && <InstanceModDownloadPage />}
                    {activeTab === 'downloads' && <ResourceDownloadPage />}
                    {activeTab === 'wardrobe' && <Wardrobe />}
                    {activeTab === 'settings' && <Settings />}
                  </Suspense>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          <MultiplayerGuard activeTab={activeTab} />
        </main>

        <DownloadManager />
        <JavaGuard />
        <SetupWizard />
        <StartupUpdateChecker />

        {/* Always-mounted event listener — feeds logs into the store */}
        <GameLogService />
        {/* Game log UI: sidebar when enabled, progress animation when disabled */}
        {showGameLog ? <GameLogSidebar /> : <LaunchingAnimation />}

        <StartupNewsModal />
        <GamepadModPrompt />
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
