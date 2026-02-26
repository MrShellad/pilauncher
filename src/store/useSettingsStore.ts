// /src/store/useSettingsStore.ts
import { create } from 'zustand';

import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { invoke } from '@tauri-apps/api/core';

import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

// ✅ 1. 定义与 Rust 后端通信的自定义存储引擎
const tauriStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      // 从后端读取 settings.json
      const data = await invoke<any>('get_settings');
      if (!data || Object.keys(data).length === 0) {
        return null; // 返回 null，Zustand 会自动使用初始状态 (DEFAULT_SETTINGS)
      }
      return JSON.stringify(data);
    } catch (error) {
      console.error("读取本地配置失败:", error);
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      // 每次状态改变，Zustand 会调用这里，我们将整个对象发给后端保存
      await invoke('save_settings', { settings: JSON.parse(value) });
    } catch (error) {
      console.error("写入本地配置失败:", error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    // 可选实现：如果需要在恢复默认设置时彻底删除文件
  }
};

interface SettingsStore {
  settings: AppSettings;
  updateGeneralSetting: <K extends keyof AppSettings['general']>(key: K, value: AppSettings['general'][K]) => void;
  updateAppearanceSetting: <K extends keyof AppSettings['appearance']>(key: K, value: AppSettings['appearance'][K]) => void;
  resetSettings: () => void;
  // 添加一个 hydrated 状态，供应用判断配置是否从硬盘加载完毕
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
        set((state) => ({
          settings: {
            ...state.settings,
            general: {
              ...state.settings.general,
              [key]: value
            }
          },
        })),
      updateAppearanceSetting: (key, value) => 
        set((state) => ({
          settings: {
            ...state.settings,
            appearance: {
              ...state.settings.appearance,
              [key]: value
            }
          }
        })),

      resetSettings: () => set({ settings: DEFAULT_SETTINGS }),
    }),
    {
      name: 'pilauncher-settings-storage', // 这个名字对应 JSON 里的顶层键
      storage: createJSONStorage(() => tauriStorage), // ✅ 2. 挂载我们自定义的 Tauri 物理引擎
      onRehydrateStorage: () => (state) => {
        // 当从硬盘异步读取完毕后触发
        state?.setHasHydrated(true);
      },
    }
  )
);