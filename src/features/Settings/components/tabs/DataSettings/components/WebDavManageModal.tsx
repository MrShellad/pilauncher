import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  AlertCircle,
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

export const WebDavManageModal: React.FC<WebDavManageModalProps> = ({ isOpen, onClose }) => {
  const { settings, updateGeneralSetting } = useSettingsStore();
  const webDav = settings.general.webDav;
  const [activeTab, setActiveTab] = useState<'saves' | 'skins'>('saves');
  const [remoteBackups, setRemoteBackups] = useState<WebDavRemoteSaveBackup[]>([]);
  const tabs = useMemo<ToggleOption[]>(
    () => [
      {
        value: 'saves',
        label: (
          <div className="flex items-center justify-center gap-2">
            <HardDrive size={16} />
            <span>存档备份 ({remoteBackups.length})</span>
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
    [remoteBackups.length]
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

  useEffect(() => {
    if (!isOpen) return;
    setPendingDownload(null);
    setDownloadMode('local');
    setRestoreConfigs(false);
    void loadInstances();
    void loadBackups();
  }, [isOpen, loadBackups, loadInstances]);

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
    const tabKeys = ['webdav-manage-tab-0', 'webdav-manage-tab-1', 'webdav-manage-refresh'];
    const itemKeys =
      activeTab === 'saves'
        ? remoteBackups.flatMap((backup) => [
            `webdav-manage-download-${backup.backupId}`,
            `webdav-manage-delete-${backup.backupId}`,
          ])
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
        <div className="flex justify-end">
          <OreButton
            variant="secondary"
            onClick={onClose}
            focusKey="webdav-manage-close"
            onArrowPress={handleLinearArrow}
          >
            关闭
          </OreButton>
        </div>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 border-2 border-ore-green/30 bg-[#2b3528]/80 p-3 text-sm text-ore-text-muted">
          <AlertCircle size={18} className="mt-0.5 shrink-0 text-ore-green" />
          <div className="min-w-0">
            <div className="mb-0.5 font-minecraft font-bold text-white">云端备份文件</div>
            <p className="text-xs text-[#B1B2B5]">
              可将 WebDAV 存档备份下载到本地实例备份中心，也可以下载后立即恢复到 saves。
            </p>
          </div>
        </div>

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
            onChange={(val) => setActiveTab(val as 'saves' | 'skins')}
            focusKeyPrefix="webdav-manage-tab"
            onArrowPress={handleLinearArrow}
            className="flex-1 ore-tab-nav-toggle"
            uiScale="adaptive"
            focusable={true}
          />
          <OreButton
            variant="secondary"
            onClick={loadBackups}
            focusKey="webdav-manage-refresh"
            onArrowPress={handleLinearArrow}
            disabled={isLoading}
            className="!h-[var(--ore-toggle-height)] !min-h-[var(--ore-toggle-height)] rounded-none !m-0 border-y-0 border-r-0 border-l border-[#1E1E1F] px-4"
          >
            {isLoading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <RefreshCw size={16} className="mr-2" />}
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
          ) : isLoading ? (
            <div className="flex items-center justify-center py-12 text-ore-green">
              <Loader2 size={32} className="animate-spin" />
            </div>
          ) : remoteBackups.length === 0 ? (
            <div className="border-2 border-[#1E1E1F] bg-[#242526] p-6 text-center text-sm text-[#B1B2B5]">
              未找到 WebDAV 存档备份。
            </div>
          ) : (
            remoteBackups.map((backup) => {
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
            })
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
        className={`flex h-10 items-center gap-2 border-2 px-3 text-left text-xs transition-colors ${
          checked
            ? 'border-ore-green bg-ore-green/15 text-white'
            : 'border-[#2A2A2C] bg-[#242526] text-[#B1B2B5]'
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
