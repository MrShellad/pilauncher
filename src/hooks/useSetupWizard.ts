// src/features/Setup/hooks/useSetupWizard.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/useSettingsStore';
// ✅ 移除了对 setFocus 的引入

export const useSetupWizard = () => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<'directory' | 'java_download'>('directory');
  const [basePath, setBasePath] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  
  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState('adoptium');

  const updateGeneralSetting = useSettingsStore(state => state.updateGeneralSetting);

  // 1. 初始化检查
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

  // ✅ 彻底删除了原本在这里的 “焦点自动分发器” useEffect 
  // 现在这个 Hook 只负责纯粹的业务逻辑和状态机！

  // 2. 目录步骤逻辑
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

  // 3. Java 步骤逻辑
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

  return {
    needsSetup, setNeedsSetup, isChecking, error, step,
    basePath, setBasePath, showBrowser, setShowBrowser,
    javaVersion, setJavaVersion, javaProvider, setJavaProvider,
    handleSelectPath, handleConfirmDirectory, handleDownloadJava
  };
};