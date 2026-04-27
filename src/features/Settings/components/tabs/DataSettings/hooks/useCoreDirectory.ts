import { useCallback, useState } from 'react';
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

export const useCoreDirectory = ({ basePath, updateGeneralSetting }: UseCoreDirectoryOptions) => {
  const { t } = useTranslation();
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [browserOpen, setBrowserOpen] = useState(false);

  const openBrowser = useCallback(() => {
    setBrowserOpen(true);
  }, []);

  const closeBrowser = useCallback(() => {
    setBrowserOpen(false);
    setTimeout(() => setFocus('settings-data-modify-dir'), 50);
  }, []);

  const handleDirectorySelected = useCallback(async (selectedPath: string) => {
    try {
      closeBrowser();

      if (!selectedPath || selectedPath === basePath) return;

      const wantsMove = await ask(t('settings.data.migrateConfirm'), {
        title: t('settings.data.migrateTitle'),
        kind: 'info'
      });

      await invoke('migrate_base_directory', { newPath: selectedPath, moveData: wantsMove });
      updateGeneralSetting('basePath', selectedPath);

      await message(t('settings.data.migrateSuccess'), {
        title: t('settings.data.migrateSuccessTitle'),
        kind: 'info'
      });
      await exit(0);
    } catch (e) {
      await message(t('settings.data.migrateError', { error: e }), {
        title: t('settings.data.migrateErrorTitle'),
        kind: 'error'
      });
    }
  }, [basePath, closeBrowser, t, updateGeneralSetting]);

  const openRenameModal = useCallback(() => {
    setNewName(basePath.split(/[\\/]/).pop() || '');
    setRenameOpen(true);
  }, [basePath]);

  const closeRenameModal = useCallback(() => {
    setRenameOpen(false);
    setTimeout(() => setFocus('settings-data-rename-dir'), 50);
  }, []);

  const submitRename = useCallback(async () => {
    if (!newName.trim()) {
      closeRenameModal();
      return;
    }

    try {
      await invoke('rename_base_directory', { newName });
      await message(t('settings.data.renameSuccess'), {
        title: t('settings.data.renameSuccessTitle'),
        kind: 'info'
      });
      await exit(0);
    } catch (e) {
      await message(t('settings.data.renameError', { error: e }), {
        title: t('settings.data.renameErrorTitle'),
        kind: 'error'
      });
    }
  }, [closeRenameModal, newName, t]);

  return {
    browserOpen,
    renameOpen,
    newName,
    setNewName,
    openBrowser,
    closeBrowser,
    handleDirectorySelected,
    openRenameModal,
    closeRenameModal,
    submitRename
  };
};
