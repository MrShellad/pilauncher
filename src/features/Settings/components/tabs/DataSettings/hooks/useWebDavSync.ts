import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import { useLibraryStore } from '../../../../../../stores/useLibraryStore';
import type { WebDavSettings } from '../../../../../../types/settings';
import type { UpdateGeneralSetting, WebDavFavoriteSyncResult } from '../types';

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
});

export const useWebDavSync = ({ config, deviceId, updateGeneralSetting }: UseWebDavSyncOptions) => {
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<WebDavSettings>(() => normalizeConfig(config));
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<WebDavFavoriteSyncResult | null>(null);
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

  const syncFavorites = useCallback(async () => {
    const normalized = save();
    if (!normalized.syncFavorites) return;

    setIsSyncing(true);
    setError('');
    setSyncResult(null);
    try {
      const result = await invoke<WebDavFavoriteSyncResult>('sync_webdav_favorites', {
        config: {
          baseUrl: normalized.address,
          username: normalized.username,
          password: normalized.password,
          deviceId,
        },
      });
      setSyncResult(result);
      await initializeLibrary();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsSyncing(false);
    }
  }, [deviceId, initializeLibrary, save]);

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
    syncFavorites,
  };
};
