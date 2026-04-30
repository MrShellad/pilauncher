// src/features/Setup/hooks/useSetupWizard.ts
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '../store/useSettingsStore';
// ✅ 移除了对 setFocus 的引入

export const CURRENT_EULA_DATE = '2026-04-12';

export const useSetupWizard = () => {
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<'directory' | 'java_download' | 'steam_integration' | 'legal_agreement'>('directory');
  const [basePath, setBasePath] = useState('');
  const [showBrowser, setShowBrowser] = useState(false);
  
  const [javaVersion, setJavaVersion] = useState('21');
  const [javaProvider, setJavaProvider] = useState('adoptium');

  const [isRegistering, setIsRegistering] = useState(false);
  const [registerSuccess, setRegisterSuccess] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isGamepadMode, setIsGamepadMode] = useState(false);

  const updateGeneralSetting = useSettingsStore(state => state.updateGeneralSetting);
  const updateGameSetting = useSettingsStore(state => state.updateGameSetting);
  const hasHydrated = useSettingsStore(state => state._hasHydrated);

  // 1. 初始化检查
  useEffect(() => {
    if (!hasHydrated) return;

    invoke<string | null>('get_base_directory')
      .then((res) => {
        const { settings } = useSettingsStore.getState();
        const eulaNeedsUpdate = settings.general.lastAgreedLegalDate !== CURRENT_EULA_DATE;

        if (!res || eulaNeedsUpdate) {
          setNeedsSetup(true);
          if (res) {
            // 如果 basePath 已有，说明仅是因为协议没签，直接跳到协议那一步
            setStep('legal_agreement');
            updateGeneralSetting('basePath', res);
          }
        } else {
          updateGeneralSetting('basePath', res);
        }
      })
      .catch(console.error)
      .finally(() => setIsChecking(false));
  }, [updateGeneralSetting, hasHydrated]);

  // ✅ 彻底删除了原本在这里的 “焦点自动分发器” useEffect 
  // 现在这个 Hook 只负责纯粹的业务逻辑和状态机！

  // 2. 目录步骤逻辑
  const handleSelectPath = (path: string) => {
    setBasePath(path);
    setShowBrowser(false);
    setError(null);
  };

  const checkAndTransition = async () => {
      try {
          const isGamepad = await invoke<boolean>('check_steamos_gamepad_mode');
          setIsGamepadMode(isGamepad);
          const hasSteam = await invoke<boolean>('check_steam_status');
          if (hasSteam) {
              setStep('steam_integration');
          } else {
              setStep('legal_agreement');
          }
      } catch {
          setStep('legal_agreement');
      }
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
        await checkAndTransition();
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
      await checkAndTransition();
    } catch (err: any) {
      setError(String(err));
    }
  };

  const handleSkipJava = async () => {
      await checkAndTransition();
  };

  // 4. Steam Integration Logic
  const handleRegisterSteam = async () => {
      setIsRegistering(true);
      setRegisterError(null);
      try {
          const success = await invoke<boolean>('register_steam_shortcut');
          if (success) {
              setRegisterSuccess(true);
          } else {
              setRegisterError("未能注册快捷方式 (可能是未配置 Steam 或找不到路径)。您可以直接跳过。");
          }
      } catch (err: any) {
          setRegisterError(String(err));
      } finally {
          setIsRegistering(false);
      }
  };

  const setGamepadModeSettings = () => {
      updateGeneralSetting('closeBehavior', 'exit');
      updateGameSetting('steamDeckKeymap', true);
  };

  const finishSteamIntegration = () => {
      setStep('legal_agreement');
  };

  const finalizeSetup = () => {
      updateGeneralSetting('lastAgreedLegalDate', CURRENT_EULA_DATE);
      setNeedsSetup(false);
  };

  return {
    needsSetup, setNeedsSetup, isChecking, error, step,
    basePath, setBasePath, showBrowser, setShowBrowser,
    javaVersion, setJavaVersion, javaProvider, setJavaProvider,
    isRegistering, registerSuccess, registerError, isGamepadMode,
    handleSelectPath, handleConfirmDirectory, handleDownloadJava, handleSkipJava,
    handleRegisterSteam, setGamepadModeSettings, finishSteamIntegration, finalizeSetup
  };
};
