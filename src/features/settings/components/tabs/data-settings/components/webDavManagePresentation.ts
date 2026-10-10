import type { WebDavRemoteSaveBackup } from '../../../../../../types/webdav';

import type { InstanceOption } from './webDavManageTypes';

export const formatWebDavBackupSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${parseFloat((bytes / Math.pow(1024, index)).toFixed(2))} ${units[index]}`;
};

export const formatWebDavBackupDate = (timestamp: number) => {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return '-';
  return new Date(timestamp * 1000).toLocaleString();
};

export const formatWebDavBackupLoader = (backup: WebDavRemoteSaveBackup) => {
  const { loader, loaderVersion } = backup.metadata.game;
  return [loader, loaderVersion].filter(Boolean).join(' ').trim() || 'Unknown';
};

export const makeWebDavInstanceLabel = (instance: InstanceOption) =>
  [instance.version, instance.loader].filter(Boolean).join(' / ')
    ? `${instance.name} (${[instance.version, instance.loader].filter(Boolean).join(' / ')})`
    : instance.name;
