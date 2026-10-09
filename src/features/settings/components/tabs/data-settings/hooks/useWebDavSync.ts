import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';
import i18n from '../../../../../../ui/i18';

import { useLibraryStore } from '@/features/library';
import type { WebDavSettings } from '../../../../../../types/settings';
import type {
  UpdateGeneralSetting,
  WebDavFavoriteSyncResult,
  WebDavSaveBackupSyncResult,
  WebDavSkinSyncResult,
  WebDavSyncResult,
} from '../types';

interface UseWebDavSyncOptions {
  config: WebDavSettings;
  deviceId: string;
  updateGeneralSetting: UpdateGeneralSetting;
}

const normalizeConfig = (config: WebDavSettings): WebDavSettings => ({
  address: config.address.trim(),
  username: config.username.trim(),
  password: config.password,
  syncFavorites: config.syncFavorites,
  syncSkinAssets: config.syncSkinAssets ?? true,
  syncSaveBackups: config.syncSaveBackups ?? false,
  saveBackupMode: config.saveBackupMode || 'backup',
  autoSyncInterval: config.autoSyncInterval || '1d',
  lastSyncTime: config.lastSyncTime,
});

export const useWebDavSync = ({ config, deviceId, updateGeneralSetting }: UseWebDavSyncOptions) => {
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<WebDavSettings>(() => normalizeConfig(config));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<WebDavSyncResult | null>(null);
  const [error, setError] = useState('');

  const open = useCallback(() => {
    setDraft(normalizeConfig(config));
    setSyncResult(null);
    setError('');
    setIsOpen(true);
  }, [config]);

  const close = useCallback(() => {
    if (isSyncing) return;
    setIsOpen(false);
    setTimeout(() => setFocus('settings-data-webdav'), 50);
  }, [isSyncing]);

  const updateDraft = useCallback((patch: Partial<WebDavSettings>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);

  const save = useCallback(() => {
    const normalized = normalizeConfig(draft);
    updateGeneralSetting('webDav', normalized);
    setDraft(normalized);
    return normalized;
  }, [draft, updateGeneralSetting]);

  const sync = useCallback(async () => {
    const normalized = save();
    if (!normalized.syncFavorites && !normalized.syncSkinAssets && !normalized.syncSaveBackups) {
      setError(i18n.t('settings.data.webdav.noItemsEnabled'));
      return;
    }

    setIsSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const config = {
        baseUrl: normalized.address,
        username: normalized.username,
        password: normalized.password,
        deviceId,
        saveBackupMode: normalized.saveBackupMode,
      };
      const nextResult: WebDavSyncResult = {};

      if (normalized.syncFavorites) {
        nextResult.favorites = await invoke<WebDavFavoriteSyncResult>('sync_webdav_favorites', {
          config,
        });
        await initializeLibrary();
      }

      if (normalized.syncSkinAssets) {
        nextResult.skins = await invoke<WebDavSkinSyncResult>('sync_webdav_skin_assets', {
          config,
        });
      }

      if (normalized.syncSaveBackups) {
        nextResult.saveBackups = await invoke<WebDavSaveBackupSyncResult>('sync_webdav_save_backups', {
          config,
        });
      }

      const updatedWebDav = {
        ...normalized,
        lastSyncTime: Date.now(),
      };
      updateGeneralSetting('webDav', updatedWebDav);
      setDraft(updatedWebDav);

      setSyncResult(nextResult);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsSyncing(false);
    }
  }, [deviceId, initializeLibrary, save, updateGeneralSetting]);

  return {
    isOpen,
    draft,
    isSyncing,
    syncResult,
    error,
    open,
    close,
    updateDraft,
    save,
    sync,
  };
};
