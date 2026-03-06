// /src/features/Setup/components/SetupWizard.tsx
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, AlertTriangle, ShieldCheck, Download, Coffee } from 'lucide-react';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { OreButton } from '../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../ui/primitives/OreDropdown';

// ✅ 引入我们刚刚打造的自定义目录浏览器
import { DirectoryBrowserModal } from '../../../ui/components/DirectoryBrowserModal';

export const SetupWizard: React.FC = () => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<'directory' | 'java_download'>('directory');
  const [basePath, setBasePath] = useState('');
  
  // ✅ 弹窗控制状态
  const [showBrowser, setShowBrowser] = useState(false);
  
  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState('adoptium');

  const updateGeneralSetting = useSettingsStore(state => state.updateGeneralSetting);

  useEffect(() => {
    invoke<string | null>('get_base_directory')
      .then((res) => {
        if (!res) {
          setNeedsSetup(true);
        } else {
          updateGeneralSetting('basePath', res);
        }
      })
      .catch(console.error)
      .finally(() => setIsChecking(false));
  }, [updateGeneralSetting]);

  // 处理自定义浏览器返回的路径
  const handleSelectPath = (path: string) => {
    setBasePath(path);
    setShowBrowser(false);
    setError(null);
  };

  const handleConfirmDirectory = async () => {
    setError(null);
    if (!basePath.trim()) {
      setError("路径不能为空"); return;
    }
    
    if (/[^\x00-\x7F]/.test(basePath)) {
      setError("为防止游戏崩溃，目录路径中绝对不能包含中文或特殊字符！"); return;
    }

    try {
      await invoke('set_base_directory', { path: basePath });
      updateGeneralSetting('basePath', basePath);
      
      // ✅ 核心增强：如果选中的是旧目录，强制 Zustand 立即从刚挂载的旧目录中重新读取 settings.json！
      // 这样玩家的自定义主题、背景图等设置会瞬间恢复，无需重启应用。
      await useSettingsStore.persist.rehydrate();
      
      const javas = await invoke<any[]>('scan_java_environments');
      if (javas && javas.length > 0) {
        setNeedsSetup(false);
      } else {
        setStep('java_download');
      }
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleDownloadJava = async () => {
    try {
      await invoke('download_java_env', { 
        version: parseInt(javaVersion), 
        provider: javaProvider 
      });
      setNeedsSetup(false);
    } catch (err: any) {
      setError(String(err));
    }
  };

  const javaOptions = [
    { label: 'Java 21 (适用于 MC 1.21+)', value: '21' },
    { label: 'Java 17 (适用于 MC 1.18 - 1.20)', value: '17' },
    { label: 'Java 16 (适用于 MC 1.17)', value: '16' },
    { label: 'Java 8  (适用于 MC 1.7 - 1.16)', value: '8' },
  ];

  const providerOptions = [
    { label: 'Adoptium (推荐 / 官方)', value: 'adoptium' },
    { label: 'Zulu (备用镜像)', value: 'zulu', disabled: true }, 
  ];

  if (isChecking || !needsSetup) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center font-minecraft"
        >
          <motion.div 
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className="bg-[#18181B] border-2 border-ore-gray-border w-[540px] p-8 shadow-2xl flex flex-col items-center relative overflow-hidden"
          >
            {/* ==================== 界面 1：目录选择 ==================== */}
            {step === 'directory' && (
              <>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-ore-green/20 blur-3xl pointer-events-none" />
                <ShieldCheck size={48} className="text-ore-green mb-4 relative z-10" />
                <h2 className="text-2xl text-white mb-2 relative z-10">初始化数据目录</h2>
                <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
                  我们需要一个专用的文件夹来存放您的游戏核心与实例。<br/>
                  可以是一个<span className="text-white font-bold">全新空目录</span>，也可选择<span className="text-white font-bold">已有的 PiLauncher 旧目录</span>以恢复数据。<br/>
                  <span className="text-red-400 font-bold">请注意：路径中绝对不能包含中文！</span>
                </p>

                <div className="flex w-full space-x-2 mb-6 relative z-10">
                  <input 
                    type="text" 
                    value={basePath}
                    onChange={(e) => setBasePath(e.target.value)}
                    placeholder="请点击浏览按钮选择纯英文目录 ->"
                    className="flex-1 bg-[#141415] border border-ore-gray-border text-white px-3 py-2 outline-none focus:border-ore-green transition-colors"
                  />
                  {/* ✅ 改为唤起我们自己的弹窗 */}
                  <OreButton onClick={() => setShowBrowser(true)} variant="secondary" size="auto">
                    <FolderOpen size={16} className="mr-2" /> 浏览
                  </OreButton>
                </div>

                <OreButton onClick={handleConfirmDirectory} variant="primary" size="full" className="relative z-10">
                  确认并下一步
                </OreButton>
              </>
            )}

            {/* ==================== 界面 2：Java 下载 ==================== */}
            {step === 'java_download' && (
              <>
                {/* 保持你原本的 Java 下载界面不变 */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-blue-500/20 blur-3xl pointer-events-none" />
                <Coffee size={48} className="text-blue-400 mb-4 relative z-10" />
                <h2 className="text-2xl text-white mb-2 relative z-10">未检测到 Java 环境</h2>
                <p className="text-ore-text-muted text-sm leading-relaxed mb-6 relative z-10 text-center">
                  我们发现您的电脑中似乎没有安装 Java。<br/>
                  请选择您想玩的 Minecraft 版本，我们将为您自动下载并配置对应的运行时。
                </p>

                <div className="w-full space-y-4 mb-6 relative z-10 text-left">
                  <div>
                    <label className="text-xs text-ore-text-muted mb-1 block">目标 Minecraft 版本：</label>
                    <OreDropdown options={javaOptions} value={javaVersion} onChange={setJavaVersion} className="w-full"/>
                  </div>
                  <div>
                    <label className="text-xs text-ore-text-muted mb-1 block">下载源 (Provider)：</label>
                    <OreDropdown options={providerOptions} value={javaProvider} onChange={setJavaProvider} className="w-full"/>
                  </div>
                </div>

                <div className="flex w-full space-x-3 relative z-10">
                  <OreButton onClick={() => setNeedsSetup(false)} variant="ghost" size="auto" className="flex-1">
                    跳过，稍后手动安装
                  </OreButton>
                  <OreButton onClick={handleDownloadJava} variant="primary" size="auto" className="flex-1 bg-blue-600 hover:bg-blue-500 !border-blue-700">
                    <Download size={16} className="mr-2" /> 自动下载
                  </OreButton>
                </div>
              </>
            )}

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
        </motion.div>
      </AnimatePresence>

      {/* ✅ 在最顶层渲染专属目录选择器 */}
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