import { invoke } from '@tauri-apps/api/core';
import { message } from '@tauri-apps/plugin-dialog';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';

import { autoScanAndFillJava } from '../features/runtime/logic/javaDetector';
import type { AppSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

const TRACKED_JAVA_MAJORS = ['8', '11', '16', '17', '21', '25'] as const;

const normalizeJavaPath = (value?: string) => (value || '').trim();

const hasStoredJavaSnapshot = (
  javaPath: string,
  majorJavaPaths: Record<string, string>
) => {
  if (normalizeJavaPath(javaPath)) return true;
  return TRACKED_JAVA_MAJORS.some((major) => normalizeJavaPath(majorJavaPaths[major]));
};

const hasJavaSelectionChanged = (
  prevJavaPath: string,
  prevMajorJavaPaths: Record<string, string>,
  nextJavaPath: string,
  nextMajorJavaPaths: Record<string, string>
) => {
  if (normalizeJavaPath(prevJavaPath) !== normalizeJavaPath(nextJavaPath)) return true;
  return TRACKED_JAVA_MAJORS.some(
    (major) =>
      normalizeJavaPath(prevMajorJavaPaths[major]) !== normalizeJavaPath(nextMajorJavaPaths[major])
  );
};

const tauriStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const data = await invoke<any>('get_settings');
      if (!data || Object.keys(data).length === 0) return null;
      return JSON.stringify(data);
    } catch (error) {
      console.error('读取本地配置失败:', error);
      return null;
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      await invoke('save_settings', { settings: JSON.parse(value) });
    } catch (error) {
      console.error('写入本地配置失败:', error);
    }
  },
  removeItem: async (_name: string): Promise<void> => {}
};

interface SettingsStore {
  settings: AppSettings;
  updateGeneralSetting: <K extends keyof AppSettings['general']>(
    key: K,
    value: AppSettings['general'][K]
  ) => void;
  updateAppearanceSetting: <K extends keyof AppSettings['appearance']>(
    key: K,
    value: AppSettings['appearance'][K]
  ) => void;
  updateGameSetting: <K extends keyof AppSettings['game']>(
    key: K,
    value: AppSettings['game'][K]
  ) => void;
  updateJavaSetting: <K extends keyof AppSettings['java']>(
    key: K,
    value: AppSettings['java'][K]
  ) => void;
  updateDownloadSetting: <K extends keyof AppSettings['download']>(
    key: K,
    value: AppSettings['download'][K]
  ) => void;
  triggerJavaAutoDetect: (options?: {
    notifyIfChanged?: boolean;
    source?: 'startup' | 'toggle' | 'download' | 'manual';
  }) => Promise<{
    changed: boolean;
    hasPreviousSnapshot: boolean;
    shouldNotifyChange: boolean;
  } | null>;
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
        set((state) => ({
          settings: { ...state.settings, general: { ...state.settings.general, [key]: value } }
        })),

      updateAppearanceSetting: (key, value) =>
        set((state) => ({
          settings: {
            ...state.settings,
            appearance: { ...state.settings.appearance, [key]: value }
          }
        })),

      updateJavaSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, java: { ...state.settings.java, [key]: value } }
        })),

      updateGameSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, game: { ...state.settings.game, [key]: value } }
        })),

      updateDownloadSetting: (key, value) =>
        set((state) => ({
          settings: { ...state.settings, download: { ...state.settings.download, [key]: value } }
        })),

      triggerJavaAutoDetect: async (options) => {
        const { settings, updateJavaSetting } = (useSettingsStore as any).getState() as SettingsStore;
        if (!settings.java.autoDetect) return null;

        const prevMajorJavaPaths = { ...settings.java.majorJavaPaths };
        const prevJavaPath = settings.java.javaPath;
        const hasPreviousSnapshot = hasStoredJavaSnapshot(prevJavaPath, prevMajorJavaPaths);

        try {
          const result = await autoScanAndFillJava(prevMajorJavaPaths);
          if (!result) return { changed: false, hasPreviousSnapshot, shouldNotifyChange: false };

          const nextMajorJavaPaths = result.hasAnyMatch ? result.majorJavaPaths : prevMajorJavaPaths;
          const nextJavaPath = result.javaPath || prevJavaPath;
          const changed = hasJavaSelectionChanged(
            prevJavaPath,
            prevMajorJavaPaths,
            nextJavaPath,
            nextMajorJavaPaths
          );
          const shouldNotifyChange = !!(options?.notifyIfChanged && changed && hasPreviousSnapshot);

          if (result.hasAnyMatch) {
            updateJavaSetting('majorJavaPaths', nextMajorJavaPaths);
          }
          if (nextJavaPath) {
            updateJavaSetting('javaPath', nextJavaPath);
          }

          if (options?.notifyIfChanged && changed && hasPreviousSnapshot) {
            await message(
              '检测到 Java 环境有变更，请检查 Java 设置中的路径是否仍符合你的版本需求。',
              { title: 'Java 环境变更', kind: 'warning' }
            );
          }

          return { changed, hasPreviousSnapshot, shouldNotifyChange };
        } catch (e) {
          console.error('静默 Java 自动检测失败:', e);
          return { changed: false, hasPreviousSnapshot, shouldNotifyChange: false };
        }
      },

      resetSettings: () => set({ settings: DEFAULT_SETTINGS })
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
            appearance: {
              ...currentState.settings.appearance,
              ...persistedState.settings?.appearance
            },
            java: { ...currentState.settings.java, ...persistedState.settings?.java },
            game: { ...currentState.settings.game, ...persistedState.settings?.game },
            download: { ...currentState.settings.download, ...persistedState.settings?.download }
          },
          _hasHydrated: persistedState._hasHydrated
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state && (!state.settings.general.deviceName || !state.settings.general.deviceId)) {
          (async () => {
            try {
              const deviceId = state.settings.general.deviceId || crypto.randomUUID();

              let deviceName = state.settings.general.deviceName;
              if (!deviceName) {
                let os = 'Unknown';
                const ua = navigator.userAgent.toLowerCase();
                if (ua.includes('win')) os = 'Windows';
                else if (ua.includes('mac')) os = 'Mac';
                else if (ua.includes('linux')) os = 'Linux';

                try {
                  const isSteamDeck = await invoke<boolean>('check_steam_deck');
                  if (isSteamDeck) os = 'SteamDeck';
                } catch {}

                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                let randomCode = '';
                for (let i = 0; i < 3; i += 1) {
                  randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
                }

                deviceName = `Pi-${os}-${randomCode}`;
              }

              state.updateGeneralSetting('deviceId', deviceId);
              state.updateGeneralSetting('deviceName', deviceName);
            } catch (e) {
              console.error('生成设备标识信息失败:', e);
            }
          })();
        }
      }
    }
  )
);
