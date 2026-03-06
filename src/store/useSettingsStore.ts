// /src/store/useSettingsStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// 定义与 Rust 后端通信的自定义存储引擎
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
      // ✅ 核心修复：拦截浅合并，执行深层合并，保证新增加的 java 等默认节点强制写入！
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
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);