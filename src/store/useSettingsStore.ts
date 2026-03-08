// /src/store/useSettingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const tauriStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const data = await invoke<any>('get_settings');
      if (!data || Object.keys(data).length === 0) return null; 
      return JSON.stringify(data);
    } catch (error) {
      console.error("读取本地配置失败:", error);
      return null;
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await invoke('save_settings', { settings: JSON.parse(value) });
    } catch (error) {
      console.error("写入本地配置失败:", error);
    }
  },
  removeItem: async (_name: string): Promise<void> => {}
};

interface SettingsStore {
  settings: AppSettings;
  updateGeneralSetting: <K extends keyof AppSettings['general']>(key: K, value: AppSettings['general'][K]) => void;
  updateAppearanceSetting: <K extends keyof AppSettings['appearance']>(key: K, value: AppSettings['appearance'][K]) => void;
  updateGameSetting: <K extends keyof AppSettings['game']>(key: K, value: AppSettings['game'][K]) => void;
  updateJavaSetting: <K extends keyof AppSettings['java']>(key: K, value: AppSettings['java'][K]) => void;
  updateDownloadSetting: <K extends keyof AppSettings['download']>(key: K, value: AppSettings['download'][K]) => void;
  resetSettings: () => void;
  _hasHydrated: boolean; 
  setHasHydrated: (state: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      
      updateGeneralSetting: (key, value) => 
        set((state) => ({ settings: { ...state.settings, general: { ...state.settings.general, [key]: value } } })),
        
      updateAppearanceSetting: (key, value) => 
        set((state) => ({ settings: { ...state.settings, appearance: { ...state.settings.appearance, [key]: value } } })),

      updateJavaSetting: (key, value) => 
        set((state) => ({ settings: { ...state.settings, java: { ...state.settings.java, [key]: value } } })),
        
      updateGameSetting: (key, value) => 
        set((state) => ({ settings: { ...state.settings, game: { ...state.settings.game, [key]: value } } })),
        
      updateDownloadSetting: (key, value) => 
        set((state) => ({ settings: { ...state.settings, download: { ...state.settings.download, [key]: value } } })),
        
      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'pilauncher-settings-storage',
      storage: createJSONStorage(() => tauriStorage),
      merge: (persistedState: any, currentState: SettingsStore) => {
        if (!persistedState) return currentState;
        return {
          ...currentState,
          ...persistedState,
          settings: {
            ...currentState.settings,
            ...(persistedState.settings || {}),
            general: { ...currentState.settings.general, ...persistedState.settings?.general },
            appearance: { ...currentState.settings.appearance, ...persistedState.settings?.appearance },
            java: { ...currentState.settings.java, ...persistedState.settings?.java },
            game: { ...currentState.settings.game, ...persistedState.settings?.game },
            download: { ...currentState.settings.download, ...persistedState.settings?.download },
          },
          _hasHydrated: persistedState._hasHydrated,
        };
      },
      // ✅ 核心注入点：在配置唤醒时安全生成 UUID 与设备名
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state && (!state.settings.general.deviceName || !state.settings.general.deviceId)) {
          (async () => {
            try {
              // 1. 生成唯一隐藏 UUID
              const deviceId = state.settings.general.deviceId || crypto.randomUUID();
              
              // 2. 根据系统环境生成专属设备名
              let deviceName = state.settings.general.deviceName;
              if (!deviceName) {
                let os = 'Unknown';
                const ua = navigator.userAgent.toLowerCase();
                if (ua.includes('win')) os = 'Windows';
                else if (ua.includes('mac')) os = 'Mac';
                else if (ua.includes('linux')) os = 'Linux';

                // 探测 SteamDeck 专属标识
                try {
                  const isSteamDeck = await invoke<boolean>('check_steam_deck');
                  if (isSteamDeck) os = 'SteamDeck';
                } catch (e) {}

                // 生成三位混合随机码
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let randomCode = '';
                for (let i = 0; i < 3; i++) randomCode += chars.charAt(Math.floor(Math.random() * chars.length));

                deviceName = `Pi-${os}-${randomCode}`;
              }

              // 3. 回写到配置中保存
              state.updateGeneralSetting('deviceId', deviceId);
              state.updateGeneralSetting('deviceName', deviceName);
            } catch (e) {
              console.error("生成设备标识信息失败:", e);
            }
          })();
        }
      },
    }
  )
);