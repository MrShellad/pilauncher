import React, { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { DownloadManager } from './features/Download/components/DownloadManager/index';
import { GameLogSidebar } from './features/GameLog/components/GameLogSidebar';
import { GamepadModPrompt } from './features/Instances/components/GamepadModPrompt';
import { SetupWizard } from './features/Setup/components/SetupWizard';
import { JavaGuard } from './features/runtime/components/JavaGuard';
import { useLauncherStore } from './store/useLauncherStore';
import { useSettingsStore } from './store/useSettingsStore';
import { OreMotionTokens } from './style/tokens/motion';
import { injectDesignTokens } from './style/tokens/designToken';
import { FocusProvider } from './ui/focus/FocusProvider';
import i18n from './ui/i18';
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
import './style/index.css';
import './ui/i18';

const Home = lazy(() => import('./pages/Home'));
const Instances = lazy(() => import('./pages/Instances'));
const Multiplayer = lazy(() => import('./pages/Multiplayer'));
const NewInstance = lazy(() => import('./pages/NewInstance'));
const Settings = lazy(() => import('./pages/Settings'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'));
const ResourceDownloadPage = lazy(() => import('./pages/ResourceDownloadPage'));

const App: React.FC = () => {
  const activeTab = useLauncherStore((state) => state.activeTab);
  const { appearance, general } = useSettingsStore((state) => state.settings);

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

  const PageLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="animate-pulse font-minecraft text-ore-text-muted">Loading...</span>
    </div>
  );

  return (
    <FocusProvider>
      <div className="relative flex h-screen w-screen flex-col overflow-hidden text-ore-text">
        <OreBackground />
        <TitleBar />

        <main className="relative flex flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={OreMotionTokens.pageInitial}
              animate={OreMotionTokens.pageAnimate}
              exit={OreMotionTokens.pageExit}
              className="absolute inset-0 flex"
            >
              <Suspense fallback={<PageLoader />}>
                {activeTab === 'home' && <Home />}
                {activeTab === 'instances' && <Instances />}
                {activeTab === 'multiplayer' && <Multiplayer />}
                {activeTab === 'new-instance' && <NewInstance />}
                {activeTab === 'instance-detail' && <InstanceDetail />}
                {activeTab === 'downloads' && <ResourceDownloadPage />}
                {activeTab === 'settings' && <Settings />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        <DownloadManager />
        <JavaGuard />
        <SetupWizard />
        <GameLogSidebar />
        <GamepadModPrompt />
      </div>
    </FocusProvider>
  );
};

export default App;
