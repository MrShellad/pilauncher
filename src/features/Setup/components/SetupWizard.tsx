// src/features/Setup/components/SetupWizard.tsx
import React, { useEffect } from 'react'; // ✅ 引入 useEffect
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';
import { FocusBoundary } from '../../../ui/focus/FocusBoundary';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation'; // ✅ 引入全局焦点发射器

// 引入拆分后的代码
import { useSetupWizard } from '../../../hooks/useSetupWizard';
import { DirectoryStep } from './step/DirectoryStep';
import { JavaDownloadStep } from './step/JavaDownloadStep';

export const SetupWizard: React.FC = () => {
  const {
    needsSetup, setNeedsSetup, isChecking, error, step,
    basePath, setBasePath, showBrowser, setShowBrowser,
    javaVersion, setJavaVersion, javaProvider, setJavaProvider,
    handleSelectPath, handleConfirmDirectory, handleDownloadJava
  } = useSetupWizard();

  // ✅ 核心修复：专门为 UI 挂载准备的焦点分发控制器
  useEffect(() => {
    // 如果正在检测环境、不需要向导，或者打开了上层的目录浏览器，则交出控制权
    if (isChecking || !needsSetup || showBrowser) return;

    // 延迟 250ms：确保 Framer Motion 的弹出动画完全停止，且 FocusBoundary 已激活
    const timer = setTimeout(() => {
      if (step === 'directory') {
        setFocus('setup-btn-browse'); // 默认聚焦到“浏览”按钮
      } else if (step === 'java_download') {
        setFocus('setup-btn-download'); // 默认聚焦到“自动下载”按钮
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [isChecking, needsSetup, step, showBrowser]);

  if (isChecking || !needsSetup) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center font-minecraft"
        >
          <FocusBoundary id="setup-wizard-boundary" trapFocus={true} className="outline-none">
            <motion.div 
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
              className="bg-[#18181B] border-2 border-ore-gray-border w-[540px] p-8 shadow-2xl flex flex-col items-center relative overflow-hidden"
            >
              {step === 'directory' && (
                <DirectoryStep 
                  basePath={basePath} setBasePath={setBasePath} 
                  onBrowse={() => setShowBrowser(true)} onConfirm={handleConfirmDirectory} 
                />
              )}

              {step === 'java_download' && (
                <JavaDownloadStep 
                  javaVersion={javaVersion} setJavaVersion={setJavaVersion}
                  javaProvider={javaProvider} setJavaProvider={setJavaProvider}
                  onSkip={() => setNeedsSetup(false)} onDownload={handleDownloadJava}
                />
              )}

              {/* 统一的错误提示区 */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="mt-4 w-full bg-red-500/10 border border-red-500/50 p-3 flex items-start text-red-400 text-xs text-left relative z-10"
                >
                  <AlertTriangle size={14} className="mr-2 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </motion.div>
          </FocusBoundary>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {showBrowser && (
          <DirectoryBrowserModal 
            isOpen={showBrowser}
            onClose={() => setShowBrowser(false)}
            onSelect={handleSelectPath}
          />
        )}
      </AnimatePresence>
    </>
  );
};