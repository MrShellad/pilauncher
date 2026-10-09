import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { useLibraryStore } from '@/features/library';

const INTERVALS_MS = {
  '3h': 3 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '3d': 3 * 24 * 60 * 60 * 1000,
  '5d': 5 * 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

export const useWebDavAutoSync = () => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const isSyncingRef = useRef(false);

  const webDav = settings.general.webDav;
  const address = webDav?.address?.trim();
  const autoSyncInterval = webDav?.autoSyncInterval || '1d';
  const syncFavorites = webDav?.syncFavorites;
  const syncSkinAssets = webDav?.syncSkinAssets;
  const syncSaveBackups = webDav?.syncSaveBackups;
  const saveBackupMode = webDav?.saveBackupMode || 'backup';
  const username = webDav?.username?.trim();
  const password = webDav?.password;
  const deviceId = settings.general.deviceId;

  useEffect(() => {
    if (autoSyncInterval === 'off' || !address) return;
    if (!syncFavorites && !syncSkinAssets && !syncSaveBackups) return;

    const intervalMs = INTERVALS_MS[autoSyncInterval as keyof typeof INTERVALS_MS] || INTERVALS_MS['1d'];

    const performSync = async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        console.log('[WebDAV AutoSync] Starting auto sync...');
        const config = {
          baseUrl: address,
          username,
          password,
          deviceId,
          saveBackupMode,
        };

        if (syncFavorites) {
          await invoke('sync_webdav_favorites', { config });
          await initializeLibrary();
        }

        if (syncSkinAssets) {
          await invoke('sync_webdav_skin_assets', { config });
        }

        if (syncSaveBackups) {
          await invoke('sync_webdav_save_backups', { config });
        }

        console.log('[WebDAV AutoSync] Auto sync completed successfully');
        const currentWebDav = useSettingsStore.getState().settings.general.webDav;
        updateGeneralSetting('webDav', {
          ...currentWebDav,
          lastSyncTime: Date.now(),
        });
      } catch (err) {
        console.error('[WebDAV AutoSync] Auto sync failed:', err);
      } finally {
        isSyncingRef.current = false;
      }
    };

    // Check immediately on mount/update
    const currentLastSync = useSettingsStore.getState().settings.general.webDav.lastSyncTime || 0;
    if (Date.now() - currentLastSync >= intervalMs) {
      void performSync();
    }

    // Set up check interval every 1 minute
    const checkInterval = setInterval(() => {
      const currentLastSyncTime = useSettingsStore.getState().settings.general.webDav.lastSyncTime || 0;
      if (Date.now() - currentLastSyncTime >= intervalMs) {
        void performSync();
      }
    }, 60 * 1000);

    return () => clearInterval(checkInterval);
  }, [
    address,
    autoSyncInterval,
    syncFavorites,
    syncSkinAssets,
    syncSaveBackups,
    saveBackupMode,
    username,
    password,
    deviceId,
    updateGeneralSetting,
    initializeLibrary,
  ]);
};
