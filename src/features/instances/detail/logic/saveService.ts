import { invoke } from '@tauri-apps/api/core';
import type {
  WebDavRemoteSaveBackup,
  WebDavSaveBackupDeleteResult,
  WebDavSaveBackupDownloadResult,
} from '../../../../types/webdav';
import type { WebDavSettings } from '../../../../types/settings';

export interface SaveBackupWorld {
  name: string;
  uuid: string;
  folderName: string;
}

export interface SaveBackupGame {
  mcVersion: string;
  loader: string;
  loaderVersion: string;
}

export interface SaveBackupModEntry {
  fileName: string;
  hash: string;
}

export interface SaveBackupEnvironment {
  modsHash: string;
  configHash: string;
  modCount: number;
  mods: SaveBackupModEntry[];
}

export interface SaveBackupFiles {
  worldSize: number;
  configSize: number;
  totalSize: number;
  worldHash?: string;
  configHash?: string;
  manifestHash?: string;
}

export interface SaveBackupState {
  safeBackup: boolean;
}

export interface SaveBackupUser {
  note: string;
  tags: string[];
}

export interface SaveBackupMetadata {
  backupId: string;
  instanceId: string;
  backupMode: 'full' | 'differential';
  baseBackupId?: string;
  world: SaveBackupWorld;
  createdAt: number;
  trigger: string;
  game: SaveBackupGame;
  environment: SaveBackupEnvironment;
  files: SaveBackupFiles;
  state: SaveBackupState;
  user: SaveBackupUser;
  hasConfigs: boolean;
}

export interface SaveRestoreCheckResult {
  backupId: string;
  targetFolderName: string;
  warnings: string[];
  safeBackup: boolean;
  canRestoreConfigs: boolean;
  autoBackupCurrent: boolean;
  gameMatches: boolean;
  loaderMatches: boolean;
  modsMatch: boolean;
  configsMatch: boolean;
}

export interface SaveRestoreResult {
  backupId: string;
  restoredFolderName: string;
  restoredConfigs: boolean;
  guardBackupId?: string | null;
  partial?: boolean;
  warnings?: string[];
}

export interface SaveBackupProgress {
  instanceId: string;
  folderName: string;
  current: number;
  total: number;
  message: string;
  stage: string;
}

export interface SaveItem {
  folderName: string;
  worldName: string;
  worldUuid: string;
  sizeBytes: number;
  lastPlayedTime: number;
  createdTime: number;
  iconPath?: string;
  webdavBackupEnabled: boolean;
}

export type SaveDetail = SaveItem;

export interface WebDavCommandConfig {
  baseUrl: string;
  username: string;
  password: string;
  deviceId: string;
  saveBackupMode: string;
}

export const createWebDavCommandConfig = (
  webDav: WebDavSettings,
  deviceId: string
): WebDavCommandConfig => ({
  baseUrl: webDav.address.trim(),
  username: webDav.username.trim(),
  password: webDav.password,
  deviceId,
  saveBackupMode: webDav.saveBackupMode || 'backup',
});

export const saveService = {
  getSaves: (id: string) => invoke<SaveItem[]>('get_saves', { id }),

  setSaveWebDavBackupEnabled: (id: string, folderName: string, enabled: boolean) =>
    invoke<SaveItem>('set_save_webdav_backup_enabled', { id, folderName, enabled }),

  backupSave: (id: string, folderName: string, mode: 'full' | 'differential' = 'full') =>
    invoke<SaveBackupMetadata>('backup_save', { id, folderName, mode }),

  deleteSave: (id: string, folderName: string, directDelete: boolean) =>
    invoke('delete_save', { id, folderName, directDelete }),

  deleteBackup: (id: string, backupId: string) =>
    invoke('delete_save_backup', { id, backupId }),

  verifyRestore: (id: string, backupId: string) =>
    invoke<SaveRestoreCheckResult>('verify_save_restore', { id, backupId }),

  restoreBackup: (
    id: string,
    backupId: string,
    restoreConfigs: boolean,
    autoBackupCurrent = true
  ) =>
    invoke<SaveRestoreResult>('restore_save_backup', {
      id,
      backupId,
      restoreConfigs,
      autoBackupCurrent,
    }),

  openSavesFolder: (id: string) => invoke('open_saves_folder', { id }),

  getBackups: (id: string) => invoke<SaveBackupMetadata[]>('get_save_backups', { id }),

  listWebDavBackups: (config: WebDavCommandConfig) =>
    invoke<WebDavRemoteSaveBackup[]>('list_webdav_save_backups', { config }),

  downloadWebDavBackup: (
    config: WebDavCommandConfig,
    backupId: string,
    targetInstanceId: string,
    restoreToSaves: boolean,
    restoreConfigs: boolean,
    autoBackupCurrent = true
  ) =>
    invoke<WebDavSaveBackupDownloadResult>('download_webdav_save_backup', {
      config,
      backupId,
      targetInstanceId,
      restoreToSaves,
      restoreConfigs,
      autoBackupCurrent,
    }),

  deleteWebDavBackup: (config: WebDavCommandConfig, backupId: string) =>
    invoke<WebDavSaveBackupDeleteResult>('delete_webdav_save_backup', { config, backupId }),
};
