// src/features/Settings/hooks/useOfflineAuth.ts
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { useAccountStore, type MinecraftAccount } from '../../../store/useAccountStore';

export const useOfflineAuth = () => {
  const { accounts, addAccount, updateAccount } = useAccountStore();
  const [isOfflineModalOpen, setIsOfflineModalOpen] = useState(false);
  const [offlineForm, setOfflineForm] = useState({ name: '', isEdit: false, oldUuid: '' });
  const [offlineError, setOfflineError] = useState("");

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
    const name = offlineForm.name.trim();
    if (!/^[a-zA-Z0-9_]{3,16}$/.test(name)) {
      setOfflineError("用户名不合法！仅支持 3-16 位英文、数字及下划线");
      return;
    }

    const isDup = accounts.some(a => a.name === name && a.uuid !== offlineForm.oldUuid);
    if (isDup) {
      setOfflineError("该游戏 ID 已存在，请换一个名称");
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

      // ✅ 魔法：闭窗后，后台静默向 Mojang 尝试白嫖皮肤
      try {
        const localPath = await invoke<string>('fetch_offline_skin_from_mojang', {
          username: name,
          offlineUuid: generatedUuid
        });
        // 白嫖成功，给 Store 更新并加上时间戳破除缓存
        updateAccount(generatedUuid, { skinUrl: `${localPath}?t=${Date.now()}` });
      } catch (err) {
        console.log("该离线名称不存在对应的正版皮肤", err);
        // 如果抓取失败（即名字没被正版注册），则什么都不做，默认展示 Steve 即可。
      }

    } catch (e) {
      setOfflineError(String(e));
    }
  };

  const handleUploadSkin = async (uuid: string) => {
    const selected = await openDialog({ filters: [{ name: 'PNG Image', extensions: ['png'] }] });
    if (selected && typeof selected === 'string') {
      try {
        const localPath = await invoke<string>('upload_offline_skin', { uuid, sourcePath: selected });
        updateAccount(uuid, { skinUrl: `${localPath}?t=${Date.now()}` });
      } catch (e) {
        alert(e);
      }
    }
  };

  return {
    isOfflineModalOpen, setIsOfflineModalOpen,
    offlineForm, setOfflineForm, offlineError,
    openAddOffline, openEditOffline, handleSaveOffline, handleUploadSkin
  };
};