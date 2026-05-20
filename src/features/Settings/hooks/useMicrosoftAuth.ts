// src/features/Settings/hooks/useMicrosoftAuth.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openShell } from '@tauri-apps/plugin-shell';
import i18n from '../../../ui/i18';
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
    setLoginStatusMsg(i18n.t('settings.account.microsoft.waitingAuth'));

    try {
      const info = await invoke<DeviceCodeInfo>('request_microsoft_device_code');
      setDeviceCodeInfo(info);
      setIsLoading(false);

      setLoginStatusMsg(i18n.t('settings.account.microsoft.polling'));
      const rawAccount = await invoke<any>('poll_and_exchange_microsoft_token', {
        deviceCode: info.device_code,
        interval: info.interval
      });

      // ✅ 核心排错：打印 Rust 后端传来的原始 JSON
      console.log("[微软登录] Rust 返回的原始数据:", rawAccount);

      // 极其贪婪的提取逻辑
      const accountData: MinecraftAccount = {
        uuid: rawAccount.uuid || rawAccount.id || rawAccount.profileId || '',
        name: rawAccount.username || rawAccount.name || rawAccount.displayName || i18n.t('settings.account.card.unknownPlayer'),
        type: 'microsoft', // 既然从这里登录，就强行锁定为 microsoft 类型
        accessToken: rawAccount.access_token || rawAccount.accessToken || '',
        refreshToken: rawAccount.refresh_token || rawAccount.refreshToken || null,
        expiresAt: rawAccount.expires_at || rawAccount.expiresAt || null,
        skinUrl: rawAccount.skin_url || rawAccount.skinUrl || null,
        capeUrl: rawAccount.cape_url || rawAccount.capeUrl || null,
      };

      addAccount(accountData);
      setIsLoginModalOpen(false);
    } catch (err: any) {
      setLoginStatusMsg(i18n.t('settings.account.microsoft.loginFailed', { error: String(err) }));
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
