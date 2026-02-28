// /src/features/Setup/components/SetupWizard.tsx
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderOpen, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useSettingsStore } from '../../../store/useSettingsStore';

export const SetupWizard: React.FC = () => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  //获取更新 general 设置的方法
  const updateGeneralSetting = useSettingsStore(state => state.updateGeneralSetting);
  // 每次启动时检查是否配置了基础目录
  useEffect(() => {
    invoke<string | null>('get_base_directory')
      .then((res) => {
        if (!res) {
          setNeedsSetup(true);
        } else {
          // 如果后端已经有路径，顺手同步给前端 Store（做个保险）
          updateGeneralSetting('basePath', res);
        }
      })
      .catch(console.error)
      .finally(() => setIsChecking(false));
  }, [updateGeneralSetting]);

  const handleSelectFolder = async () => {
    setError(null);
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择 PiLauncher 数据存放目录'
      });

      if (selectedPath && typeof selectedPath === 'string') {
        // 调用后端校验并初始化目录结构 (这会在 meta.json 里打个路标)
        await invoke('set_base_directory', { path: selectedPath });
        
        // ✅ 3. 核心：同步写入前端 Zustand！
        // 因为你之前在 useSettingsStore 里写了 tauriStorage，
        // 这一步会自动把包含 basePath 的全新 JSON 发给后端，保存到 settings.json 中！
        updateGeneralSetting('basePath', selectedPath);
        
        // 成功后关闭弹窗
        setNeedsSetup(false);
      }
    } catch (err: any) {
      setError(String(err));
    }
  };

  if (isChecking || !needsSetup) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center font-minecraft"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
          className="bg-[#18181B] border-2 border-ore-gray-border w-[500px] p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden"
        >
          {/* 装饰性光晕 */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-ore-green/20 blur-3xl pointer-events-none" />

          <ShieldCheck size={48} className="text-ore-green mb-4 relative z-10" />
          <h2 className="text-2xl text-white mb-2 relative z-10">欢迎使用 PiLauncher</h2>
          <p className="text-ore-text-muted text-sm leading-relaxed mb-8 relative z-10">
            为了实现最佳的便携性与数据隔离，我们需要一个专用的文件夹来存放您的游戏核心、实例以及配置文件。
            <br/><br/>
            <span className="text-white">请选择或新建一个完全空白的文件夹。</span>
          </p>

          <button 
            onClick={handleSelectFolder}
            className="w-full bg-ore-green hover:bg-ore-green/90 text-[#18181B] font-bold py-3 px-4 flex items-center justify-center transition-all hover:scale-[1.02] relative z-10"
          >
            <FolderOpen size={18} className="mr-2" />
            浏览并选择空白目录
          </button>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 w-full bg-red-500/10 border border-red-500/50 p-3 flex items-start text-red-400 text-xs text-left"
              >
                <AlertTriangle size={14} className="mr-2 shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};