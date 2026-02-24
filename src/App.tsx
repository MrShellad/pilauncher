// /src/App.tsx
import React, { Suspense, lazy } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLauncherStore } from './store/useLauncherStore';
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
// 引入你的动画令牌
import { OreMotionTokens } from './style/tokens/motion'; 
import './style/index.css';

const Home = lazy(() => import('./pages/Home'));
const Instances = lazy(() => import('./pages/Instances'));
const NewInstance = lazy(() => import('./pages/NewInstance'));

const App: React.FC = () => {
  const activeTab = useLauncherStore(state => state.activeTab);

  const PageLoader = () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="text-ore-text-muted font-minecraft animate-pulse">Loading...</span>
    </div>
  );

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden text-ore-text">
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
              {activeTab === 'settings' && (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-xl font-minecraft">设置页面开发中...</span>
                </div>
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;