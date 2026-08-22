import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { exit } from '@tauri-apps/plugin-process';
import { setFocus } from '@noriginmedia/norigin-spatial-navigation';

import type { UpdateGeneralSetting } from '../types';

interface UseCoreDirectoryOptions {
  basePath: string;
  updateGeneralSetting: UpdateGeneralSetting;
}

interface BaseDirectoryMigrationJournal {
  status: 'prepared' | 'copying' | 'verifying' | 'committed' | 'failed';
  error?: string | null;
}

export const useCoreDirectory = ({ basePath, updateGeneralSetting }: UseCoreDirectoryOptions) => {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationWarning, setMigrationWarning] = useState<string | null>(null);

  const refreshMigrationStatus = useCallback(async () => {
    const journal = await invoke<BaseDirectoryMigrationJournal | null>('get_base_directory_migration_status');
    setMigrationWarning(journal?.status === 'failed' ? journal.error || t('settings.data.migrationInterrupted') : null);
  }, [t]);

  useEffect(() => {
    let cancelled = false;

    void invoke<BaseDirectoryMigrationJournal | null>('get_base_directory_migration_status')
      .then((journal) => {
        if (cancelled) return;
        setMigrationWarning(journal?.status === 'failed' ? journal.error || t('settings.data.migrationInterrupted') : null);
      })
      .catch(() => {
        if (!cancelled) setMigrationWarning(null);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  const openBrowser = useCallback(() => {
    if (isMigrating) return;
    setBrowserOpen(true);
  }, [isMigrating]);

  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    setTimeout(() => setFocus('settings-data-modify-dir'), 50);
  }, []);

  const handleDirectorySelected = useCallback(async (selectedPath: string) => {
    if (isMigrating) return;
    try {
      closeBrowser();

      if (!selectedPath || selectedPath === basePath) return;

      const wantsMove = await ask(t('settings.data.migrateConfirm'), {
        title: t('settings.data.migrateTitle'),
        kind: 'info'
      });

      setIsMigrating(true);
      await invoke('migrate_base_directory', { newPath: selectedPath, moveData: wantsMove });
      updateGeneralSetting('basePath', selectedPath);

      await message(t('settings.data.migrateSuccess'), {
        title: t('settings.data.migrateSuccessTitle'),
        kind: 'info'
      });
      await exit(0);
    } catch (e) {
      await refreshMigrationStatus().catch(() => undefined);
      await message(t('settings.data.migrateError', { error: e }), {
        title: t('settings.data.migrateErrorTitle'),
        kind: 'error'
      });
    } finally {
      setIsMigrating(false);
    }
  }, [basePath, closeBrowser, isMigrating, refreshMigrationStatus, t, updateGeneralSetting]);

  const openRenameModal = useCallback(() => {
    if (isMigrating) return;
    setNewName(basePath.split(/[\\/]/).pop() || '');
    setRenameOpen(true);
  }, [basePath, isMigrating]);

  const closeRenameModal = useCallback(() => {
    setRenameOpen(false);
    setTimeout(() => setFocus('settings-data-rename-dir'), 50);
  }, []);

  const submitRename = useCallback(async () => {
    if (isMigrating || !newName.trim()) {
      closeRenameModal();
      return;
    }

    try {
      setIsMigrating(true);
      await invoke('rename_base_directory', { newName });
      await message(t('settings.data.renameSuccess'), {
        title: t('settings.data.renameSuccessTitle'),
        kind: 'info'
      });
      await exit(0);
    } catch (e) {
      await refreshMigrationStatus().catch(() => undefined);
      await message(t('settings.data.renameError', { error: e }), {
        title: t('settings.data.renameErrorTitle'),
        kind: 'error'
      });
    } finally {
      setIsMigrating(false);
    }
  }, [closeRenameModal, isMigrating, newName, refreshMigrationStatus, t]);

  return {
    browserOpen,
    renameOpen,
    newName,
    isMigrating,
    migrationWarning,
    setNewName,
    openBrowser,
    closeBrowser,
    handleDirectorySelected,
    openRenameModal,
    closeRenameModal,
    submitRename
  };
};
