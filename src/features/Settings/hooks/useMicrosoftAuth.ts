// src/features/Settings/hooks/useMicrosoftAuth.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import { useAccountStore, type MinecraftAccount } from '../../../store/useAccountStore';

export interface DeviceCodeInfo {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
}

export const useMicrosoftAuth = () => {
  const addAccount = useAccountStore(state => state.addAccount);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginStatusMsg, setLoginStatusMsg] = useState("");

  const startMicrosoftLogin = async () => {
    setIsLoginModalOpen(true);
    setIsLoading(true);
    setDeviceCodeInfo(null);
    setLoginStatusMsg("等待浏览器授权中...");

    try {
      const info = await invoke<DeviceCodeInfo>('request_microsoft_device_code');
      setDeviceCodeInfo(info);
      setIsLoading(false); 
      
      setLoginStatusMsg("正在后台静默等待授权与换牌 (不要关闭弹窗)...");
      const accountData = await invoke<MinecraftAccount>('poll_and_exchange_microsoft_token', {
        deviceCode: info.device_code, 
        interval: info.interval
      });

      addAccount(accountData);
      setIsLoginModalOpen(false); 
    } catch (err: any) {
      setLoginStatusMsg(`登录失败: ${err}`);
    }
  };

  const copyCodeAndOpen = async () => {
    if (!deviceCodeInfo) return;
    await navigator.clipboard.writeText(deviceCodeInfo.user_code);
    await openShell(deviceCodeInfo.verification_uri);
  };

  return {
    isLoginModalOpen, setIsLoginModalOpen,
    deviceCodeInfo, isLoading, loginStatusMsg,
    startMicrosoftLogin, copyCodeAndOpen
  };
};