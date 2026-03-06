// /src/App.tsx
import React, { Suspense, lazy, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// 引入状态管理
import { useLauncherStore } from './store/useLauncherStore';
import { useSettingsStore } from './store/useSettingsStore';

// 引入全局焦点引擎 Provider
import { FocusProvider } from './ui/focus/FocusProvider';

// 引入布局与组件
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
import { DownloadManager } from './features/Download/components/DownloadManager/index';
import { SetupWizard } from './features/Setup/components/SetupWizard';
import { JavaGuard } from './features/runtime/components/JavaGuard';
// 引入样式与动画 Token
import { OreMotionTokens } from './style/tokens/motion'; 
import './style/index.css';
import './ui/i18';

import { injectDesignTokens } from './style/tokens/designToken';

// 懒加载页面路由
const Home = lazy(() => import('./pages/Home'));
const Instances = lazy(() => import('./pages/Instances'));
const NewInstance = lazy(() => import('./pages/NewInstance'));
const Settings = lazy(() => import('./pages/Settings'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail')); 
const ResourceDownloadPage = lazy(() => import('./pages/ResourceDownloadPage'));

const App: React.FC = () => {
  const activeTab = useLauncherStore(state => state.activeTab);
  const { appearance } = useSettingsStore(state => state.settings);

  // ✅ 核心修复：使用 useLayoutEffect，确保在组件挂载、DOM 渲染前，同步注入 CSS 变量。
  // 彻底解决首次加载或热更新时，CSS 变量丢失导致按钮变透明的问题！
  useLayoutEffect(() => {
    injectDesignTokens();
  }, []);



 useLayoutEffect(() => {
    const currentFont = appearance?.fontFamily || 'Minecraft';
    // 强制全局更新字体变量
    document.documentElement.style.setProperty('--ore-global-font', `"${currentFont}"`);
  }, [appearance?.fontFamily]);

    const PageLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-ore-text-muted font-minecraft animate-pulse">Loading...</span>
    </div>
  );

  return (
    <FocusProvider>
      <div className="relative w-screen h-screen flex flex-col overflow-hidden text-ore-text">
        <OreBackground />
        <TitleBar />

        <main className="flex-1 flex relative">
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
                {activeTab === 'new-instance' && <NewInstance />}
                {activeTab === 'instance-detail' && <InstanceDetail />}
                {activeTab === 'downloads' && <ResourceDownloadPage />}
                {activeTab === 'settings' && <Settings />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </main>

        {/* 全局悬浮与拦截层 */}
        <DownloadManager />
        <JavaGuard />
        <SetupWizard />
      </div>
    </FocusProvider>
  );
};

export default App;