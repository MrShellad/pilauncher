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
  // 声明更新通用设置的方法
  updateGeneralSetting: <K extends keyof AppSettings['general']>(key: K, value: AppSettings['general'][K]) => void;
  // 声明更新外观设置的方法
  updateAppearanceSetting: <K extends keyof AppSettings['appearance']>(key: K, value: AppSettings['appearance'][K]) => void;
  // 声明更新游戏设置的方法
  updateGameSetting: <K extends keyof AppSettings['game']>(key: K, value: AppSettings['game'][K]) => void;
  // 声明更新 Java 设置的方法
  updateJavaSetting: <K extends keyof AppSettings['java']>(key: K, value: AppSettings['java'][K]) => void;
  // 声明更新下载设置的方法
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
      // ✅ 1. 实现更新通用设置的方法
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
        // ✅ 2. 实现更新外观设置的方法
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

      // ✅ 3. 实现更新 Java 设置的方法
      updateJavaSetting: (key, value) => 
        set((state) => ({
          settings: {
            ...state.settings,
            java: {
              // 防御性展开：如果 java 不存在，先展开默认值，再覆盖新修改的值
              ...(state.settings.java || DEFAULT_SETTINGS.java),
              [key]: value
            }
          }
        })),
        // ✅ 4. 实现更新 Game 设置的方法
      updateGameSetting: (key, value) => 
    set((state) => ({
      settings: {
        ...state.settings,
        game: {
          ...(state.settings.game || DEFAULT_SETTINGS.game),
          [key]: value
        }
      }
    })),
    // ✅ 5. 实现更新下载设置的方法
    updateDownloadSetting: (key, value) => 
    set((state) => ({
      settings: {
        ...state.settings,
        download: {
          ...(state.settings.download || DEFAULT_SETTINGS.download),
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