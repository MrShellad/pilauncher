import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  HardDrive,
  Loader2,
  RefreshCw,
  Shirt,
  Star,
  Keyboard,
} from 'lucide-react';

import { saveService, createWebDavCommandConfig } from '@/features/instances';
import type { WebDavRemoteSaveBackup } from '../../../../../../types/webdav';
import { useSettingsStore } from '@/app/stores/useSettingsStore';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreToggleButton, type ToggleOption } from '../../../../../../ui/primitives/OreToggleButton';
import { FocusBoundary } from '../../../../../../ui/focus/FocusBoundary';
import { useLinearNavigation } from '../../../../../../ui/focus/useLinearNavigation';
import { WebDavBackupList } from './WebDavBackupList';
import { WebDavDownloadPanel } from './WebDavDownloadPanel';
import { WebDavFavoritesPanel } from './WebDavFavoritesPanel';
import { WebDavKeymapsPanel } from './WebDavKeymapsPanel';
import { makeWebDavInstanceLabel } from './webDavManagePresentation';
import type {
  DownloadMode,
  InstanceOption,
  KeyboardProfileListItem,
  StarredItem,
  WebDavManageTab,
} from './webDavManageTypes';

interface WebDavManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebDavManageModal: React.FC<WebDavManageModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const webDav = settings.general.webDav;
  const [activeTab, setActiveTab] = useState<WebDavManageTab>('saves');
  const [remoteBackups, setRemoteBackups] = useState<WebDavRemoteSaveBackup[]>([]);
  const [starredItems, setStarredItems] = useState<StarredItem[]>([]);
  const [userProfiles, setUserProfiles] = useState<KeyboardProfileListItem[]>([]);
  const tabs = useMemo<ToggleOption[]>(
    () => [
      {
        value: 'saves',
        label: (
          <div className="flex items-center justify-center gap-2">
            <HardDrive size={16} />
            <span>备份管理 ({remoteBackups.length})</span>
          </div>
        ),
      },
      {
        value: 'favorites',
        label: (
          <div className="flex items-center justify-center gap-2">
            <Star size={16} />
            <span>收藏同步 ({starredItems.length})</span>
          </div>
        ),
      },
      {
        value: 'keymaps',
        label: (
          <div className="flex items-center justify-center gap-2">
            <Keyboard size={16} />
            <span>按键配置 ({userProfiles.length})</span>
          </div>
        ),
      },
      {
        value: 'skins',
        label: (
          <div className="flex items-center justify-center gap-2">
            <Shirt size={16} />
            <span>皮肤备份</span>
          </div>
        ),
      },
    ],
    [remoteBackups.length, starredItems.length, userProfiles.length]
  );
  const [instances, setInstances] = useState<InstanceOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyBackupId, setBusyBackupId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [pendingDownload, setPendingDownload] = useState<WebDavRemoteSaveBackup | null>(null);
  const [targetInstanceId, setTargetInstanceId] = useState('');
  const [downloadMode, setDownloadMode] = useState<DownloadMode>('local');
  const [restoreConfigs, setRestoreConfigs] = useState(false);

  const configured = webDav.address.trim() !== '';

  const config = useMemo(
    () => createWebDavCommandConfig(webDav, settings.general.deviceId),
    [settings.general.deviceId, webDav]
  );

  const loadInstances = useCallback(async () => {
    try {
      const data = await invoke<any[]>('get_all_instances', { forceRefresh: false });
      setInstances(
        data.map((item) => ({
          id: item.id,
          name: item.name,
          version: item.version,
          loader: item.loader,
        }))
      );
    } catch (caught) {
      console.error('Failed to load instances:', caught);
      setInstances([]);
    }
  }, []);

  const loadBackups = useCallback(async () => {
    if (!configured) {
      setRemoteBackups([]);
      setError('尚未配置 WebDAV。');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const backups = await saveService.listWebDavBackups(config);
      setRemoteBackups(backups);
    } catch (caught) {
      setError(String(caught));
      setRemoteBackups([]);
    } finally {
      setIsLoading(false);
    }
  }, [config, configured]);

  const [isSyncingFavorites, setIsSyncingFavorites] = useState(false);

  const loadFavorites = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const items = await invoke<StarredItem[]>('get_starred_items');
      setStarredItems(items);
    } catch (caught) {
      setError(String(caught));
      setStarredItems([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadUserProfiles = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const list = await invoke<KeyboardProfileListItem[]>('list_user_profiles');
      setUserProfiles(list);
    } catch (caught) {
      setError(String(caught));
      setUserProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDeleteUserProfile = useCallback(async (item: KeyboardProfileListItem) => {
    const confirmed = window.confirm(`确定要删除按键配置「${item.profile.name || item.filename}」吗？\n这会同时从本地和 WebDAV 云端删除此配置。`);
    if (!confirmed) return;

    setIsLoading(true);
    setError('');
    try {
      await invoke('delete_user_profile', { filename: item.filename });
      
      if (configured) {
        const configParam = {
          baseUrl: webDav.address,
          username: webDav.username,
          password: webDav.password,
          deviceId: settings.general.deviceId,
          saveBackupMode: webDav.saveBackupMode || 'backup',
        };
        await invoke('delete_webdav_keymap', { config: configParam, filename: item.filename });
      }

      await loadUserProfiles();
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsLoading(false);
    }
  }, [configured, webDav, settings.general.deviceId, loadUserProfiles]);

  const handleSyncFavorites = useCallback(async () => {
    if (!configured) {
      setError('尚未配置 WebDAV。');
      return;
    }
    setIsSyncingFavorites(true);
    setError('');
    try {
      const configParam = {
        baseUrl: webDav.address,
        username: webDav.username,
        password: webDav.password,
        deviceId: settings.general.deviceId,
        saveBackupMode: webDav.saveBackupMode || 'backup',
      };
      const result = await invoke<any>('sync_webdav_favorites', { config: configParam });
      
      updateGeneralSetting('webDav', {
        ...webDav,
        lastSyncTime: Date.now(),
      });

      if (activeTab === 'keymaps') {
        await loadUserProfiles();
      } else {
        await loadFavorites();
      }
      
      alert(
        `同步成功！\n上传操作数: ${result.uploadedOperations}\n下载操作数: ${result.downloadedOperations}\n合并项数: ${result.mergedFavorites.length}\n总操作数: ${result.totalOperations}`
      );
    } catch (caught) {
      setError(String(caught));
    } finally {
      setIsSyncingFavorites(false);
    }
  }, [configured, webDav, settings.general.deviceId, updateGeneralSetting, loadFavorites, activeTab, loadUserProfiles]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === 'saves') {
      await loadBackups();
    } else if (activeTab === 'favorites') {
      await loadFavorites();
    } else if (activeTab === 'keymaps') {
      await loadUserProfiles();
    }
  }, [activeTab, loadBackups, loadFavorites, loadUserProfiles]);

  useEffect(() => {
    if (!isOpen) return;
    setPendingDownload(null);
    setDownloadMode('local');
    setRestoreConfigs(false);
    void loadInstances();
    if (activeTab === 'saves') {
      void loadBackups();
    } else if (activeTab === 'favorites') {
      void loadFavorites();
    } else if (activeTab === 'keymaps') {
      void loadUserProfiles();
    }
  }, [isOpen, activeTab, loadBackups, loadFavorites, loadInstances, loadUserProfiles]);

  const openDownload = useCallback(
    (backup: WebDavRemoteSaveBackup) => {
      const matchingInstance = instances.find((instance) => instance.id === backup.metadata.instanceId);
      setPendingDownload(backup);
      setTargetInstanceId(matchingInstance?.id || instances[0]?.id || '');
      setDownloadMode('local');
      setRestoreConfigs(false);
    },
    [instances]
  );

  const handleConfirmDownload = useCallback(async () => {
    if (!pendingDownload || !targetInstanceId) return;
    const backupId = pendingDownload.backupId;
    setBusyBackupId(backupId);
    setError('');
    try {
      const result = await saveService.downloadWebDavBackup(
        config,
        backupId,
        targetInstanceId,
        downloadMode === 'restore',
        restoreConfigs,
        true
      );
      updateGeneralSetting('webDav', {
        ...webDav,
        lastSyncTime: Date.now(),
      });
      setPendingDownload(null);
      await loadBackups();
      const suffix = result.restored
        ? `已恢复到 ${result.restoreResult?.restoredFolderName || 'saves'}。`
        : '已保存到本地备份中心。';
      alert(`已下载 ${result.downloadedBackups} 个备份，共 ${result.downloadedFiles} 个文件。${suffix}`);
    } catch (caught) {
      setError(String(caught));
    } finally {
      setBusyBackupId(null);
    }
  }, [
    config,
    downloadMode,
    loadBackups,
    pendingDownload,
    restoreConfigs,
    targetInstanceId,
    updateGeneralSetting,
    webDav,
  ]);

  const handleDelete = useCallback(
    async (backup: WebDavRemoteSaveBackup) => {
      const confirmed = window.confirm(`确定要删除 WebDAV 备份「${backup.metadata.world.name}」吗？`);
      if (!confirmed) return;

      setBusyBackupId(backup.backupId);
      setError('');
      try {
        await saveService.deleteWebDavBackup(config, backup.backupId);
        await loadBackups();
      } catch (caught) {
        setError(String(caught));
      } finally {
        setBusyBackupId(null);
      }
    },
    [config, loadBackups]
  );

  const instanceOptions = useMemo(
    () => instances.map((instance) => ({ label: makeWebDavInstanceLabel(instance), value: instance.id })),
    [instances]
  );

  const focusOrder = useMemo(() => {
    const tabKeys = [
      'webdav-manage-tab-0',
      'webdav-manage-tab-1',
      'webdav-manage-tab-2',
      'webdav-manage-tab-3',
      'webdav-manage-refresh',
    ];
    const itemKeys =
      activeTab === 'saves'
        ? remoteBackups.flatMap((backup) => [
            `webdav-manage-download-${backup.backupId}`,
            `webdav-manage-delete-${backup.backupId}`,
          ])
        : activeTab === 'favorites'
        ? ['webdav-manage-fav-sync']
        : activeTab === 'keymaps'
        ? [
            'webdav-manage-keymap-sync',
            ...userProfiles.map((item) => `webdav-manage-keymap-delete-${item.filename}`),
          ]
        : [];
    const downloadKeys = pendingDownload
      ? [
          'webdav-manage-target-instance',
          'webdav-manage-mode-0',
          'webdav-manage-mode-1',
          ...(downloadMode === 'restore' ? ['webdav-manage-restore-configs'] : []),
          'webdav-manage-confirm-download',
          'webdav-manage-cancel-download',
        ]
      : [];

    return [...tabKeys, ...itemKeys, ...downloadKeys, 'webdav-manage-close'];
  }, [activeTab, downloadMode, pendingDownload, remoteBackups]);

  const defaultFocusKey = focusOrder[0] || 'webdav-manage-close';
  const { handleLinearArrow } = useLinearNavigation(focusOrder, defaultFocusKey, false, isOpen);

  return (
    <OreModal
      isOpen={isOpen}
      onClose={onClose}
      title="管理 WebDAV 备份"
      defaultFocusKey={defaultFocusKey}
      className="w-[58rem] max-w-[calc(100vw-2rem)]"
      actions={(
        <div className="flex w-full justify-center gap-3">
          <OreButton
            variant="secondary"
            size="full"
            onClick={onClose}
            focusKey="webdav-manage-close"
            onArrowPress={handleLinearArrow}
            className="flex-1"
          >
            关闭
          </OreButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">


        {error && (
          <div className="border-2 border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
            {error}
          </div>
        )}

        <div 
          className="flex items-center border-b-2 border-[#1E1E1F] bg-[#141517] w-full"
          style={{ '--ore-toggle-height': 'clamp(2.625rem, calc(2vw + 0.875rem), 3.25rem)' } as any}
        >
          <OreToggleButton
            options={tabs}
            value={activeTab}
            onChange={(val) => setActiveTab(val as WebDavManageTab)}
            focusKeyPrefix="webdav-manage-tab"
            onArrowPress={handleLinearArrow}
            className="w-full flex-1 ore-tab-nav-toggle"
            uiScale="adaptive"
            focusable={true}
          />
          <OreButton
            variant="secondary"
            onClick={handleRefresh}
            focusKey="webdav-manage-refresh"
            onArrowPress={handleLinearArrow}
            disabled={isLoading || isSyncingFavorites}
            className="!h-[var(--ore-toggle-height)] !min-h-[var(--ore-toggle-height)] rounded-none !m-0 border-y-0 border-r-0 border-l border-[#1E1E1F] px-4"
          >
            {isLoading || isSyncingFavorites ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
            刷新
          </OreButton>
        </div>

        <FocusBoundary
          id="webdav-manage-boundary"
          className="flex min-h-[16rem] max-h-[24rem] flex-col gap-2 overflow-y-auto pr-1 custom-scrollbar"
        >
          {activeTab === 'skins' ? (
            <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
              本次仅接入存档备份管理，皮肤备份管理暂未连接。
            </div>
          ) : activeTab === 'favorites' ? (
            <WebDavFavoritesPanel
              items={starredItems}
              isLoading={isLoading}
              isSyncing={isSyncingFavorites}
              configured={configured}
              autoSyncEnabled={!!webDav.syncFavorites}
              onSync={() => void handleSyncFavorites()}
              onArrowPress={handleLinearArrow}
            />
          ) : activeTab === 'keymaps' ? (
            <WebDavKeymapsPanel
              profiles={userProfiles}
              isLoading={isLoading}
              isSyncing={isSyncingFavorites}
              configured={configured}
              autoSyncEnabled={!!webDav.syncFavorites}
              onSync={() => void handleSyncFavorites()}
              onDelete={(item) => void handleDeleteUserProfile(item)}
              onArrowPress={handleLinearArrow}
            />
          ) : (
            <WebDavBackupList
              backups={remoteBackups}
              isLoading={isLoading}
              busyBackupId={busyBackupId}
              onDownload={openDownload}
              onDelete={(backup) => void handleDelete(backup)}
              onArrowPress={handleLinearArrow}
            />
          )}
        </FocusBoundary>

        {pendingDownload && (
          <WebDavDownloadPanel
            backup={pendingDownload}
            instanceOptions={instanceOptions}
            targetInstanceId={targetInstanceId}
            downloadMode={downloadMode}
            restoreConfigs={restoreConfigs}
            busyBackupId={busyBackupId}
            onTargetInstanceChange={setTargetInstanceId}
            onDownloadModeChange={setDownloadMode}
            onRestoreConfigsChange={setRestoreConfigs}
            onConfirm={() => void handleConfirmDownload()}
            onCancel={() => setPendingDownload(null)}
            onArrowPress={handleLinearArrow}
          />
        )}
      </div>
    </OreModal>
  );
};
