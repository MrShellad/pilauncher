import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { useTranslation } from 'react-i18next';

import { useLibraryStore } from '../../../stores/useLibraryStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import type { WebDavFavoriteSyncResult } from '../../../types/webdav';
import { useModSetTrackerStore } from '../stores/useModSetTrackerStore';
import type {
  LibraryImportDraft,
  LibraryImportOptions,
  LibraryImportPreview,
  LibraryImportResult,
} from '../logic/libraryBackup';

const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

interface UseLibraryBackupOptions {
  onMessage: (message: string) => void;
}

export interface LibraryWebDavSyncRecord {
  id: string;
  createdAt: number;
  status: 'success' | 'error';
  result?: WebDavFavoriteSyncResult;
  error?: string;
}

const LIBRARY_WEBDAV_SYNC_HISTORY_KEY = 'pilauncher-library-webdav-sync-history';
const LIBRARY_WEBDAV_SYNC_HISTORY_LIMIT = 24;

const readSyncHistory = (): LibraryWebDavSyncRecord[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(LIBRARY_WEBDAV_SYNC_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((record): record is LibraryWebDavSyncRecord => (
      record &&
      typeof record.id === 'string' &&
      typeof record.createdAt === 'number' &&
      (record.status === 'success' || record.status === 'error')
    ));
  } catch {
    return [];
  }
};

export const useLibraryBackup = ({ onMessage }: UseLibraryBackupOptions) => {
  const { t } = useTranslation();
  const initializeLibrary = useLibraryStore((state) => state.initializeLibrary);
  const loadTrackers = useModSetTrackerStore((state) => state.loadTrackers);
  const settings = useSettingsStore((state) => state.settings);

  const [isBusy, setIsBusy] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isSyncingWebDav, setIsSyncingWebDav] = useState(false);
  const [syncHistory, setSyncHistory] = useState<LibraryWebDavSyncRecord[]>(() => readSyncHistory());
  const [importDraft, setImportDraft] = useState<LibraryImportDraft | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      LIBRARY_WEBDAV_SYNC_HISTORY_KEY,
      JSON.stringify(syncHistory.slice(0, LIBRARY_WEBDAV_SYNC_HISTORY_LIMIT)),
    );
  }, [syncHistory]);

  const appendSyncHistory = (record: LibraryWebDavSyncRecord) => {
    setSyncHistory((current) => [record, ...current].slice(0, LIBRARY_WEBDAV_SYNC_HISTORY_LIMIT));
  };

  const previewImport = async (path: string, options: LibraryImportOptions) => {
    setIsBusy(true);
    onMessage('');
    try {
      const preview = await invoke<LibraryImportPreview>('preview_library_import', { path, options });
      setImportDraft({ path, options, preview });
    } catch (error) {
      onMessage(t('libraryPage.backup.importPreviewFailed', { error: getErrorMessage(error) }));
    } finally {
      setIsBusy(false);
    }
  };

  const exportLibrary = async () => {
    if (isBusy) return;

    const date = new Date().toISOString().slice(0, 10);
    const path = await saveDialog({
      defaultPath: `pilauncher-library-${date}.json`,
      filters: [{ name: 'PiLauncher Library Backup', extensions: ['json'] }],
    });
    if (!path) return;

    setIsBusy(true);
    onMessage('');
    try {
      await invoke('export_library_data', { path });
      onMessage(t('libraryPage.backup.exportDone', { path }));
    } catch (error) {
      onMessage(t('libraryPage.backup.exportFailed', { error: getErrorMessage(error) }));
    } finally {
      setIsBusy(false);
    }
  };

  const openImportLibrary = async () => {
    if (isBusy) return;

    const selected = await openDialog({
      multiple: false,
      filters: [{ name: 'PiLauncher Library Backup', extensions: ['json'] }],
    });
    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) return;

    await previewImport(path, { mergeSameNameTags: true });
  };

  const toggleImportTagMerge = async () => {
    if (!importDraft || isBusy) return;
    await previewImport(importDraft.path, {
      mergeSameNameTags: !importDraft.options.mergeSameNameTags,
    });
  };

  const confirmImportLibrary = async () => {
    if (!importDraft || isBusy) return;

    setIsBusy(true);
    onMessage('');
    try {
      const result = await invoke<LibraryImportResult>('import_library_data', {
        path: importDraft.path,
        options: importDraft.options,
      });
      setImportDraft(null);
      await initializeLibrary();
      await loadTrackers();
      onMessage(
        t('libraryPage.backup.importDone', {
          starred: result.importedStarredItems,
          collections: result.importedCollections,
          relations: result.importedCollectionItems,
        }),
      );
    } catch (error) {
      onMessage(t('libraryPage.backup.importFailed', { error: getErrorMessage(error) }));
    } finally {
      setIsBusy(false);
    }
  };

  const closeImportPreview = () => {
    if (!isBusy) {
      setImportDraft(null);
    }
  };

  const openCloudModal = () => {
    setIsCloudModalOpen(true);
  };

  const closeCloudModal = () => {
    if (!isSyncingWebDav) {
      setIsCloudModalOpen(false);
    }
  };

  const syncWebDavFavorites = async () => {
    if (isSyncingWebDav) return;

    const webDav = settings.general.webDav;
    const normalizedAddress = webDav.address.trim();
    const normalizedUsername = webDav.username.trim();
    const createdAt = Date.now();

    if (!normalizedAddress) {
      appendSyncHistory({
        id: crypto.randomUUID(),
        createdAt,
        status: 'error',
        error: t('libraryPage.backup.webdavMissingAddress'),
      });
      return;
    }

    if (!webDav.syncFavorites) {
      appendSyncHistory({
        id: crypto.randomUUID(),
        createdAt,
        status: 'error',
        error: t('libraryPage.backup.webdavSyncDisabled'),
      });
      return;
    }

    setIsSyncingWebDav(true);
    try {
      const result = await invoke<WebDavFavoriteSyncResult>('sync_webdav_favorites', {
        config: {
          baseUrl: normalizedAddress,
          username: normalizedUsername,
          password: webDav.password,
          deviceId: settings.general.deviceId,
        },
      });

      appendSyncHistory({
        id: crypto.randomUUID(),
        createdAt,
        status: 'success',
        result,
      });
      await initializeLibrary();
    } catch (error) {
      appendSyncHistory({
        id: crypto.randomUUID(),
        createdAt,
        status: 'error',
        error: getErrorMessage(error),
      });
    } finally {
      setIsSyncingWebDav(false);
    }
  };

  return {
    isBusy,
    isCloudModalOpen,
    isSyncingWebDav,
    syncHistory,
    importDraft,
    closeImportPreview,
    openCloudModal,
    closeCloudModal,
    exportLibrary,
    openImportLibrary,
    syncWebDavFavorites,
    toggleImportTagMerge,
    confirmImportLibrary,
  };
};
