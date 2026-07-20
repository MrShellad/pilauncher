import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  CheckCircle2,
  Clock,
  Download,
  FileArchive,
  HardDrive,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shirt,
  Trash2,
  Star,
  Package,
  Sparkles,
  Palette,
  Keyboard,
} from 'lucide-react';


import { saveService, createWebDavCommandConfig } from '../../../../../InstanceDetail/logic/saveService';
import type { WebDavRemoteSaveBackup } from '../../../../../../types/webdav';
import { useSettingsStore } from '../../../../../../store/useSettingsStore';
import { OreButton } from '../../../../../../ui/primitives/OreButton';
import { OreDropdown } from '../../../../../../ui/primitives/OreDropdown';
import { OreModal } from '../../../../../../ui/primitives/OreModal';
import { OreToggleButton, type ToggleOption } from '../../../../../../ui/primitives/OreToggleButton';
import { FocusBoundary } from '../../../../../../ui/focus/FocusBoundary';
import { FocusItem } from '../../../../../../ui/focus/FocusItem';
import { useLinearNavigation } from '../../../../../../ui/focus/useLinearNavigation';

interface WebDavManageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface InstanceOption {
  id: string;
  name: string;
  version?: string;
  loader?: string;
}

type DownloadMode = 'local' | 'restore';

const formatSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
};

const formatDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

const formatLoader = (backup: WebDavRemoteSaveBackup) => {
  const { loader, loaderVersion } = backup.metadata.game;
  return [loader, loaderVersion].filter(Boolean).join(' ').trim() || 'Unknown';
};

const makeInstanceLabel = (instance: InstanceOption) =>
  [instance.version, instance.loader].filter(Boolean).join(' / ')
    ? `${instance.name} (${[instance.version, instance.loader].filter(Boolean).join(' / ')})`
    : instance.name;

interface KeyboardProfile {
  name: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  version: string;
}

interface KeyboardProfileListItem {
  filename: string;
  profile: KeyboardProfile;
}

export const WebDavManageModal: React.FC<WebDavManageModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const webDav = settings.general.webDav;
  const [activeTab, setActiveTab] = useState<'saves' | 'skins' | 'favorites' | 'keymaps'>('saves');
  const [remoteBackups, setRemoteBackups] = useState<WebDavRemoteSaveBackup[]>([]);
  const [starredItems, setStarredItems] = useState<any[]>([]);
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
      const items = await invoke<any[]>('get_starred_items');
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
    () => instances.map((instance) => ({ label: makeInstanceLabel(instance), value: instance.id })),
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
            onChange={(val) => setActiveTab(val as 'saves' | 'skins' | 'favorites' | 'keymaps')}
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
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 border-2 border-[#1E1E1F] bg-[#242526] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-minecraft text-sm font-bold text-white">收藏夹同步</h3>
                    <p className="mt-1 text-xs text-[#B1B2B5]">
                      同步本地与 WebDAV 云端的收藏数据（包括本地导入的光影与资源包文件）。
                    </p>
                  </div>
                  <OreButton
                    variant="primary"
                    onClick={handleSyncFavorites}
                    disabled={isSyncingFavorites || isLoading || !configured}
                    focusKey="webdav-manage-fav-sync"
                    onArrowPress={handleLinearArrow}
                  >
                    {isSyncingFavorites ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-2" />
                    )}
                    立即同步
                  </OreButton>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#1E1E1F] pt-3 text-xs text-[#B1B2B5]">
                  <div>
                    <span className="text-[#8E8F93]">云端元数据路径：</span>
                    <span className="font-mono text-white">PiLauncherSync/favorites</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">云端物理文件路径：</span>
                    <span className="font-mono text-white">PiLauncherSync/library</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">本地收藏总数：</span>
                    <span className="text-white font-bold">{starredItems.length} 项</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">自动同步状态：</span>
                    <span className={webDav.syncFavorites ? 'text-ore-green font-bold' : 'text-yellow-500'}>
                      {webDav.syncFavorites ? '已开启' : '未开启'}
                    </span>
                  </div>
                </div>
              </div>

              {(isLoading && starredItems.length === 0) ? (
                <div className="flex items-center justify-center py-12 text-ore-green">
                  <Loader2 size={32} className="animate-spin" />
                </div>
              ) : starredItems.length === 0 ? (
                <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
                  暂无收藏项。
                </div>
              ) : (
                <div className="flex flex-col gap-2 relative">
                  {isLoading && (
                    <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
                      <Loader2 size={24} className="animate-spin text-ore-green" />
                    </div>
                  )}
                  <div className="px-1 text-xs font-bold text-[#8E8F93] font-minecraft">收藏项列表</div>
                  {starredItems.map((item) => {
                    const isCustom = item.source === 'custom';
                    const isShader = item.type === 'shader';
                    const isResourcePack = item.type === 'resourcepack';

                    let icon = <Package size={16} className="text-blue-400" />;
                    if (isShader) {
                      icon = <Sparkles size={16} className="text-yellow-400" />;
                    } else if (isResourcePack) {
                      icon = <Palette size={16} className="text-pink-400" />;
                    }

                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20">
                            {icon}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-white font-minecraft">
                                {item.title || item.id}
                              </span>
                              {isCustom ? (
                                <span className="shrink-0 bg-[#2b3528]/80 text-ore-green border border-ore-green/30 text-[10px] px-1 py-0.5 rounded font-minecraft">
                                  本地导入
                                </span>
                              ) : (
                                <span className="shrink-0 bg-blue-950/80 text-blue-300 border border-blue-800/30 text-[10px] px-1 py-0.5 rounded font-minecraft capitalize">
                                  {item.source}
                                </span>
                              )}
                            </div>
                            <div className="mt-0.5 text-xs text-[#8E8F93] truncate">
                              作者: {item.author || '未知'} • 类型: {item.type}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {isCustom ? (
                            <span className="text-xs text-ore-green font-minecraft">云端文件已同步</span>
                          ) : (
                            <span className="text-xs text-[#B1B2B5] font-minecraft">云端元数据已同步</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : activeTab === 'keymaps' ? (
            <div className="flex flex-col gap-3 font-minecraft">
              <div className="flex flex-col gap-3 border-2 border-[#1E1E1F] bg-[#242526] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white">按键配置同步</h3>
                    <p className="mt-1 text-xs text-[#B1B2B5]">
                      同步本地自定义键盘映射预设与 WebDAV 云端。
                    </p>
                  </div>
                  <OreButton
                    variant="primary"
                    onClick={handleSyncFavorites}
                    disabled={isSyncingFavorites || isLoading || !configured}
                    focusKey="webdav-manage-keymap-sync"
                    onArrowPress={handleLinearArrow}
                  >
                    {isSyncingFavorites ? (
                      <Loader2 size={14} className="mr-2 animate-spin" />
                    ) : (
                      <RefreshCw size={14} className="mr-2" />
                    )}
                    立即同步
                  </OreButton>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-4 border-t border-[#1E1E1F] pt-3 text-xs text-[#B1B2B5]">
                  <div>
                    <span className="text-[#8E8F93]">云端保存路径：</span>
                    <span className="font-mono text-white">PiLauncherSync/keyboard/user</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">本地配置路径：</span>
                    <span className="font-mono text-white">config/keyboard/user</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">本地配置总数：</span>
                    <span className="text-white font-bold">{userProfiles.length} 个</span>
                  </div>
                  <div>
                    <span className="text-[#8E8F93]">自动同步状态：</span>
                    <span className={webDav.syncFavorites ? 'text-ore-green font-bold' : 'text-yellow-500'}>
                      {webDav.syncFavorites ? '已开启' : '未开启'}
                    </span>
                  </div>
                </div>
              </div>

              {(isLoading && userProfiles.length === 0) ? (
                <div className="flex items-center justify-center py-12 text-ore-green">
                  <Loader2 size={32} className="animate-spin" />
                </div>
              ) : userProfiles.length === 0 ? (
                <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
                  暂无自定义按键配置预设。
                </div>
              ) : (
                <div className="flex flex-col gap-2 relative">
                  {isLoading && (
                    <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
                      <Loader2 size={24} className="animate-spin text-ore-green" />
                    </div>
                  )}
                  <div className="px-1 text-xs font-bold text-[#8E8F93] font-minecraft">按键配置列表</div>
                  {userProfiles.map((item) => {
                    return (
                      <div
                        key={item.filename}
                        className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 transition-colors hover:border-ore-green/30"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#5DADEC]">
                            <Keyboard size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-white">
                              {item.profile.name || item.filename}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                              {item.profile.author && <span>作者: {item.profile.author}</span>}
                              {item.profile.version && <span>版本: {item.profile.version}</span>}
                              {item.profile.updatedAt && (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {item.profile.updatedAt}
                                </span>
                              )}
                            </div>
                            {item.profile.description && (
                              <div className="mt-1 truncate text-xs text-[#8E8F93]">
                                {item.profile.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="ml-4 flex shrink-0 items-center gap-2">
                          <OreButton
                            variant="danger"
                            size="sm"
                            onClick={() => void handleDeleteUserProfile(item)}
                            focusKey={`webdav-manage-keymap-delete-${item.filename}`}
                            onArrowPress={handleLinearArrow}
                            disabled={isLoading}
                          >
                            <Trash2 size={14} className="mr-1" />
                            删除
                          </OreButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (isLoading && remoteBackups.length === 0) ? (
            <div className="flex items-center justify-center py-12 text-ore-green">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : remoteBackups.length === 0 ? (
            <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
              未找到 WebDAV 存档备份。
            </div>
          ) : (
            <div className="flex flex-col gap-2 relative">
              {isLoading && (
                <div className="absolute inset-0 bg-[#242526]/50 flex items-center justify-center z-10">
                  <Loader2 size={24} className="animate-spin text-ore-green" />
                </div>
              )}
              {remoteBackups.map((backup) => {
                const busy = busyBackupId === backup.backupId;
                return (
                  <div
                    key={backup.backupId}
                    className="flex items-center justify-between border-2 border-[#1E1E1F] bg-[#242526] p-3 transition-colors hover:border-ore-green/30"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#1E1E1F] bg-black/20 text-[#5DADEC]">
                        <FileArchive size={20} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-minecraft text-sm font-bold text-white">
                          {backup.metadata.world.name || backup.metadata.world.folderName}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#B1B2B5]">
                          <span>{backup.metadata.backupMode}</span>
                          <span>{backup.metadata.game.mcVersion}</span>
                          <span>{formatLoader(backup)}</span>
                          <span>{formatSize(backup.totalSize || backup.metadata.files.totalSize)}</span>
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                            {formatDate(backup.metadata.createdAt)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-[11px] text-[#8E8F93]">
                          {backup.remotePrefix}
                        </div>
                      </div>
                    </div>

                    <div className="ml-4 flex shrink-0 items-center gap-2">
                      <OreButton
                        variant="primary"
                        size="sm"
                        onClick={() => openDownload(backup)}
                        focusKey={`webdav-manage-download-${backup.backupId}`}
                        onArrowPress={handleLinearArrow}
                        disabled={!!busyBackupId}
                      >
                        {busy ? <Loader2 size={14} className="mr-1 animate-spin" /> : <Download size={14} className="mr-1" />}
                        下载
                      </OreButton>
                      <OreButton
                        variant="danger"
                        size="sm"
                        onClick={() => void handleDelete(backup)}
                        focusKey={`webdav-manage-delete-${backup.backupId}`}
                        onArrowPress={handleLinearArrow}
                        disabled={!!busyBackupId}
                      >
                        <Trash2 size={14} className="mr-1" />
                        删除
                      </OreButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </FocusBoundary>

        {pendingDownload && (
          <div className="border-2 border-[#1E1E1F] bg-[#18181B] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-minecraft text-sm text-white">下载目标</div>
                <div className="truncate text-xs text-[#B1B2B5]">
                  {pendingDownload.metadata.world.name || pendingDownload.metadata.world.folderName}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <div className="mb-1 text-xs text-[#B1B2B5]">目标实例</div>
                <OreDropdown
                  options={instanceOptions}
                  value={targetInstanceId}
                  onChange={setTargetInstanceId}
                  placeholder="选择实例"
                  focusKey="webdav-manage-target-instance"
                  onArrowPress={handleLinearArrow}
                  disabled={instanceOptions.length === 0 || !!busyBackupId}
                  portal
                  panelWidth="trigger"
                />
              </div>

              <div>
                <div className="mb-1 text-xs text-[#B1B2B5]">下载模式</div>
                <OreToggleButton
                  options={[
                    {
                      value: 'local',
                      label: (
                        <div className="flex items-center gap-2 justify-center">
                          <HardDrive size={14} />
                          <span>仅下载</span>
                        </div>
                      ),
                    },
                    {
                      value: 'restore',
                      label: (
                        <div className="flex items-center gap-2 justify-center">
                          <RotateCcw size={14} />
                          <span>立即恢复</span>
                        </div>
                      ),
                    },
                  ]}
                  value={downloadMode}
                  onChange={(val) => setDownloadMode(val as DownloadMode)}
                  focusKeyPrefix="webdav-manage-mode"
                  onArrowPress={handleLinearArrow}
                  size="sm"
                  disabled={!!busyBackupId}
                />
              </div>
            </div>

            {downloadMode === 'restore' && (
              <div className="mt-3">
                <RadioButton
                  focusKey="webdav-manage-restore-configs"
                  checked={restoreConfigs}
                  label="同时恢复配置"
                  icon={<CheckCircle2 size={14} />}
                  onClick={() => setRestoreConfigs((value) => !value)}
                  onArrowPress={handleLinearArrow}
                />
              </div>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <OreButton
                variant="primary"
                size="sm"
                focusKey="webdav-manage-confirm-download"
                onArrowPress={handleLinearArrow}
                onClick={() => void handleConfirmDownload()}
                disabled={!targetInstanceId || !!busyBackupId}
              >
                {busyBackupId === pendingDownload.backupId ? (
                  <Loader2 size={14} className="mr-1 animate-spin" />
                ) : (
                  <Download size={14} className="mr-1" />
                )}
                确认
              </OreButton>
              <OreButton
                variant="secondary"
                size="sm"
                focusKey="webdav-manage-cancel-download"
                onArrowPress={handleLinearArrow}
                onClick={() => setPendingDownload(null)}
                disabled={!!busyBackupId}
              >
                取消
              </OreButton>
            </div>
          </div>
        )}
      </div>
    </OreModal>
  );
};

interface RadioButtonProps {
  focusKey: string;
  checked: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  onArrowPress: (direction: string) => boolean | void;
}

const RadioButton: React.FC<RadioButtonProps> = ({
  focusKey,
  checked,
  label,
  icon,
  onClick,
  onArrowPress,
}) => (
  <FocusItem focusKey={focusKey} onEnter={onClick} onArrowPress={onArrowPress}>
    {({ ref, focused }) => (
      <button
        ref={ref as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={onClick}
        className={`flex h-10 items-center gap-2 border-2 px-3 text-left text-xs transition-colors outline-none focus:outline-none ${
          checked
            ? 'border-ore-green bg-ore-green/15 text-white active:bg-ore-green/15'
            : 'border-[#2A2A2C] bg-[#242526] text-[#B1B2B5] active:bg-[#242526]'
        } ${focused ? 'ring-2 ring-white' : ''}`}
      >
        <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${checked ? 'border-ore-green' : 'border-[#777]'}`}>
          {checked && <span className="h-2 w-2 rounded-full bg-ore-green" />}
        </span>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </button>
    )}
  </FocusItem>
);
