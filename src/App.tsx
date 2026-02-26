// /src/App.tsx
import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLauncherStore } from './store/useLauncherStore';
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
import { OreMotionTokens } from './style/tokens/motion'; 
import './style/index.css';
import { useSettingsStore } from './store/useSettingsStore';
import { DownloadManager } from './features/Downloads/components/DownloadManager';
import { SetupWizard } from './features/Setup/components/SetupWizard';

const Home = lazy(() => import('./pages/Home'));
const Instances = lazy(() => import('./pages/Instances'));
const NewInstance = lazy(() => import('./pages/NewInstance'));
const Settings = lazy(() => import('./pages/Settings'));
const InstanceDetail = lazy(() => import('./pages/InstanceDetail'));

const App: React.FC = () => {
  const activeTab = useLauncherStore(state => state.activeTab);
  
  // ✅ 修复：将 Hook 移到组件内部的最顶层！
  const { appearance } = useSettingsStore(state => state.settings);

  const PageLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-ore-text-muted font-minecraft animate-pulse">Loading...</span>
    </div>
  );

  // 动态生成全局字体样式
  const globalStyle = {
    fontFamily: `"${appearance.fontFamily}", "Minecraft", sans-serif`,
  };

  return (
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
              {activeTab === 'downloads' && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xl font-minecraft">资源下载页面开发中...</span>
                </div>
              )}
              {activeTab === 'instance-detail' && <InstanceDetail />}
              {activeTab === 'settings' && <Settings />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
     
      {/*将全局下载管理器挂载在最外层，确保切换 Tab 时它不会被销毁或重启动画 */}
      <DownloadManager />
      <SetupWizard />
    </div>
  );
};

export default App;