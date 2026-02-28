// /src/App.tsx
import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// 引入状态管理
import { useLauncherStore } from './store/useLauncherStore';
import { useSettingsStore } from './store/useSettingsStore';

// 引入全局焦点引擎 Provider
import { FocusProvider } from './ui/focus/FocusProvider';

// 引入布局与组件
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
import { DownloadManager } from './features/Downloads/components/DownloadManager';
import { SetupWizard } from './features/Setup/components/SetupWizard';
import { JavaGuard } from './features/runtime/components/JavaGuard';
// 引入样式与动画 Token
import { OreMotionTokens } from './style/tokens/motion'; 
import './style/index.css';

// 懒加载页面路由
const Home = lazy(() => import('./pages/Home'));
const Instances = lazy(() => import('./pages/Instances'));
const NewInstance = lazy(() => import('./pages/NewInstance'));
const Settings = lazy(() => import('./pages/Settings'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail')); 

const App: React.FC = () => {
  const activeTab = useLauncherStore(state => state.activeTab);
  const { appearance } = useSettingsStore(state => state.settings);

  const PageLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-ore-text-muted font-minecraft animate-pulse">Loading...</span>
    </div>
  );

  // 安全地动态生成全局字体样式
  const fontFamily = appearance?.fontFamily || 'Minecraft';
  const globalStyle = {
    fontFamily: `"${fontFamily}", "Minecraft", sans-serif`,
  };

  return (
    // ✅ 核心：使用 FocusProvider 包裹整个应用，初始化底层的空间导航引擎
    <FocusProvider>
      <div className="relative w-screen h-screen flex flex-col overflow-hidden text-ore-text" style={globalStyle}>
        <OreBackground />
        <TitleBar />

        <main className="flex-1 flex relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab} // 使用 activeTab 作为 key 确保切换时触发动画
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
                {activeTab === 'downloads' && (
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-xl font-minecraft">资源下载页面开发中...</span>
                  </div>
                )}
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