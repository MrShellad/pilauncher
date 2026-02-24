// /src/App.tsx
import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLauncherStore } from './store/useLauncherStore';
import { OreBackground } from './ui/layout/OreBackground';
import { TitleBar } from './ui/layout/TitleBar';
import { Home } from './pages/Home';
import './style/index.css';

const App: React.FC = () => {
  // 订阅全局路由状态
  const activeTab = useLauncherStore(state => state.activeTab);

  // 通用的页面切换动画
  const pageVariants = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <div className="relative w-screen h-screen flex flex-col overflow-hidden text-ore-text">
      {/* 1. 全局背景 */}
      <OreBackground />
      
      {/* 2. 全局标题栏和导航 */}
      <TitleBar />

      {/* 3. 动态页面路由区 */}
      <main className="flex-1 flex relative">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div key="home" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex">
              <Home />
            </motion.div>
          )}
          {activeTab === 'instances' && (
            <motion.div key="instances" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-minecraft">实例管理页面开发中...</span>
            </motion.div>
          )}
          {activeTab === 'downloads' && (
            <motion.div key="downloads" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-minecraft">资源下载页面开发中...</span>
            </motion.div>
          )}
          {activeTab === 'settings' && (
            <motion.div key="settings" variants={pageVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-minecraft">设置页面开发中...</span>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default App;