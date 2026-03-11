// src/features/Settings/hooks/useOfflineAuth.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

import { useAccountStore, type MinecraftAccount } from '../../../store/useAccountStore';

export const useOfflineAuth = () => {
  const { accounts, addAccount, updateAccount } = useAccountStore();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({ name: '', isEdit: false, oldUuid: '' });
  const [offlineError, setOfflineError] = useState('');

  const openAddOffline = () => {
    setOfflineForm({ name: '', isEdit: false, oldUuid: '' });
    setOfflineError('');
    setIsOfflineModalOpen(true);
  };

  const openEditOffline = (acc: MinecraftAccount) => {
    setOfflineForm({ name: acc.name, isEdit: true, oldUuid: acc.uuid });
    setOfflineError('');
    setIsOfflineModalOpen(true);
  };

  const handleSaveOffline = async () => {
    setOfflineError('');

    const name = offlineForm.name.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) {
      setOfflineError('用户名不合法，仅支持 3-16 位英文字母、数字和下划线。');
      return;
    }

    const isDup = accounts.some((account) => account.name === name && account.uuid !== offlineForm.oldUuid);
    if (isDup) {
      setOfflineError('该游戏 ID 已存在，请更换一个名称。');
      return;
    }

    try {
      const generatedUuid = await invoke<string>('generate_offline_uuid', { name });
      if (offlineForm.isEdit) {
        updateAccount(offlineForm.oldUuid, { name, uuid: generatedUuid });
      } else {
        addAccount({ uuid: generatedUuid, name, type: 'offline', accessToken: 'offline_local_token' });
      }

      setIsOfflineModalOpen(false);

      try {
        const localPath = await invoke<string>('fetch_offline_skin_from_mojang', {
          username: name,
          offlineUuid: generatedUuid
        });
        updateAccount(generatedUuid, { skinUrl: `${localPath}?t=${Date.now()}` });
      } catch (error) {
        console.log('Offline skin fallback to default avatar.', error);
      }
    } catch (error) {
      setOfflineError(String(error));
    }
  };

  const handleUploadSkin = async (uuid: string) => {
    const selected = await openDialog({ filters: [{ name: 'PNG Image', extensions: ['png'] }] });
    if (selected && typeof selected === 'string') {
      try {
        const localPath = await invoke<string>('upload_offline_skin', { uuid, sourcePath: selected });
        updateAccount(uuid, { skinUrl: `${localPath}?t=${Date.now()}` });
      } catch (error) {
        alert(error);
      }
    }
  };

  return {
    isOfflineModalOpen,
    setIsOfflineModalOpen,
    offlineForm,
    setOfflineForm,
    offlineError,
    setOfflineError,
    openAddOffline,
    openEditOffline,
    handleSaveOffline,
    handleUploadSkin
  };
};
