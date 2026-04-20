// src/hooks/useAppUpdater.ts
// 全局更新检查状态管理 — 使用 Zustand store 实现跨组件共享
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { create } from 'zustand';

import { useAccountStore } from '../store/useAccountStore';
import { useDownloadStore } from '../store/useDownloadStore';
import { useSettingsStore } from '../store/useSettingsStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckStatus = 'idle' | 'checking' | 'up-to-date' | 'error';

export interface UpdateInfo {
  version: string;
  body?: string;
  date?: string;
}

interface RustUpdateInfo {
  available: boolean;
  version: string;
  body: string;
  url: string;
  signature: string;
}

interface PendingUpdateContext {
  version: string;
  uuid: string;
  region: string;
}

const APP_UPDATE_TASK_ID = 'launcher-update';

// ─── Zustand Store (跨组件共享状态) ──────────────────────────────────────────

interface UpdaterStoreState {
  checkStatus: CheckStatus;
  updateInfo: UpdateInfo | null;
  pendingUpdate: PendingUpdateContext | null;
  isUpdateDialogOpen: boolean;
  isInstalling: boolean;

  setCheckStatus: (status: CheckStatus) => void;
  setUpdateInfo: (info: UpdateInfo | null) => void;
  setPendingUpdate: (ctx: PendingUpdateContext | null) => void;
  setIsUpdateDialogOpen: (open: boolean) => void;
  setIsInstalling: (installing: boolean) => void;
  clearPendingUpdate: () => void;
}

export const useUpdaterStore = create<UpdaterStoreState>((set) => ({
  checkStatus: 'idle',
  updateInfo: null,
  pendingUpdate: null,
  isUpdateDialogOpen: false,
  isInstalling: false,

  setCheckStatus: (status) => set({ checkStatus: status }),
  setUpdateInfo: (info) => set({ updateInfo: info }),
  setPendingUpdate: (ctx) => set({ pendingUpdate: ctx }),
  setIsUpdateDialogOpen: (open) => set({ isUpdateDialogOpen: open }),
  setIsInstalling: (installing) => set({ isInstalling: installing }),
  clearPendingUpdate: () => set({ pendingUpdate: null, updateInfo: null }),
}));

// ─── Hook (操作封装) ─────────────────────────────────────────────────────────

export function useAppUpdater() {
  const { t } = useTranslation();

  // 从各个 store 读取必要数据
  const accounts = useAccountStore((s) => s.accounts);
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const deviceId = useSettingsStore((s) => s.settings.general.deviceId);
  const addOrUpdateTask = useDownloadStore((s) => s.addOrUpdateTask);
  const setPopupOpen = useDownloadStore((s) => s.setPopupOpen);

  // 从 updater store 读取状态
  const checkStatus = useUpdaterStore((s) => s.checkStatus);
  const updateInfo = useUpdaterStore((s) => s.updateInfo);
  const pendingUpdate = useUpdaterStore((s) => s.pendingUpdate);
  const isUpdateDialogOpen = useUpdaterStore((s) => s.isUpdateDialogOpen);
  const isInstalling = useUpdaterStore((s) => s.isInstalling);

  // 构造请求参数
  const currentAccount = accounts.find((a) => a.uuid === activeAccountId) ?? null;
  const uuid = currentAccount?.uuid || deviceId || 'anonymous';
  const region = 'CN';

  const checkForUpdate = useCallback(async () => {
    const store = useUpdaterStore.getState();
    if (store.checkStatus === 'checking') return;

    store.setCheckStatus('checking');
    store.clearPendingUpdate();

    try {
      const update = await invoke<RustUpdateInfo>('check_update', { uuid, region });

      if (update.available) {
        if (!update.url || !update.signature) {
          throw new Error('Current platform updater manifest is missing url/signature');
        }

        store.setPendingUpdate({ version: update.version, uuid, region });
        store.setUpdateInfo({ version: update.version, body: update.body });
        store.setIsUpdateDialogOpen(true);
        store.setCheckStatus('idle');
      } else {
        store.setCheckStatus('up-to-date');
        window.setTimeout(() => store.setCheckStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('[Updater] 检查更新失败:', error);
      store.setCheckStatus('error');
      window.setTimeout(() => store.setCheckStatus('idle'), 4000);
    }
  }, [uuid, region]);

  const installUpdate = useCallback(async () => {
    const store = useUpdaterStore.getState();
    const pending = store.pendingUpdate;

    if (!pending) {
      console.warn('[Updater] 没有可安装的更新对象');
      return;
    }

    const installPayload = {
      uuid: pending.uuid,
      region: pending.region,
      expectedVersion: pending.version,
    };
    const updateTitle = `PiLauncher v${pending.version}`;

    try {
      store.setIsInstalling(true);
      addOrUpdateTask({
        id: APP_UPDATE_TASK_ID,
        taskType: 'update',
        title: updateTitle,
        stage: 'CHECKING_UPDATE',
        current: 0,
        total: 0,
        retryAction: 'install_update',
        retryPayload: installPayload,
        message: t('settings.general.checkUpdate.preparing', {
          defaultValue: '正在准备启动器更新任务...',
        }),
      });
      setPopupOpen(true);
      store.clearPendingUpdate();
      store.setIsUpdateDialogOpen(false);

      await invoke('install_update', installPayload);

      addOrUpdateTask({
        id: APP_UPDATE_TASK_ID,
        taskType: 'update',
        title: updateTitle,
        stage: 'DONE',
        current: 1,
        total: 1,
        retryAction: 'install_update',
        retryPayload: installPayload,
        message: t('settings.general.checkUpdate.installFinished', {
          defaultValue: '更新包下载完成，安装器已启动。',
        }),
      });
      store.setIsInstalling(false);
    } catch (error) {
      console.error('[Updater] 应用内更新失败:', error);
      addOrUpdateTask({
        id: APP_UPDATE_TASK_ID,
        taskType: 'update',
        title: updateTitle,
        stage: 'ERROR',
        current: 0,
        total: 1,
        retryAction: 'install_update',
        retryPayload: installPayload,
        message: t('settings.general.checkUpdate.installFailed', {
          defaultValue: '启动器更新失败：{{error}}',
          error: String(error),
        }),
      });
      setPopupOpen(true);
      store.setIsInstalling(false);
    }
  }, [addOrUpdateTask, setPopupOpen, t]);

  const closeUpdateDialog = useCallback(() => {
    const store = useUpdaterStore.getState();
    store.setIsUpdateDialogOpen(false);
    store.clearPendingUpdate();
  }, []);

  return {
    // 状态
    checkStatus,
    updateInfo,
    pendingUpdate,
    isUpdateDialogOpen,
    isInstalling,
    // 操作
    checkForUpdate,
    installUpdate,
    closeUpdateDialog,
  };
}
